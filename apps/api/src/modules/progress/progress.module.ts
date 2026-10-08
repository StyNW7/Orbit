import { Controller, Get, Module } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { JourneysModule } from '../journeys/journeys.module';
import { NextBestActionService } from './next-best-action.service';
import { ProgressService } from './progress.service';

@Controller()
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly nba: NextBestActionService,
  ) {}

  @Get('progress')
  summary(@CurrentUser() user: AuthUser) {
    return this.progress.summary(user.id);
  }

  @Get('mission-control')
  missionControl(@CurrentUser() user: AuthUser) {
    return this.progress.missionControl(user.id);
  }

  @Get('next-best-action')
  nextBestAction(@CurrentUser() user: AuthUser) {
    return this.nba.compute(user.id);
  }
}

@Module({
  imports: [JourneysModule],
  controllers: [ProgressController],
  providers: [ProgressService, NextBestActionService],
  exports: [ProgressService, NextBestActionService],
})
export class ProgressModule {}
