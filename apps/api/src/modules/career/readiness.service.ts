import { Injectable } from '@nestjs/common';
import type { ReadinessResult } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config';
import { UsersService } from '../users/users.service';
import { computeReadiness, type ReadinessComputation } from '../readiness/readiness.engine';
import { CareerContextService, type CareerContext, type GoalWithRole } from './career-context.service';

const COMMUNICATION_SLUGS = ['communication', 'public-speaking'];
const READINESS_MILESTONES = [50, 60, 70, 75, 80, 85, 90];

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly config: AppConfig,
    private readonly users: UsersService,
  ) {}

  computeFor(ctx: CareerContext, goal: GoalWithRole): ReadinessComputation {
    const communicationIds = [...ctx.skillById.values()].filter((s) => COMMUNICATION_SLUGS.includes(s.slug)).map((s) => s.id);
    return computeReadiness(
      {
        role: {
          slug: goal.role.slug,
          title: goal.role.title,
          requirements: goal.role.requirements.map((r) => ({
            skillId: r.skillId,
            skillName: r.skill.name,
            requiredLevel: r.requiredLevel,
            importance: r.importance,
          })),
          experienceSignals: this.context.signalsFor(goal),
        },
        skillLevels: ctx.skillLevels,
        experiences: ctx.experiences,
        achievements: ctx.achievements,
        quests: ctx.quests.map((q) => ({ category: q.category, impact: q.impact, progress: q.progress })),
        evidence: ctx.evidence,
        knowledgeCompleted: ctx.knowledgeCompleted,
        educationCount: ctx.education.length,
        profile: {
          hasCv: Boolean(ctx.profile?.cvText || ctx.profile?.cvFileId),
          hasHeadline: Boolean(ctx.profile?.headline || ctx.profile?.summary),
          linkedinUrl: ctx.profile?.linkedinUrl ?? null,
          portfolioUrl: ctx.profile?.portfolioUrl ?? null,
          githubUrl: ctx.profile?.githubUrl ?? null,
          skillCount: ctx.userSkills.length,
        },
        applications: ctx.applications.map((a) => ({
          status: a.status,
          prepProgress: prepProgress(a.prepChecklist),
        })),
        interviews: ctx.interviews.map((i) => ({
          completed: i.status === 'COMPLETED',
          averageScore: averageScore(i.scores),
        })),
        weights: this.config.readinessWeights,
      },
      communicationIds,
    );
  }

  private toResult(goal: GoalWithRole, computation: ReadinessComputation, previousScore: number | null): ReadinessResult {
    return {
      score: computation.score,
      roleSlug: goal.role.slug,
      roleTitle: goal.role.title,
      breakdown: computation.breakdown,
      previousScore,
      computedAt: new Date().toISOString(),
    };
  }

  /** Current readiness for the primary goal (no snapshot written). */
  async current(userId: string, ctx?: CareerContext): Promise<ReadinessResult | null> {
    const c = ctx ?? (await this.context.load(userId));
    if (!c.primaryGoal) return null;
    const computation = this.computeFor(c, c.primaryGoal);
    const previous = await this.prisma.readinessSnapshot.findFirst({
      where: { userId, roleSlug: c.primaryGoal.role.slug, score: { not: computation.score } },
      orderBy: { createdAt: 'desc' },
      select: { score: true },
    });
    return this.toResult(c.primaryGoal, computation, previous?.score ?? null);
  }

  /** Recalculate, persist a snapshot when the score changed, and log readiness milestones. */
  async recalculate(userId: string, trigger: string, ctx?: CareerContext): Promise<ReadinessResult | null> {
    const c = ctx ?? (await this.context.load(userId));
    const goal = c.primaryGoal;
    if (!goal) return null;
    const computation = this.computeFor(c, goal);
    const latest = await this.prisma.readinessSnapshot.findFirst({
      where: { userId, roleSlug: goal.role.slug },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest || Math.abs(latest.score - computation.score) >= 0.1) {
      await this.prisma.readinessSnapshot.create({
        data: {
          userId,
          goalId: goal.id,
          roleSlug: goal.role.slug,
          score: computation.score,
          breakdown: Object.fromEntries(computation.breakdown.map((b) => [b.category, b.score])),
          trigger,
        },
      });
      const crossed = READINESS_MILESTONES.filter((m) => latest && latest.score < m && computation.score >= m).pop();
      if (crossed) {
        await this.users.award(userId, {
          type: 'READINESS_MILESTONE',
          title: `${goal.role.title} readiness reached ${crossed}%`,
          xp: 0,
          metadata: { score: computation.score },
        });
      }
    }
    return this.toResult(goal, computation, latest?.score ?? null);
  }

  scoresForGoals(ctx: CareerContext): Map<string, number> {
    return new Map(ctx.goals.map((g) => [g.id, this.computeFor(ctx, g).score]));
  }
}

export function prepProgress(checklist: unknown): number {
  const items = Array.isArray(checklist) ? (checklist as { done?: boolean }[]) : [];
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function averageScore(scores: unknown): number | null {
  if (!scores || typeof scores !== 'object') return null;
  const values = Object.values(scores as Record<string, number>).filter((v) => typeof v === 'number');
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}
