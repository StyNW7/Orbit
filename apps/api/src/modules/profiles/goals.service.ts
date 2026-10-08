import { Injectable } from '@nestjs/common';
import type { CareerGoalView, CareerRoleView, GoalComparison } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { toGoalView, toSkillView } from '../../common/mappers';
import { INTEREST_TO_ROLE } from '../../catalog/roles.catalog';
import { CareerContextService } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { SyncService } from '../graph/graph.module';
import { UsersService } from '../users/users.service';
import { scoreExperience } from '../readiness/readiness.engine';

/** Multiple career paths ("My Orbits") with exactly one primary goal. */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly sync: SyncService,
    private readonly users: UsersService,
  ) {}

  async roles(): Promise<CareerRoleView[]> {
    const roles = await this.prisma.careerRole.findMany({
      include: { requirements: { include: { skill: true }, orderBy: { importance: 'desc' } } },
      orderBy: { title: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      family: r.family,
      description: r.description,
      icon: r.icon,
      requirements: r.requirements.map((q) => ({ skill: toSkillView(q.skill), requiredLevel: q.requiredLevel, importance: q.importance })),
    }));
  }

  async list(userId: string): Promise<CareerGoalView[]> {
    const ctx = await this.context.load(userId);
    const scores = this.readiness.scoresForGoals(ctx);
    return ctx.goals.map((g) => toGoalView(g, scores.get(g.id) ?? null));
  }

  /** Used by onboarding: make this role the primary orbit. */
  async setPrimaryByRole(userId: string, roleId: string, motivation: string | null) {
    await this.prisma.$transaction(async (tx) => {
      await tx.careerGoal.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
      await tx.careerGoal.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: { isPrimary: true, status: 'ACTIVE', motivation: motivation ?? undefined },
        create: { userId, roleId, isPrimary: true, motivation },
      });
    });
    const role = await this.prisma.careerRole.findUniqueOrThrow({ where: { id: roleId } });
    await this.users.award(userId, { type: 'GOAL_SET', title: `Set ${role.title} as primary career goal`, xp: 0 });
  }

  async add(userId: string, roleSlug: string): Promise<CareerGoalView[]> {
    const role = await this.prisma.careerRole.findUnique({ where: { slug: roleSlug } });
    if (!role) throw notFound('Career role');
    const count = await this.prisma.careerGoal.count({ where: { userId, status: 'ACTIVE' } });
    if (count >= 4) throw badRequest('You can explore up to four orbits at a time. Archive one first.');
    await this.prisma.careerGoal.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: { status: 'ACTIVE' },
      create: { userId, roleId: role.id, isPrimary: count === 0 },
    });
    await this.sync.afterChange(userId, 'goal_added', { recommendations: true });
    return this.list(userId);
  }

  /** Changing the primary career direction is a major write — the UI and agent both confirm first. */
  async setPrimary(userId: string, goalId: string): Promise<CareerGoalView[]> {
    const goal = await this.prisma.careerGoal.findFirst({ where: { id: goalId, userId }, include: { role: true } });
    if (!goal) throw notFound('Career goal');
    await this.setPrimaryByRole(userId, goal.roleId, goal.motivation);
    await this.sync.afterChange(userId, 'primary_goal_changed', { recommendations: true });
    return this.list(userId);
  }

  async archive(userId: string, goalId: string): Promise<CareerGoalView[]> {
    const goal = await this.prisma.careerGoal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw notFound('Career goal');
    if (goal.isPrimary) throw badRequest('Choose another primary orbit before archiving this one.');
    await this.prisma.careerGoal.update({ where: { id: goalId }, data: { status: 'ARCHIVED' } });
    await this.sync.afterChange(userId, 'goal_archived', { recommendations: true });
    return this.list(userId);
  }

  async compare(userId: string): Promise<GoalComparison> {
    const ctx = await this.context.load(userId);
    const interests = new Set((ctx.profile?.interests ?? []).map((i) => INTEREST_TO_ROLE[i]).filter(Boolean));
    const rows = await Promise.all(
      ctx.goals.map(async (g) => {
        const computation = this.readiness.computeFor(ctx, g);
        const gaps = this.context.gapsFor(ctx, g);
        const shortfall = gaps.reduce((s, gap) => s + (gap.requiredLevel - gap.currentLevel), 0);
        const exp = scoreExperience({
          role: { slug: g.role.slug, title: g.role.title, requirements: [], experienceSignals: this.context.signalsFor(g) },
          skillLevels: ctx.skillLevels,
          experiences: ctx.experiences,
          achievements: [],
          quests: [],
          evidence: [],
          knowledgeCompleted: 0,
          educationCount: 0,
          profile: { hasCv: false, hasHeadline: false, linkedinUrl: null, portfolioUrl: null, githubUrl: null, skillCount: 0 },
          applications: [],
          interviews: [],
        });
        const missing = exp.details.find((d) => d.endsWith('missing')) ?? exp.details.find((d) => d.endsWith('partially met'));
        const opportunityCount = await this.prisma.opportunity.count({ where: { isActive: true, roleSlugs: { has: g.role.slug } } });
        const preferenceAlignment = interests.has(g.role.slug) ? 100 : g.isPrimary ? 80 : 55;
        return {
          goal: toGoalView(g, computation.score),
          readiness: computation.score,
          skillGaps: gaps.length,
          topGaps: gaps.slice(0, 3).map((x) => x.name),
          experienceGap: missing ? missing.replace(/: (missing|partially met)$/, '') : 'Experience requirements met',
          // ~8 proficiency points per focused week of practice
          estimatedPreparationWeeks: Math.max(1, Math.round(shortfall / 8)),
          opportunityCount,
          preferenceAlignment,
        };
      }),
    );
    return { goals: rows.sort((a, b) => Number(b.goal.isPrimary) - Number(a.goal.isPrimary) || b.readiness - a.readiness) };
  }
}
