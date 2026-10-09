import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AGENT_TOOLS } from '@orbit/shared';
import { AppConfig } from '../../config/app-config';
import { AppError } from '../../common/http/errors';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toInsightView } from '../../common/mappers';
import { ApplicationsModule } from '../applications/applications.module';
import { JourneysModule } from '../journeys/journeys.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProgressModule } from '../progress/progress.module';
import { ActionExecutorService } from './action-executor.service';
import { AgentService } from './agent.service';
import { ContextBuilderService } from './context-builder.service';
import { LangflowClient } from './langflow.client';
import { PlannerEngine } from './planner.engine';
import { TOOL_SPECS, ToolRegistryService } from './tool-registry.service';

export class PageContextDto {
  @IsIn(['mission-control', 'universe', 'journey', 'discover', 'progress', 'profile', 'application', 'settings', 'other'])
  page!: 'mission-control' | 'universe' | 'journey' | 'discover' | 'progress' | 'profile' | 'application' | 'settings' | 'other';

  @IsOptional() @IsString() @MaxLength(40) entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsString() @MaxLength(160) label?: string;
}

export class ChatDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @IsOptional() @IsUUID() conversationId?: string;
  @IsOptional() @ValidateNested() @Type(() => PageContextDto) pageContext?: PageContextDto;
}

export class ToolCallDto {
  @IsString() @MinLength(8) session_id!: string;
  @IsOptional() @IsObject() args?: Record<string, unknown>;
}

/** Langflow tool components authenticate with a shared secret, never with user JWTs. */
@Injectable()
export class ToolKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.toolKeyConfigured) {
      throw new AppError('INVALID_TOOL_KEY', 'Tool access is not configured.', HttpStatus.UNAUTHORIZED);
    }
    const req = context.switchToHttp().getRequest<Request>();
    const provided = Buffer.from(String(req.headers['x-orbit-tool-key'] ?? ''));
    const expected = Buffer.from(this.config.env.ORBIT_TOOL_API_KEY);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new AppError('INVALID_TOOL_KEY', 'Invalid tool key.', HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly actions: ActionExecutorService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return this.agent.chat(user.id, dto);
  }

  @Get('status')
  status() {
    return this.agent.status();
  }

  @Get('conversations')
  conversations(@CurrentUser() user: AuthUser) {
    return this.agent.conversations(user.id);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.agent.messages(user.id, id);
  }

  @Get('actions')
  audit(@CurrentUser() user: AuthUser) {
    return this.agent.auditLog(user.id);
  }

  @Post('actions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.actions.confirm(user.id, id);
  }

  @Post('actions/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.actions.reject(user.id, id);
  }
}

/** Server-to-server tool API used by the Langflow Orbit Agent flow. */
@Public()
@UseGuards(ToolKeyGuard)
@Controller('agent/tools')
export class AgentToolsController {
  constructor(private readonly agent: AgentService) {}

  @Get('manifest')
  manifest() {
    return TOOL_SPECS.map((t) => ({ name: t.name, level: t.level, description: t.description, parameters: t.parameters }));
  }

  @Post('context')
  @HttpCode(HttpStatus.OK)
  context(@Body() dto: ToolCallDto) {
    return this.agent.contextForSession(dto.session_id);
  }

  @Post(':tool')
  @HttpCode(HttpStatus.OK)
  run(@Param('tool') tool: string, @Body() dto: ToolCallDto) {
    if (!(AGENT_TOOLS as readonly string[]).includes(tool)) throw new AppError('UNKNOWN_TOOL', `Unknown tool ${tool}.`, HttpStatus.NOT_FOUND);
    return this.agent.executeToolForSession(dto.session_id, tool, dto.args ?? {});
  }
}

@Controller('insights')
export class InsightsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: ActionExecutorService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.agentInsight.findMany({ where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 20 });
    return rows.map(toInsightView);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  apply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.actions.applyInsight(user.id, id);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismiss(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.agentInsight.updateMany({ where: { id, userId: user.id }, data: { status: 'DISMISSED' } });
    return { ok: true };
  }
}

@Module({
  imports: [JourneysModule, ApplicationsModule, ProfilesModule, ProgressModule],
  controllers: [AgentController, AgentToolsController, InsightsController],
  providers: [AgentService, ActionExecutorService, ContextBuilderService, ToolRegistryService, PlannerEngine, LangflowClient, ToolKeyGuard],
})
export class AgentModule {}
