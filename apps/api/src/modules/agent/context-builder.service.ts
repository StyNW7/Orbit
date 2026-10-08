import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { skillLevelLabel, type AgentPageContext } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { NextBestActionService } from '../progress/next-best-action.service';
import { QuestsService } from '../quests/quests.service';

/**
 * Builds the concise Context Package sent to the agent before every turn.
 * Long-term memory lives in PostgreSQL; the LLM only ever sees this summary —
 * never the whole database.
 */
@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly nba: NextBestActionService,
    private readonly quests: QuestsService,
  ) {}

  async build(userId: string, pageContext?: AgentPageContext, ctx?: CareerContext) {
    const c = ctx ?? (await this.context.load(userId));
    const [readiness, currentQuest, nextBestAction, insights, notes] = await Promise.all([
      this.readiness.current(userId, c),
      this.quests.current(userId),
      this.nba.compute(userId, c),
      this.prisma.agentInsight.findMany({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 3 }),
      this.prisma.careerNote.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 3, select: { title: true, type: true } }),
    ]);
    const gaps = this.context.gapsFor(c).slice(0, 4);
    const strengths = this.context.strengthsFor(c).slice(0, 4);
    const now = Date.now();

    let pageEntity: Record<string, unknown> | null = null;
    if (pageContext?.entityId && pageContext.entityType) pageEntity = await this.pageEntity(userId, pageContext);

    return {
      today: format(new Date(), 'EEEE, d MMMM yyyy'),
      user: {
        name: c.user.name,
        status: c.profile?.currentStatus ?? (this.context.isStudent(c) ? 'Student' : null),
        headline: c.profile?.headline ?? null,
      },
      targetRole: c.primaryGoal?.role.title ?? null,
      otherOrbits: c.goals.filter((g) => !g.isPrimary).map((g) => g.role.title),
      careerReadiness: readiness ? Math.round(readiness.score) : null,
      readinessBreakdown: readiness ? Object.fromEntries(readiness.breakdown.map((b) => [b.label, b.score])) : null,
      topGaps: gaps.map((g) => ({ skill: g.name, current: g.currentLevel, required: g.requiredLevel, inJourney: g.inJourney })),
      strengths: strengths.map((s) => `${s.name} (${skillLevelLabel(s.level)})`),
      currentQuest: currentQuest
        ? {
            title: currentQuest.title,
            progress: currentQuest.progress,
            nextTask: currentQuest.tasks.find((t) => !t.completed)?.title ?? null,
          }
        : null,
      activeApplications: c.applications
        .filter((a) => !['REJECTED', 'WITHDRAWN'].includes(a.status))
        .slice(0, 5)
        .map((a) => ({
          role: a.opportunity.title,
          company: a.opportunity.company,
          stage: a.status,
          deadline: a.deadline ? format(a.deadline, 'EEE d MMM') : null,
          daysLeft: a.deadline ? Math.ceil((a.deadline.getTime() - now) / 86_400_000) : null,
        })),
      recentInsights: insights.map((i) => i.message),
      recentNotes: notes.map((n) => n.title),
      preferences: {
        workModes: c.profile?.preferredWorkModes ?? [],
        locations: c.profile?.preferredLocations ?? [],
        roleTypes: c.profile?.preferredRoleTypes ?? [],
      },
      nextBestAction: nextBestAction ? { title: nextBestAction.title, reason: nextBestAction.reason } : null,
      page: pageContext ? { name: pageContext.page, focus: pageContext.label ?? null, entity: pageEntity } : null,
    };
  }

  private async pageEntity(userId: string, page: AgentPageContext): Promise<Record<string, unknown> | null> {
    const id = page.entityId!;
    switch (page.entityType) {
      case 'node': {
        const node = await this.prisma.graphNode.findFirst({ where: { id, userId } });
        return node ? { type: node.type, label: node.label, details: node.metadataJson } : null;
      }
      case 'quest': {
        const quest = await this.prisma.quest.findFirst({ where: { id, userId }, include: { tasks: true } });
        return quest ? { quest: quest.title, progress: quest.progress, xp: quest.xp, openTasks: quest.tasks.filter((t) => !t.completed).map((t) => t.title) } : null;
      }
      case 'job': {
        const job = await this.prisma.opportunity.findUnique({ where: { id } });
        return job ? { job: job.title, company: job.company, type: job.employmentType, skills: job.skills, deadline: job.deadline?.toISOString() ?? null, opportunityId: job.id } : null;
      }
      case 'application': {
        const app = await this.prisma.application.findFirst({ where: { id, userId }, include: { opportunity: true } });
        return app ? { application: app.opportunity.title, company: app.opportunity.company, stage: app.status, opportunityId: app.opportunityId, applicationId: app.id } : null;
      }
      default:
        return null;
    }
  }
}

export type ContextPackage = Awaited<ReturnType<ContextBuilderService['build']>>;
