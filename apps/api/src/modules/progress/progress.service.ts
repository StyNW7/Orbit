import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  APPLICATION_PIPELINE,
  READINESS_CATEGORIES,
  levelFromXp,
  type InsightView,
  type MissionControlData,
  type ProgressSummary,
  type ReadinessCategory,
  type TimelineItem,
  type UpcomingItem,
} from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toGoalView, toInsightView } from '../../common/mappers';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { DiscoverService } from '../discover/discover.service';
import { QuestsService } from '../quests/quests.service';
import { NextBestActionService } from './next-best-action.service';
import { L } from '../../common/i18n/locale';

const DAY = 86_400_000;
const TIMELINE_TYPES = [
  'PROFILE_ANALYZED',
  'GOAL_SET',
  'JOURNEY_STARTED',
  'QUEST_COMPLETED',
  'MILESTONE_COMPLETED',
  'SKILL_ACQUIRED',
  'EXPERIENCE_ADDED',
  'APPLICATION_UPDATED',
  'INTERVIEW_PRACTICED',
  'READINESS_MILESTONE',
  'RESOURCE_COMPLETED',
] as const;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly nba: NextBestActionService,
    private readonly discover: DiscoverService,
    private readonly quests: QuestsService,
  ) {}

  async streak(userId: string): Promise<{ current: number; longest: number; activeToday: boolean }> {
    const since = new Date(Date.now() - 365 * DAY);
    const [activities, progress, notes] = await Promise.all([
      this.prisma.activityLog.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.questProgress.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.careerNote.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);
    const days = new Set([...activities, ...progress, ...notes].map((r) => dayKey(r.createdAt)));
    const today = dayKey(new Date());
    const activeToday = days.has(today);
    let current = 0;
    for (let d = activeToday ? 0 : 1; ; d++) {
      if (days.has(dayKey(new Date(Date.now() - d * DAY)))) current++;
      else break;
    }
    let longest = 0;
    let run = 0;
    let prev: number | null = null;
    for (const key of [...days].sort()) {
      const t = new Date(key).getTime();
      run = prev !== null && t - prev === DAY ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = t;
    }
    return { current, longest, activeToday };
  }

  private async insight(userId: string, ctx: CareerContext): Promise<InsightView | null> {
    const latest = await this.prisma.agentInsight.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    if (latest && latest.type !== 'GAP') return toInsightView(latest);
    const gap = this.context.gapsFor(ctx)[0];
    if (!gap || !ctx.primaryGoal) return latest ? toInsightView(latest) : null;
    const jobs = await this.prisma.opportunity.count({ where: { isActive: true, skills: { has: gap.slug }, roleSlugs: { has: ctx.primaryGoal.role.slug } } });
    const total = await this.prisma.opportunity.count({ where: { isActive: true, roleSlugs: { has: ctx.primaryGoal.role.slug } } });
    // Re-written on every load, so the insight follows the user's current language.
    const role = ctx.primaryGoal.role.title;
    const message = L(`${gap.name} remains your largest skill gap.`, `${gap.name} masih menjadi gap skill terbesarmu.`);
    const evidence = [
      L(`Current level ${gap.currentLevel}, required ${gap.requiredLevel}`, `Level saat ini ${gap.currentLevel}, dibutuhkan ${gap.requiredLevel}`),
      L(`Appears in ${jobs} of ${total} ${role} openings Orbit tracks`, `Muncul di ${jobs} dari ${total} lowongan ${role} yang dipantau Orbit`),
    ];
    const addLabel = L('Add to Journey', 'Tambah ke Journey');
    const row = await this.prisma.agentInsight.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: `gap:${gap.slug}` } },
      update: {
        message,
        evidence,
        suggestedAction: gap.inJourney ? Prisma.DbNull : { label: addLabel, type: 'ADD_SKILL_TO_JOURNEY', payload: { skillSlug: gap.slug } },
      },
      create: {
        userId,
        type: 'GAP',
        dedupeKey: `gap:${gap.slug}`,
        title: L('Largest gap', 'Gap terbesar'),
        message,
        evidence,
        suggestedAction: gap.inJourney ? undefined : { label: addLabel, type: 'ADD_SKILL_TO_JOURNEY', payload: { skillSlug: gap.slug } },
      },
    });
    // Older gap insights for skills that are no longer the top gap are retired.
    await this.prisma.agentInsight.updateMany({
      where: { userId, type: 'GAP', status: 'ACTIVE', id: { not: row.id } },
      data: { status: 'DISMISSED' },
    });
    return row.status === 'ACTIVE' ? toInsightView(row) : null;
  }

  async upcoming(userId: string, ctx: CareerContext): Promise<UpcomingItem[]> {
    const now = new Date();
    const horizon = new Date(Date.now() + 21 * DAY);
    const [savedEvents, reminders, questDeadlines] = await Promise.all([
      this.prisma.savedOpportunity.findMany({ where: { userId, kind: 'EVENT', event: { startsAt: { gte: now } } }, include: { event: true } }),
      this.prisma.notification.findMany({ where: { userId, status: 'SCHEDULED', scheduledAt: { gte: now, lte: horizon } }, orderBy: { scheduledAt: 'asc' }, take: 3 }),
      this.prisma.quest.findMany({ where: { userId, status: { not: 'COMPLETED' }, deadline: { gte: now, lte: horizon } }, take: 3 }),
    ]);
    const items: UpcomingItem[] = [];
    for (const s of savedEvents) {
      items.push({ id: s.event!.id, kind: 'EVENT', title: s.event!.title, subtitle: s.event!.organizer, date: s.event!.startsAt.toISOString(), url: `/app/discover?tab=growth&focus=${s.event!.id}` });
    }
    if (ctx.primaryGoal && items.length < 2) {
      const event = await this.prisma.event.findFirst({
        where: { startsAt: { gte: now, lte: horizon }, roleSlugs: { has: ctx.primaryGoal.role.slug }, id: { notIn: items.map((i) => i.id) } },
        orderBy: { startsAt: 'asc' },
      });
      if (event) items.push({ id: event.id, kind: 'EVENT', title: event.title, subtitle: `${event.organizer} · ${L('recommended', 'direkomendasikan')}`, date: event.startsAt.toISOString(), url: `/app/discover?tab=growth&focus=${event.id}` });
    }
    for (const a of ctx.applications) {
      if (a.deadline && a.deadline > now && ['SAVED', 'PREPARING'].includes(a.status)) {
        items.push({ id: a.id, kind: 'APPLICATION_DEADLINE', title: L(`${a.opportunity.title} deadline`, `Tenggat ${a.opportunity.title}`), subtitle: a.opportunity.company, date: a.deadline.toISOString(), url: `/app/discover/applications/${a.id}` });
      }
    }
    for (const q of questDeadlines) items.push({ id: q.id, kind: 'QUEST_DEADLINE', title: q.title, subtitle: L('Quest deadline', 'Tenggat quest'), date: q.deadline!.toISOString(), url: `/app/journey?quest=${q.id}` });
    for (const r of reminders) items.push({ id: r.id, kind: 'REMINDER', title: r.title, subtitle: r.message, date: r.scheduledAt.toISOString(), url: r.actionUrl ?? '/app' });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }

  async missionControl(userId: string): Promise<MissionControlData> {
    const ctx = await this.context.load(userId);
    const [readiness, currentQuest, nextBestAction, insight, jobs, upcoming, streak] = await Promise.all([
      this.readiness.current(userId, ctx),
      this.quests.current(userId),
      this.nba.compute(userId, ctx),
      this.insight(userId, ctx),
      ctx.primaryGoal ? this.discover.jobs(userId, { limit: 20 }) : Promise.resolve([]),
      this.upcoming(userId, ctx),
      this.streak(userId),
    ]);
    const scores = this.readiness.scoresForGoals(ctx);
    return {
      firstName: ctx.user.name.split(' ')[0],
      primaryGoal: ctx.primaryGoal ? toGoalView(ctx.primaryGoal, scores.get(ctx.primaryGoal.id) ?? null) : null,
      readiness,
      currentQuest,
      nextBestAction,
      insight,
      opportunities: { highMatchCount: jobs.filter((j) => j.match.overall >= 75).length, top: jobs.slice(0, 3) },
      upcoming,
      level: levelFromXp(ctx.user.xp),
      streak: streak.current,
      hasJourney: Boolean(ctx.primaryGoal?.journey),
    };
  }

  async summary(userId: string): Promise<ProgressSummary> {
    const ctx = await this.context.load(userId);
    const roleSlug = ctx.primaryGoal?.role.slug;
    const [readiness, snapshots, activities, streak, completedQuests] = await Promise.all([
      this.readiness.current(userId, ctx),
      roleSlug ? this.prisma.readinessSnapshot.findMany({ where: { userId, roleSlug }, orderBy: { createdAt: 'asc' } }) : Promise.resolve([]),
      this.prisma.activityLog.findMany({ where: { userId, type: { in: [...TIMELINE_TYPES] } }, orderBy: { createdAt: 'desc' }, take: 60 }),
      this.streak(userId),
      this.prisma.quest.findMany({ where: { userId, status: 'COMPLETED', completedAt: { not: null }, skillGain: { gt: 0 }, progressLog: { some: {} } }, orderBy: { completedAt: 'desc' } }),
    ]);

    // One point per day (the last snapshot of that day).
    const byDay = new Map<string, (typeof snapshots)[number]>();
    for (const s of snapshots) byDay.set(dayKey(s.createdAt), s);
    const history = [...byDay.values()].map((s) => {
      const b = (s.breakdown ?? {}) as Record<string, number>;
      return {
        date: s.createdAt.toISOString(),
        score: Math.round(s.score * 10) / 10,
        breakdown: Object.fromEntries(READINESS_CATEGORIES.map((c) => [c, b[c] ?? 0])) as Record<ReadinessCategory, number>,
      };
    });

    // Quests pre-completed from the profile have no progress log and are not counted as achievements.
    const earnedWhere = { userId, status: 'COMPLETED' as const, completedAt: { not: null }, progressLog: { some: {} } };
    const [allCompleted, questsCompleted] = await Promise.all([
      this.prisma.quest.findMany({ where: earnedWhere, orderBy: { completedAt: 'desc' }, take: 20 }),
      this.prisma.quest.count({ where: earnedWhere }),
    ]);
    const skillsAcquired = ctx.userSkills
      .filter((us) => (ctx.skillLevels.get(us.skillId) ?? us.level) >= 46)
      .map((us) => ({ name: us.skill.name, level: ctx.skillLevels.get(us.skillId) ?? us.level, acquiredAt: us.createdAt.toISOString(), source: us.source }))
      .sort((a, b) => b.level - a.level);
    for (const q of completedQuests) {
      const skill = q.relatedSkillId ? ctx.skillById.get(q.relatedSkillId) : null;
      if (skill && !skillsAcquired.some((s) => s.name === skill.name)) {
        skillsAcquired.push({ name: skill.name, level: ctx.skillLevels.get(skill.id) ?? 0, acquiredAt: q.completedAt!.toISOString(), source: 'QUEST' });
      }
    }

    const funnel = APPLICATION_PIPELINE.map((status) => ({ status, count: 0 }));
    const order = APPLICATION_PIPELINE;
    for (const a of ctx.applications) {
      const reached = order.indexOf(a.status);
      // Funnel counts every stage an application has passed through.
      const history = Array.isArray(a.statusHistory) ? (a.statusHistory as { status: string }[]).map((h) => order.indexOf(h.status as never)) : [];
      const furthest = Math.max(reached, ...history);
      for (let i = 0; i <= furthest && i < funnel.length; i++) funnel[i].count++;
    }

    const timeline: TimelineItem[] = activities.map((a) => ({ id: a.id, date: a.createdAt.toISOString(), type: a.type, title: a.title, description: a.description, xp: a.xp }));
    for (const e of ctx.experiences) {
      if (!e.startDate) continue;
      timeline.push({
        id: `exp-${e.id}`,
        date: e.startDate.toISOString(),
        type: 'EXPERIENCE',
        title: `Started ${e.title}`,
        description: e.organization,
        xp: 0,
      });
    }
    timeline.sort((a, b) => b.date.localeCompare(a.date));

    const milestones = ctx.primaryGoal?.journey
      ? (
          await this.prisma.milestone.findMany({
            where: { journeyId: ctx.primaryGoal.journey.id },
            include: { quests: { select: { progress: true } } },
            orderBy: { order: 'asc' },
          })
        ).map((m) => ({ id: m.id, title: m.title, progress: m.quests.length ? Math.round(m.quests.reduce((s, q) => s + q.progress, 0) / m.quests.length) : 0 }))
      : [];

    return {
      readiness,
      history,
      level: levelFromXp(ctx.user.xp),
      streak,
      stats: {
        skillsAcquired: skillsAcquired.length,
        experiences: ctx.experiences.length,
        questsCompleted,
        applications: ctx.applications.length,
        interviews: ctx.interviews.filter((i) => i.status === 'COMPLETED').length + ctx.applications.filter((a) => a.status === 'INTERVIEW').length,
        offers: ctx.applications.filter((a) => a.status === 'OFFER').length,
        knowledgeCompleted: ctx.knowledgeCompleted,
      },
      skillsAcquired: skillsAcquired.slice(0, 16),
      completedQuests: allCompleted.map((q) => ({ id: q.id, title: q.title, xp: q.xp, completedAt: q.completedAt!.toISOString() })),
      applicationFunnel: funnel,
      milestones,
      timeline: timeline.slice(0, 40),
    };
  }
}
