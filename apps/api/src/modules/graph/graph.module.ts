import { Body, Controller, Delete, Get, Global, Injectable, Logger, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { EdgeRelationship, NodeType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { ReadinessResult } from '@orbit/shared';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { CareerContextService } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { GraphService } from './graph.service';

/**
 * Keeps derived state consistent after any change to a user's career memory:
 * readiness is recalculated (and snapshotted) and the Career Universe re-synced.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger('Sync');

  constructor(
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly graph: GraphService,
  ) {}

  async afterChange(userId: string, trigger: string, options: { recommendations?: boolean } = {}): Promise<ReadinessResult | null> {
    const ctx = await this.context.load(userId);
    const readiness = await this.readiness.recalculate(userId, trigger, ctx);
    try {
      await this.graph.rebuild(userId, { ctx, withRecommendations: options.recommendations ?? false });
    } catch (error) {
      this.logger.error(`Graph sync failed after "${trigger}": ${(error as Error).message}`);
    }
    return readiness;
  }
}

class CreateNodeDto {
  @IsEnum(NodeType)
  type!: NodeType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  connectToNodeId?: string;

  @IsOptional()
  @IsEnum(EdgeRelationship)
  relationship?: EdgeRelationship;
}

class CreateEdgeDto {
  @IsUUID()
  sourceNodeId!: string;

  @IsUUID()
  targetNodeId!: string;

  @IsEnum(EdgeRelationship)
  relationship!: EdgeRelationship;
}

@Controller('universe')
export class UniverseController {
  constructor(
    private readonly graph: GraphService,
    private readonly sync: SyncService,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const graph = await this.graph.graph(user.id);
    if (graph.nodes.length === 0) {
      // First visit after onboarding: build lazily.
      await this.graph.rebuild(user.id, { withRecommendations: true });
      return this.graph.graph(user.id);
    }
    return graph;
  }

  @Post('rebuild')
  async rebuild(@CurrentUser() user: AuthUser) {
    await this.sync.afterChange(user.id, 'universe_refresh', { recommendations: true });
    return this.graph.graph(user.id);
  }

  @Get('nodes/:id')
  node(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.graph.nodeDetail(user.id, id);
  }

  @Post('nodes')
  addNode(@CurrentUser() user: AuthUser, @Body() dto: CreateNodeDto) {
    return this.graph.addNode(user.id, dto);
  }

  @Delete('nodes/:id')
  removeNode(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.graph.removeNode(user.id, id);
  }

  @Post('edges')
  addEdge(@CurrentUser() user: AuthUser, @Body() dto: CreateEdgeDto) {
    return this.graph.addEdge(user.id, dto);
  }
}

@Global()
@Module({
  controllers: [UniverseController],
  providers: [GraphService, SyncService],
  exports: [GraphService, SyncService],
})
export class GraphModule {}
