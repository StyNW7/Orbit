import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { EvidenceType, QuestCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { QuestsService } from '../quests/quests.service';
import { JourneysService } from './journeys.service';

export class BuildJourneyDto {
  @IsOptional()
  @IsUUID()
  goalId?: string;
}

export class AddSkillDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  skillSlug!: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;
}

export class CustomQuestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(600)
  description!: string;

  @IsOptional()
  @IsEnum(QuestCategory)
  category?: QuestCategory;

  @IsOptional()
  @IsString()
  skillSlug?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  tasks!: string[];

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  @Type(() => Number)
  xp?: number;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;
}

export class TaskProgressDto {
  @IsUUID()
  taskId!: string;

  @IsBoolean()
  completed!: boolean;
}

export class EvidenceDto {
  @IsEnum(EvidenceType)
  type!: EvidenceType;

  @ValidateIf((o) => ['URL', 'GITHUB', 'PORTFOLIO'].includes(o.type) || o.url !== undefined)
  @IsUrl({ require_protocol: true }, { message: 'Please provide a full link starting with http:// or https://' })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsUUID()
  fileId?: string;
}

export class CompleteQuestDto {
  @IsOptional()
  @IsBoolean()
  completeRemainingTasks?: boolean;
}

export class UpdateQuestDto {
  @IsOptional()
  @ValidateIf((o) => o.deadline !== null)
  @IsDateString()
  deadline?: string | null;
}

@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.journeys.list(user.id);
  }

  @Get('primary')
  primary(@CurrentUser() user: AuthUser) {
    return this.journeys.primary(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journeys.detail(user.id, id);
  }

  @Post()
  build(@CurrentUser() user: AuthUser, @Body() dto: BuildJourneyDto) {
    return this.journeys.build(user.id, dto.goalId);
  }

  @Post('skills')
  addSkill(@CurrentUser() user: AuthUser, @Body() dto: AddSkillDto) {
    return this.journeys.addSkill(user.id, dto.skillSlug, dto.goalId);
  }

  @Post('quests')
  addQuest(@CurrentUser() user: AuthUser, @Body() dto: CustomQuestDto) {
    return this.journeys.addCustomQuest(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journeys.remove(user.id, id);
  }
}

@Controller('quests')
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.quests.current(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.quests.view(user.id, id);
  }

  @Post(':id/progress')
  progress(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TaskProgressDto) {
    return this.quests.setTask(user.id, id, dto.taskId, dto.completed);
  }

  @Post(':id/evidence')
  evidence(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EvidenceDto) {
    return this.quests.submitEvidence(user.id, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteQuestDto) {
    return this.quests.complete(user.id, id, dto.completeRemainingTasks ?? false);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuestDto) {
    return this.quests.update(user.id, id, dto);
  }
}

@Module({
  controllers: [JourneysController, QuestsController],
  providers: [JourneysService, QuestsService],
  exports: [JourneysService, QuestsService],
})
export class JourneysModule {}
