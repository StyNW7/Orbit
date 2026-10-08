import { Injectable } from '@nestjs/common';
import type { AgentAction, NodeType, Prisma, QuestCategory, SavedKind } from '@prisma/client';
import type { AgentActionType, ApplicationStatus, ConfirmActionResult } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { toActionView } from '../../common/mappers';
import { ApplicationsService } from '../applications/applications.module';
import { DiscoverService } from '../discover/discover.service';
import { GraphService } from '../graph/graph.service';
import { SyncService } from '../graph/graph.module';
import { JourneysService } from '../journeys/journeys.service';
import { NotificationsService } from '../notifications/notifications.module';
import { GoalsService } from '../profiles/goals.service';
import { QuestsService } from '../quests/quests.service';

/**
 * Executes agent actions after explicit human confirmation. Every button the
 * agent renders maps to one of these real backend operations.
 */
@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journeys: JourneysService,
    private readonly quests: QuestsService,
    private readonly applications: ApplicationsService,
    private readonly notifications: NotificationsService,
    private readonly goals: GoalsService,
    private readonly graph: GraphService,
    private readonly discover: DiscoverService,
    private readonly sync: SyncService,
  ) {}

  async execute(userId: string, type: AgentActionType, payload: Record<string, unknown>): Promise<{ message: string; navigateTo: string | null }> {
    const str = (k: string) => (typeof payload[k] === 'string' ? (payload[k] as string) : undefined);
    switch (type) {
      case 'ADD_SKILL_TO_JOURNEY': {
        const skillSlug = str('skillSlug');
        if (!skillSlug) throw badRequest('Missing skill.');
        const r = await this.journeys.addSkill(userId, skillSlug);
        return { message: r.message, navigateTo: r.questId ? `/app/journey?quest=${r.questId}` : '/app/journey' };
      }
      case 'ADD_QUEST': {
        const title = str('title');
        if (!title) throw badRequest('Missing quest title.');
        const tasks = Array.isArray(payload.tasks) ? (payload.tasks as string[]).filter((t) => typeof t === 'string').slice(0, 10) : [];
        await this.journeys.addCustomQuest(
          userId,
          {
            title,
            description: str('description') ?? title,
            category: (str('category') as QuestCategory) ?? 'SKILL',
            skillSlug: str('skillSlug'),
            tasks: tasks.length ? tasks : ['Plan the first step', 'Do the work', 'Reflect on what you learned'],
          },
          'AGENT',
        );
        return { message: `Added “${title}” to your journey.`, navigateTo: '/app/journey' };
      }
      case 'BUILD_JOURNEY': {
        const j = await this.journeys.build(userId, str('goalId'));
        return { message: `Your ${j.title} is ready with ${j.milestones.length} milestones.`, navigateTo: '/app/journey' };
      }
      case 'SAVE_OPPORTUNITY': {
        const opportunityId = str('opportunityId');
        if (!opportunityId) throw badRequest('Missing opportunity.');
        const app = await this.applications.create(userId, opportunityId);
        const reminder = app.reminderScheduledAt ? ' A deadline reminder is scheduled.' : '';
        return { message: `Saved ${app.opportunity.title} to your applications.${reminder}`, navigateTo: `/app/discover/applications/${app.id}` };
      }
      case 'UPDATE_APPLICATION_STATUS': {
        const applicationId = str('applicationId');
        const status = str('status') as ApplicationStatus | undefined;
        if (!applicationId || !status) throw badRequest('Missing application or status.');
        const app = await this.applications.update(userId, applicationId, { status });
        return { message: `${app.opportunity.title} moved to ${status.toLowerCase()}.`, navigateTo: `/app/discover/applications/${app.id}` };
      }
      case 'CREATE_REMINDER': {
        const title = str('title');
        const when = str('scheduledAt');
        if (!title || !when || Number.isNaN(Date.parse(when))) throw badRequest('Missing reminder title or time.');
        await this.notifications.create(userId, {
          type: 'CUSTOM_REMINDER',
          title,
          message: str('message') ?? 'Reminder from Orbit',
          actionUrl: str('actionUrl') ?? null,
          scheduledAt: new Date(when),
        });
        return { message: `Reminder set: ${title}.`, navigateTo: null };
      }
      case 'SET_PRIMARY_GOAL': {
        const goalId = str('goalId');
        if (!goalId) throw badRequest('Missing goal.');
        const goals = await this.goals.setPrimary(userId, goalId);
        const primary = goals.find((g) => g.isPrimary);
        return { message: `${primary?.role.title ?? 'This role'} is now your primary orbit.`, navigateTo: '/app' };
      }
      case 'ADD_CAREER_GOAL': {
        const roleSlug = str('roleSlug');
        if (!roleSlug) throw badRequest('Missing role.');
        await this.goals.add(userId, roleSlug);
        return { message: 'Added a new orbit to explore.', navigateTo: '/app/journey?view=orbits' };
      }
      case 'UPDATE_QUEST_PROGRESS': {
        const questId = str('questId');
        const taskId = str('taskId');
        if (!questId || !taskId) throw badRequest('Missing quest task.');
        const r = await this.quests.setTask(userId, questId, taskId, payload.completed !== false);
        return { message: `Progress updated: ${r.quest.title} is ${r.quest.progress}% complete.`, navigateTo: `/app/journey?quest=${questId}` };
      }
      case 'ADD_GRAPH_NODE': {
        const label = str('label');
        if (!label) throw badRequest('Missing node label.');
        await this.graph.addNode(userId, { type: (str('nodeType') as NodeType) ?? 'SKILL', label, description: str('description') }, 'AGENT');
        return { message: `Added ${label} to your Career Universe.`, navigateTo: '/app/universe' };
      }
      case 'SAVE_RESOURCE': {
        const kind = str('kind') as SavedKind | undefined;
        const itemId = str('itemId');
        if (!kind || !itemId) throw badRequest('Missing item.');
        const saved = await this.discover.save(userId, kind, itemId);
        await this.sync.afterChange(userId, 'agent_saved_resource');
        return { message: `Saved “${saved.title}”.`, navigateTo: null };
      }
      case 'NAVIGATE':
        return { message: 'Opening…', navigateTo: str('url') ?? '/app' };
      default:
        throw badRequest('This action type is not supported.');
    }
  }

  /** Human-in-the-loop confirmation. */
  async confirm(userId: string, actionId: string): Promise<ConfirmActionResult> {
    const action = await this.owned(userId, actionId);
    if (!['PENDING_CONFIRMATION', 'SUGGESTED'].includes(action.status)) {
      throw badRequest(`This action was already ${action.status.toLowerCase().replace('_', ' ')}.`);
    }
    try {
      const result = await this.execute(userId, action.type as AgentActionType, action.payload as Record<string, unknown>);
      const updated = await this.prisma.agentAction.update({
        where: { id: actionId },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), executedAt: new Date(), outputSummary: result.message },
      });
      await this.markInsightActed(userId, action);
      return { action: toActionView(updated), message: result.message, navigateTo: result.navigateTo };
    } catch (error) {
      await this.prisma.agentAction.update({ where: { id: actionId }, data: { status: 'FAILED', error: (error as Error).message.slice(0, 500) } });
      throw error;
    }
  }

  async reject(userId: string, actionId: string) {
    const action = await this.owned(userId, actionId);
    if (!['PENDING_CONFIRMATION', 'SUGGESTED'].includes(action.status)) throw badRequest('This action is no longer pending.');
    const updated = await this.prisma.agentAction.update({ where: { id: actionId }, data: { status: 'REJECTED' } });
    return toActionView(updated);
  }

  /** Apply an insight's suggested action (the user clicked its button). */
  async applyInsight(userId: string, insightId: string): Promise<ConfirmActionResult> {
    const insight = await this.prisma.agentInsight.findFirst({ where: { id: insightId, userId } });
    if (!insight) throw notFound('Insight');
    const suggestion = insight.suggestedAction as { label: string; type: AgentActionType; payload: Record<string, unknown> } | null;
    if (!suggestion) throw badRequest('This insight has no suggested action.');
    const action = await this.prisma.agentAction.create({
      data: {
        userId,
        type: suggestion.type,
        tool: 'ui',
        level: 'WRITE',
        title: suggestion.label,
        description: insight.message,
        inputSummary: `Insight ${insight.id}`,
        payload: { ...suggestion.payload, insightId } as Prisma.InputJsonValue,
        status: 'PENDING_CONFIRMATION',
        confirmationRequired: true,
      },
    });
    return this.confirm(userId, action.id);
  }

  private async markInsightActed(userId: string, action: AgentAction) {
    const insightId = (action.payload as Record<string, unknown>)?.insightId;
    if (typeof insightId === 'string') {
      await this.prisma.agentInsight.updateMany({ where: { id: insightId, userId }, data: { status: 'ACTED' } });
    }
  }

  private async owned(userId: string, actionId: string) {
    const action = await this.prisma.agentAction.findFirst({ where: { id: actionId, userId } });
    if (!action) throw notFound('Action');
    return action;
  }
}
