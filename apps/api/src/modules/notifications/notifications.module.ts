import { Body, Controller, Get, Global, Injectable, Logger, Module, OnModuleInit, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { NotificationType, Prisma } from '@prisma/client';
import { CronJob } from 'cron';
import { format, getISOWeek } from 'date-fns';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { NotificationList } from '@orbit/shared';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { notFound } from '../../common/http/errors';
import { toNotificationView } from '../../common/mappers';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  scheduledAt?: Date;
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create an in-app notification now, or schedule it for later. Idempotent with dedupeKey. */
  async create(userId: string, input: NotificationInput) {
    const scheduledAt = input.scheduledAt ?? new Date();
    const future = scheduledAt.getTime() > Date.now() + 60_000;
    const data: Prisma.NotificationUncheckedCreateInput = {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl ?? null,
      scheduledAt,
      status: future ? 'SCHEDULED' : 'DELIVERED',
      deliveredAt: future ? null : new Date(),
      dedupeKey: input.dedupeKey ?? null,
    };
    if (input.dedupeKey) {
      return this.prisma.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: input.dedupeKey } },
        update: {},
        create: data,
      });
    }
    return this.prisma.notification.create({ data });
  }

  async list(userId: string): Promise<NotificationList> {
    const [items, unread, scheduled] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, status: { in: ['DELIVERED', 'READ'] } },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, status: 'DELIVERED' } }),
      this.prisma.notification.findMany({ where: { userId, status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' }, take: 20 }),
    ]);
    return { items: items.map(toNotificationView), unread, scheduled: scheduled.map(toNotificationView) };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw notFound('Notification');
    await this.prisma.notification.update({ where: { id }, data: { status: 'READ', readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, status: 'DELIVERED' }, data: { status: 'READ', readAt: new Date() } });
    return { ok: true };
  }

  async dismiss(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw notFound('Notification');
    await this.prisma.notification.update({ where: { id }, data: { status: 'DISMISSED' } });
    return { ok: true };
  }
}

/**
 * Reminder intelligence:  Scheduler → Check Rules → Create Notification → PostgreSQL → frontend polling.
 */
