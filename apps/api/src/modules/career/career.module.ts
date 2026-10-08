import { Global, Module } from '@nestjs/common';
import { CareerContextService } from './career-context.service';
import { ReadinessService } from './readiness.service';
import { RecommendationService } from '../recommendations/recommendation.service';
import { JobsService } from '../opportunities/jobs.service';
import { DiscoverService } from '../discover/discover.service';

/** Core domain services shared by every feature module. */
@Global()
@Module({
  providers: [CareerContextService, ReadinessService, RecommendationService, JobsService, DiscoverService],
  exports: [CareerContextService, ReadinessService, RecommendationService, JobsService, DiscoverService],
})
export class CareerModule {}
