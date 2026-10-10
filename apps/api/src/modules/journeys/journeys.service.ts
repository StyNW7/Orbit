import { Injectable } from '@nestjs/common';
import type { CareerJourney, Prisma, ProgressStatus } from '@prisma/client';
import type { AddSkillToJourneyResult, JourneyDetail, MilestoneView, QuestCategory } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { questInclude, toGoalView, toQuestView } from '../../common/mappers';
import { ROLE_BY_SLUG, type RoleDefinition } from '../../catalog/roles.catalog';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import { CareerContextService, type CareerContext, type GoalWithRole } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { SyncService } from '../graph/graph.module';
import { UsersService } from '../users/users.service';
import { milestoneProgress, planJourney, planSkillAddition, type PlannedMilestone } from './journey.planner';
import { L } from '../../common/i18n/locale';

export interface CustomQuestInput {
  title: string;
  description: string;
  category?: QuestCategory;
  skillSlug?: string;
  tasks: string[];
  xp?: number;
  milestoneId?: string;
}

@Injectable()
export class JourneysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly sync: SyncService,
    private readonly users: UsersService,
  ) {}

  private roleDefinition(goal: GoalWithRole): RoleDefinition {
    const def = ROLE_BY_SLUG.get(goal.role.slug);
    if (def) return def;
    // Roles created outside the catalog fall back to their stored template.
    return {
      slug: goal.role.slug,
      title: goal.role.title,
      family: goal.role.family,
      description: goal.role.description,
      icon: goal.role.icon,
      keywords: goal.role.keywords,
      requirements: goal.role.requirements.map((r) => ({ skill: r.skill.slug, level: r.requiredLevel, importance: r.importance })),
      experienceSignals: this.context.signalsFor(goal),
      journey: (goal.role.journeyTemplate as unknown as RoleDefinition['journey']) ?? [],
    };
  }

  private async existingShape(journeyId: string) {
    const milestones = await this.prisma.milestone.findMany({ where: { journeyId }, include: { quests: { select: { key: true } } } });
    return { milestones: new Map(milestones.map((m) => [m.key, new Set(m.quests.map((q) => q.key))])) };
  }

  private async ensureJourney(userId: string, goal: GoalWithRole): Promise<{ journey: CareerJourney; created: boolean }> {
    const existing = await this.prisma.careerJourney.findUnique({ where: { goalId: goal.id } });
    if (existing) return { journey: existing, created: false };
    const journey = await this.prisma.careerJourney.create({
      data: { userId, goalId: goal.id, title: `${goal.role.title} Journey`, lastProgressAt: new Date() },
    });
    await this.users.award(userId, { type: 'JOURNEY_STARTED', title: `Started ${goal.role.title} Journey`, xp: 0 });
    return { journey, created: true };
  }

  /** Persist planned milestones/quests. Idempotent by milestone and quest keys. */
  private async applyPlan(userId: string, journeyId: string, plan: PlannedMilestone[]): Promise<{ milestoneIds: Map<string, string>; questIds: string[] }> {
    const skills = await this.prisma.skill.findMany({ select: { id: true, slug: true } });
    const skillId = new Map(skills.map((s) => [s.slug, s.id]));
    const milestoneIds = new Map<string, string>();
    const questIds: string[] = [];
    const now = new Date();

    for (const m of plan) {
      const milestone = await this.prisma.milestone.upsert({
        where: { journeyId_key: { journeyId, key: m.key } },
        update: {},
        create: {
          journeyId,
          key: m.key,
          title: m.title,
          description: m.description,
          order: m.order,
          impact: m.impact,
          skillId: m.skillSlug ? skillId.get(m.skillSlug) ?? null : null,
        },
      });
      milestoneIds.set(m.key, milestone.id);
      for (const q of m.quests) {
        const done = q.preCompleted;
        const quest = await this.prisma.quest.create({
          data: {
            milestoneId: milestone.id,
            userId,
            key: q.key,
            title: q.title,
            description: q.description,
            objective: q.objective,
            category: q.category,
            impact: q.impact,
            relatedSkillId: q.skillSlug ? skillId.get(q.skillSlug) ?? null : null,
            skillGain: done ? 0 : q.skillGain,
            estimatedEffort: q.effort,
            xp: q.xp,
            evidenceRequirement: q.evidenceRequirement ?? null,
            evidenceRequired: q.evidenceRequired ?? false,
            order: q.order,
            resources: (q.resources ?? []) as unknown as Prisma.InputJsonValue,
            status: done ? 'COMPLETED' : 'NOT_STARTED',
            progress: done ? 100 : 0,
            completedAt: done ? now : null,
            tasks: { create: q.tasks.map((title, order) => ({ title, order, completed: done, completedAt: done ? now : null })) },
          },
        });
        questIds.push(quest.id);
      }
      await this.refreshMilestone(milestone.id);
    }
    return { milestoneIds, questIds };
  }

  async refreshMilestone(milestoneId: string): Promise<{ status: ProgressStatus; completedNow: boolean }> {
    const milestone = await this.prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { quests: { select: { progress: true, status: true } } } });
    const allDone = milestone.quests.length > 0 && milestone.quests.every((q) => q.status === 'COMPLETED');
    const anyProgress = milestone.quests.some((q) => q.progress > 0);
    const status: ProgressStatus = allDone ? 'COMPLETED' : anyProgress ? 'IN_PROGRESS' : 'NOT_STARTED';
    const completedNow = status === 'COMPLETED' && milestone.status !== 'COMPLETED';
    if (status !== milestone.status) {
      await this.prisma.milestone.update({ where: { id: milestoneId }, data: { status, completedAt: status === 'COMPLETED' ? new Date() : null } });
    }
    return { status, completedNow };
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  async build(userId: string, goalId?: string): Promise<JourneyDetail> {
    const ctx = await this.context.load(userId);
    const goal = goalId ? ctx.goals.find((g) => g.id === goalId) : ctx.primaryGoal;
    if (!goal) throw badRequest('Set a career goal before building a journey.');
    const { journey } = await this.ensureJourney(userId, goal);
    const role = this.roleDefinition(goal);
    const gaps = this.context.gapsFor(ctx, goal).map((g) => ({ slug: g.slug, severity: g.severity }));
    const plan = planJourney(role, ctx.skillLevelsBySlug, gaps, await this.existingShape(journey.id));
    await this.applyPlan(userId, journey.id, plan);
    await this.sync.afterChange(userId, 'journey_built');
    return this.detail(userId, journey.id);
  }

  async addSkill(userId: string, skillSlug: string, goalId?: string): Promise<AddSkillToJourneyResult> {
    if (!SKILL_BY_SLUG.has(skillSlug)) {
      const exists = await this.prisma.skill.findUnique({ where: { slug: skillSlug } });
      if (!exists) throw notFound('Skill');
    }
    const ctx = await this.context.load(userId);
    const goal = goalId ? ctx.goals.find((g) => g.id === goalId) : ctx.primaryGoal;
    if (!goal) throw badRequest('Set a career goal first so Orbit knows which journey to add this to.');
    const { journey } = await this.ensureJourney(userId, goal);
    const role = this.roleDefinition(goal);
    const shape = await this.existingShape(journey.id);
    const planned = planSkillAddition(role, skillSlug, ctx.skillLevelsBySlug, shape);
    const skillName = SKILL_BY_SLUG.get(skillSlug)?.name ?? skillSlug;

    if (!planned) {
      const quest = await this.prisma.quest.findFirst({
        where: { userId, milestone: { journeyId: journey.id }, relatedSkill: { slug: skillSlug } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        journey: await this.detail(userId, journey.id),
        milestoneId: quest?.milestoneId ?? '',
        questId: quest?.id ?? '',
        created: false,
        message: `${skillName} is already in your ${goal.role.title} Journey.`,
      };
    }
    const { milestoneIds, questIds } = await this.applyPlan(userId, journey.id, [planned]);
    await this.prisma.careerJourney.update({ where: { id: journey.id }, data: { updatedAt: new Date() } });
    await this.sync.afterChange(userId, `skill_added:${skillSlug}`);
    return {
      journey: await this.detail(userId, journey.id),
      milestoneId: milestoneIds.get(planned.key)!,
      questId: questIds[0],
      created: true,
      message: L(
        `Added ${skillName} to your ${goal.role.title} Journey with the quest “${planned.quests[0].title}”.`,
        `${skillName} ditambahkan ke Journey ${goal.role.title}-mu dengan quest “${planned.quests[0].title}”.`,
      ),
    };
  }

  async addCustomQuest(userId: string, input: CustomQuestInput, source: 'USER' | 'AGENT' = 'USER'): Promise<JourneyDetail> {
    const ctx = await this.context.load(userId);
    if (!ctx.primaryGoal) throw badRequest('Set a career goal first.');
    const { journey } = await this.ensureJourney(userId, ctx.primaryGoal);
    let milestoneId = input.milestoneId;
    if (milestoneId) {
      const owned = await this.prisma.milestone.findFirst({ where: { id: milestoneId, journeyId: journey.id } });
      if (!owned) throw notFound('Milestone');
    } else {
      const count = await this.prisma.milestone.count({ where: { journeyId: journey.id } });
      const custom = await this.prisma.milestone.upsert({
        where: { journeyId_key: { journeyId: journey.id, key: 'personal-growth' } },
        update: {},
        create: { journeyId: journey.id, key: 'personal-growth', title: 'Personal Growth', description: 'Quests you and Orbit added along the way.', order: count * 10 + 5, impact: 'SKILL' },
      });
      milestoneId = custom.id;
    }
    const skill = input.skillSlug ? await this.prisma.skill.findUnique({ where: { slug: input.skillSlug } }) : null;
    const category = input.category ?? 'SKILL';
    await this.prisma.quest.create({
      data: {
        milestoneId,
        userId,
        key: `custom-${Date.now()}`,
        title: input.title,
        description: input.description,
        objective: input.description,
        category,
        impact: category === 'PROJECT' || category === 'PORTFOLIO' ? 'PORTFOLIO' : category === 'INTERVIEW' ? 'INTERVIEW' : category === 'EXPERIENCE' ? 'EXPERIENCE' : 'SKILL',
        relatedSkillId: skill?.id ?? null,
        skillGain: skill ? 25 : 0,
        estimatedEffort: `${Math.max(1, input.tasks.length)} hours`,
        xp: input.xp ?? 100,
        source: source === 'AGENT' ? 'AGENT' : 'USER',
        tasks: { create: input.tasks.map((title, order) => ({ title, order })) },
      },
    });
    await this.refreshMilestone(milestoneId);
    await this.sync.afterChange(userId, 'quest_added');
    return this.detail(userId, journey.id);
  }

  async remove(userId: string, journeyId: string) {
    const journey = await this.prisma.careerJourney.findFirst({ where: { id: journeyId, userId } });
    if (!journey) throw notFound('Journey');
    await this.prisma.careerJourney.delete({ where: { id: journeyId } });
    await this.sync.afterChange(userId, 'journey_deleted');
    return { removed: true };
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async primary(userId: string): Promise<JourneyDetail | null> {
    const goal = await this.prisma.careerGoal.findFirst({ where: { userId, isPrimary: true, status: 'ACTIVE' }, include: { journey: true } });
    if (!goal?.journey) return null;
    return this.detail(userId, goal.journey.id);
  }

  async list(userId: string): Promise<JourneyDetail[]> {
    const journeys = await this.prisma.careerJourney.findMany({ where: { userId, goal: { status: 'ACTIVE' } }, orderBy: { createdAt: 'asc' } });
    return Promise.all(journeys.map((j) => this.detail(userId, j.id)));
  }

  async detail(userId: string, journeyId: string, ctx?: CareerContext): Promise<JourneyDetail> {
    const journey = await this.prisma.careerJourney.findFirst({
      where: { id: journeyId, userId },
      include: {
        goal: { include: { role: true } },
        milestones: { orderBy: { order: 'asc' }, include: { quests: { orderBy: { order: 'asc' }, include: questInclude } } },
      },
    });
    if (!journey) throw notFound('Journey');
    const milestones: MilestoneView[] = journey.milestones.map((m) => {
      const quests = m.quests.map((q) => toQuestView(q, journey.goal.role.title));
      return {
        id: m.id,
        key: m.key,
        title: m.title,
        description: m.description,
        order: m.order,
        status: m.status,
        progress: milestoneProgress(quests),
        impact: m.impact,
        completedAt: m.completedAt?.toISOString() ?? null,
        quests,
      };
    });
    const allQuests = milestones.flatMap((m) => m.quests);
    const c = ctx ?? (await this.context.load(userId));
    const goal = c.goals.find((g) => g.id === journey.goalId);
    let canExpand = false;
    let readiness: number | null = null;
    if (goal) {
      const plan = planJourney(this.roleDefinition(goal), c.skillLevelsBySlug, [], await this.existingShape(journey.id));
      canExpand = plan.some((m) => m.quests.length > 0);
      readiness = this.readiness.computeFor(c, goal).score;
    }
    return {
      id: journey.id,
      title: journey.title,
      status: journey.status,
      goal: toGoalView({ ...journey.goal, journey: { id: journey.id } }, readiness),
      progress: milestoneProgress(milestones),
      totalXp: allQuests.reduce((s, q) => s + q.xp, 0),
      earnedXp: allQuests.filter((q) => q.status === 'COMPLETED').reduce((s, q) => s + q.xp, 0),
      milestones,
      canExpand,
      createdAt: journey.createdAt.toISOString(),
      updatedAt: journey.updatedAt.toISOString(),
    };
  }
}