@Injectable()
export class NotificationScheduler implements OnModuleInit {
  private readonly logger = new Logger('Reminders');
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly registry: SchedulerRegistry,
    private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    if (process.env.ORBIT_DISABLE_SCHEDULER === 'true') return;
    const job = new CronJob(this.config.env.NOTIFICATION_CRON, () => void this.tick());
    this.registry.addCronJob('orbit-reminders', job as never);
    job.start();
    setTimeout(() => void this.tick(), 5_000);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const delivered = await this.prisma.notification.updateMany({
        where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      const users = await this.prisma.user.findMany({
        where: { lastActiveAt: { gte: new Date(Date.now() - 30 * DAY) } },
        select: { id: true },
      });
      for (const u of users) await this.runRules(u.id);
      if (delivered.count) this.logger.log(`Delivered ${delivered.count} scheduled reminder(s)`);
    } catch (error) {
      this.logger.error(`Reminder run failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async runRules(userId: string) {
    const now = new Date();
    const n = this.notifications;
    const [applications, savedEvents, quests, journeys] = await Promise.all([
      this.prisma.application.findMany({ where: { userId }, include: { opportunity: true } }),
      this.prisma.savedOpportunity.findMany({ where: { userId, kind: 'EVENT' }, include: { event: true } }),
      this.prisma.quest.findMany({ where: { userId, status: { not: 'COMPLETED' }, deadline: { not: null } } }),
      this.prisma.careerJourney.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    for (const a of applications) {
      const left = a.deadline ? a.deadline.getTime() - now.getTime() : null;
      if (left !== null && left > 0 && left < 3 * DAY && ['SAVED', 'PREPARING'].includes(a.status)) {
        await n.create(userId, {
          type: 'JOB_DEADLINE',
          title: `${a.opportunity.title} closes ${format(a.deadline!, 'EEE d MMM')}`,
          message: `${a.opportunity.company} application deadline is in ${Math.max(1, Math.round(left / DAY))} day(s).`,
          actionUrl: `/app/discover/applications/${a.id}`,
          dedupeKey: `deadline:${a.id}`,
        });
      }
      if (a.status === 'SAVED' && now.getTime() - a.createdAt.getTime() > 5 * DAY) {
        await n.create(userId, {
          type: 'SAVED_OPPORTUNITY',
          title: `Still interested in ${a.opportunity.title}?`,
          message: 'You saved this opportunity five days ago. Start preparing or archive it.',
          actionUrl: `/app/discover/applications/${a.id}`,
          dedupeKey: `saved-followup:${a.id}`,
        });
      }
      if (a.status === 'APPLIED' && a.appliedAt && now.getTime() - a.appliedAt.getTime() > 7 * DAY) {
        await n.create(userId, {
          type: 'APPLICATION_FOLLOW_UP',
          title: `Follow up with ${a.opportunity.company}`,
          message: `It has been a week since you applied for ${a.opportunity.title}. A short follow-up can help.`,
          actionUrl: `/app/discover/applications/${a.id}`,
          dedupeKey: `followup:${a.id}`,
        });
      }
    }

    for (const s of savedEvents) {
      const e = s.event;
      if (!e) continue;
      const left = e.startsAt.getTime() - now.getTime();
      if (left > 0 && left < 24 * HOUR) {
        await n.create(userId, {
          type: 'EVENT_REMINDER',
          title: `${e.title} starts ${format(e.startsAt, 'HH:mm')}`,
          message: `${e.organizer} · ${e.isOnline ? 'Online' : e.location ?? ''}`,
          actionUrl: `/app/discover?tab=growth&focus=${e.id}`,
          dedupeKey: `event:${e.id}`,
        });
      }
    }

    for (const q of quests) {
      const left = q.deadline!.getTime() - now.getTime();
      if (left > 0 && left < 2 * DAY) {
        await n.create(userId, {
          type: 'QUEST_DEADLINE',
          title: `Quest due soon: ${q.title}`,
          message: `${q.progress}% complete — due ${format(q.deadline!, 'EEE d MMM')}.`,
          actionUrl: `/app/journey?quest=${q.id}`,
          dedupeKey: `quest-deadline:${q.id}`,
        });
      }
    }

    const week = `${now.getUTCFullYear()}-${getISOWeek(now)}`;
    for (const j of journeys) {
      const last = j.lastProgressAt ?? j.createdAt;
      if (now.getTime() - last.getTime() > 7 * DAY) {
        await n.create(userId, {
          type: 'INACTIVE_JOURNEY',
          title: `Your ${j.title} is waiting`,
          message: 'No progress in over a week. One small task keeps your momentum.',
          actionUrl: '/app/journey',
          dedupeKey: `inactive:${j.id}:${week}`,
        });
      }
    }
    if (now.getDay() === 1 && journeys.length) {
      await n.create(userId, {
        type: 'WEEKLY_REVIEW',
        title: 'Your weekly career review',
        message: 'See how your readiness moved and pick this week’s focus.',
        actionUrl: '/app/progress',
        dedupeKey: `weekly:${week}`,
      });
    }
  }
}

class ReminderDto {
  @IsString() @MinLength(2) @MaxLength(140) title!: string;
  @IsOptional() @IsString() @MaxLength(400) message?: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(300) actionUrl?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post('reminders')
  async reminder(@CurrentUser() user: AuthUser, @Body() dto: ReminderDto) {
    const n = await this.notifications.create(user.id, {
      type: 'CUSTOM_REMINDER',
      title: dto.title,
      message: dto.message ?? 'Reminder from Orbit',
      actionUrl: dto.actionUrl ?? null,
      scheduledAt: new Date(dto.scheduledAt),
    });
    return toNotificationView(n);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post(':id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.dismiss(user.id, id);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
