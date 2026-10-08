import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventType, OpportunityType, PersonKind, ResourceType, SavedKind, SavedStatus, WorkMode } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { JobsService } from '../opportunities/jobs.service';
import { SyncService } from '../graph/graph.module';
import { CareerContextService } from '../career/career-context.service';
import { DiscoverService } from './discover.service';

class JobsQuery {
  @IsOptional() @IsEnum(OpportunityType) type?: OpportunityType;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

class GrowthQuery {
  @IsOptional() @IsIn([...Object.values(EventType), ...Object.values(ResourceType)]) type?: string;
}

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

class PeopleQuery {
  @IsOptional() @IsEnum(PersonKind) kind?: PersonKind;
}

class SaveDto {
  @IsEnum(SavedKind) kind!: SavedKind;
  @IsUUID() itemId!: string;
}

class SavedStatusDto {
  @IsEnum(SavedStatus) status!: SavedStatus;
}

@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly discover: DiscoverService,
    private readonly jobsService: JobsService,
    private readonly sync: SyncService,
    private readonly context: CareerContextService,
  ) {}

  @Get('highlights')
  highlights(@CurrentUser() user: AuthUser) {
    return this.discover.highlights(user.id);
  }

  @Get('jobs')
  jobs(@CurrentUser() user: AuthUser, @Query() query: JobsQuery) {
    return this.discover.jobs(user.id, query);
  }

  @Get('jobs/:id')
  job(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.discover.job(user.id, id);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('jobs/refresh')
  async refresh(@CurrentUser() user: AuthUser) {
    const ctx = await this.context.load(user.id);
    const results = await this.jobsService.refresh(ctx.goals.map((g) => g.role.slug));
    await this.sync.afterChange(user.id, 'opportunities_refreshed', { recommendations: true });
    return results;
  }

  @Get('growth')
  growth(@CurrentUser() user: AuthUser, @Query() query: GrowthQuery) {
    return this.discover.growth(user.id, query.type);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('books')
  books(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.discover.books(user.id, query.q);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('papers')
  papers(@CurrentUser() user: AuthUser, @Query() query: SearchQuery) {
    return this.discover.papers(user.id, query.q);
  }

  @Get('people')
  people(@CurrentUser() user: AuthUser, @Query() query: PeopleQuery) {
    return this.discover.people(user.id, query.kind);
  }

  @Get('saved')
  saved(@CurrentUser() user: AuthUser) {
    return this.discover.savedViews(user.id);
  }

  @Post('saved')
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveDto) {
    const saved = await this.discover.save(user.id, dto.kind, dto.itemId);
    await this.sync.afterChange(user.id, `saved:${dto.kind.toLowerCase()}`);
    return saved;
  }

  @Patch('saved/:id')
  async updateSaved(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SavedStatusDto) {
    const saved = await this.discover.updateSaved(user.id, id, dto.status);
    await this.sync.afterChange(user.id, 'saved_status');
    return saved;
  }

  @Delete('saved/:id')
  async unsave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.discover.unsave(user.id, id);
    await this.sync.afterChange(user.id, 'unsaved');
    return result;
  }
}

@Module({ controllers: [DiscoverController] })
export class DiscoverModule {}
