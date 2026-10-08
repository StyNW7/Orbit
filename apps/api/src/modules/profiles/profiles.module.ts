import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AchievementType, ExperienceType, OpportunityType, WorkMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Public } from '../../common/auth/auth.decorators';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toSkillView } from '../../common/mappers';
import { ProgressModule } from '../progress/progress.module';
import { GoalsService } from './goals.service';
import { ProfilesService } from './profiles.service';

const nullableUrl = () => ValidateIf((_o, v) => v !== null && v !== undefined && v !== '');

export class AnalyzeProfileDto {
  @IsString()
  @MinLength(2)
  targetRoleSlug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  cvText?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  interests: string[] = [];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  preferredIndustries: string[] = [];

  @IsArray()
  @IsEnum(WorkMode, { each: true })
  preferredWorkModes: WorkMode[] = [];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  preferredLocations: string[] = [];

  @IsArray()
  @IsEnum(OpportunityType, { each: true })
  preferredRoleTypes: OpportunityType[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(200) headline?: string | null;
  @IsOptional() @IsString() @MaxLength(1500) summary?: string | null;
  @IsOptional() @IsString() @MaxLength(120) currentStatus?: string | null;
  @IsOptional() @IsString() @MaxLength(200) university?: string | null;
  @IsOptional() @IsString() @MaxLength(200) major?: string | null;
  @IsOptional() @IsInt() @Min(1980) @Max(2100) @Type(() => Number) graduationYear?: number | null;
  @IsOptional() @IsString() @MaxLength(120) location?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredIndustries?: string[];
  @IsOptional() @IsArray() @IsEnum(WorkMode, { each: true }) preferredWorkModes?: WorkMode[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredLocations?: string[];
  @IsOptional() @IsArray() @IsEnum(OpportunityType, { each: true }) preferredRoleTypes?: OpportunityType[];
  @IsOptional() @IsString() @MaxLength(2000) additionalContext?: string | null;
  @IsOptional() @nullableUrl() @IsUrl({ require_protocol: true }) linkedinUrl?: string | null;
  @IsOptional() @nullableUrl() @IsUrl({ require_protocol: true }) portfolioUrl?: string | null;
  @IsOptional() @nullableUrl() @IsUrl({ require_protocol: true }) githubUrl?: string | null;
}

export class ExperienceDto {
  @IsEnum(ExperienceType) type!: ExperienceType;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(200) organization!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() current?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
}

export class UpdateExperienceDto {
  @IsOptional() @IsEnum(ExperienceType) type?: ExperienceType;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(200) organization?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @ValidateIf((o) => o.endDate !== null) @IsDateString() endDate?: string | null;
  @IsOptional() @IsBoolean() current?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
}

export class EducationDto {
  @IsString() @MinLength(2) @MaxLength(200) institution!: string;
  @IsOptional() @IsString() @MaxLength(200) degree?: string;
  @IsOptional() @IsString() @MaxLength(200) field?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @MaxLength(40) gpa?: string;
}

export class AchievementDto {
  @IsEnum(AchievementType) type!: AchievementType;
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(200) issuer?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) url?: string;
}

export class UserSkillDto {
  @IsString() @MinLength(2) skillSlug!: string;
  @IsInt() @Min(0) @Max(100) @Type(() => Number) level!: number;
}

export class GoalDto {
  @IsString() @MinLength(2) roleSlug!: string;
}

@Controller()
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly goals: GoalsService,
    private readonly prisma: PrismaService,
  ) {}

  // ----- Profile & Career Intelligence -----
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.profiles.detail(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.id, dto);
  }

  @Post('profile/analyze')
  analyze(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeProfileDto) {
    return this.profiles.analyze(user.id, dto);
  }

  @Get('profile/intelligence')
  intelligence(@CurrentUser() user: AuthUser) {
    return this.profiles.intelligence(user.id);
  }

  // ----- Experiences / education / achievements -----
  @Post('experiences')
  addExperience(@CurrentUser() user: AuthUser, @Body() dto: ExperienceDto) {
    return this.profiles.addExperience(user.id, dto);
  }

  @Patch('experiences/:id')
  updateExperience(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExperienceDto) {
    return this.profiles.updateExperience(user.id, id, dto);
  }

  @Delete('experiences/:id')
  removeExperience(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeExperience(user.id, id);
  }

  @Post('education')
  addEducation(@CurrentUser() user: AuthUser, @Body() dto: EducationDto) {
    return this.profiles.addEducation(user.id, dto);
  }

  @Delete('education/:id')
  removeEducation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeEducation(user.id, id);
  }

  @Post('achievements')
  addAchievement(@CurrentUser() user: AuthUser, @Body() dto: AchievementDto) {
    return this.profiles.addAchievement(user.id, dto);
  }

  @Delete('achievements/:id')
  removeAchievement(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeAchievement(user.id, id);
  }

  // ----- Skills -----
  @Public()
  @Get('skills/catalog')
  async catalog() {
    const skills = await this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
    return skills.map(toSkillView);
  }

  @Post('skills')
  upsertSkill(@CurrentUser() user: AuthUser, @Body() dto: UserSkillDto) {
    return this.profiles.upsertSkill(user.id, dto.skillSlug, dto.level);
  }

  @Delete('skills/:id')
  removeSkill(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.removeSkill(user.id, id);
  }

  // ----- Career goals (My Orbits) -----
  @Public()
  @Get('roles')
  roles() {
    return this.goals.roles();
  }

  @Get('goals')
  listGoals(@CurrentUser() user: AuthUser) {
    return this.goals.list(user.id);
  }

  @Get('goals/compare')
  compare(@CurrentUser() user: AuthUser) {
    return this.goals.compare(user.id);
  }

  @Post('goals')
  addGoal(@CurrentUser() user: AuthUser, @Body() dto: GoalDto) {
    return this.goals.add(user.id, dto.roleSlug);
  }

  @Post('goals/:id/primary')
  setPrimary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.setPrimary(user.id, id);
  }

  @Delete('goals/:id')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.goals.archive(user.id, id);
  }
}

@Module({
  imports: [ProgressModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, GoalsService],
  exports: [ProfilesService, GoalsService],
})
export class ProfilesModule {}
