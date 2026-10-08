import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config';
import { PrismaModule } from './common/prisma/prisma.service';
import { AllExceptionsFilter, ResponseEnvelopeInterceptor } from './common/http/http';
import { AiModule } from './modules/ai/ai.service';
import { UsersModule } from './modules/users/users.service';
import { AuthModule } from './modules/auth/auth.module';
import { CareerModule } from './modules/career/career.module';
import { GraphModule } from './modules/graph/graph.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JourneysModule } from './modules/journeys/journeys.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { DiscoverModule } from './modules/discover/discover.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { NotesModule } from './modules/notes/notes.module';
import { AgentModule } from './modules/agent/agent.module';
import { SearchModule } from './modules/search/search.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 240 }]),
    AiModule,
    UsersModule,
    AuthModule,
    CareerModule,
    GraphModule,
    FilesModule,
    NotificationsModule,
    JourneysModule,
    ProgressModule,
    ProfilesModule,
    DiscoverModule,
    ApplicationsModule,
    NotesModule,
    AgentModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
