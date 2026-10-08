import { Injectable } from '@nestjs/common';
import { EvidenceType } from '@prisma/client';
import { XP_REWARDS, type QuestProgressResult, type QuestView } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import { questInclude, toQuestView } from '../../common/mappers';
import { AiService } from '../ai/ai.service';
import { SyncService } from '../graph/graph.module';
import { JourneysService } from '../journeys/journeys.service';
import { UsersService } from '../users/users.service';
import { questProgressFromTasks } from '../journeys/journey.planner';

export interface EvidenceInput {
  type: EvidenceType;
  url?: string;
  text?: string;
  fileId?: string;
}

@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly sync: SyncService,
    private readonly journeys: JourneysService,
    private readonly ai: AiService,
  ) {}

  private async load(userId: string, questId: string) {
    const quest = await this.prisma.quest.findFirst({
      where: { id: questId, userId },
      include: { ...questInclude, milestone: { select: { journeyId: true, journey: { select: { title: true, goal: { select: { role: { select: { title: true } } } } } } } } },
    });
    if (!quest) throw notFound('Quest');
    return quest;
  }

  async view(userId: string, questId: string): Promise<QuestView> {
    const q = await this.load(userId, questId);
    return toQuestView(q, q.milestone.journey?.goal.role.title ?? null);
  }

  /** The quest Mission Control should spotlight. */
  async current(userId: string): Promise<QuestView | null> {
    const goal = await this.prisma.careerGoal.findFirst({ where: { userId, isPrimary: true, status: 'ACTIVE' }, include: { journey: true, role: true } });
    if (!goal?.journey) return null;
    const quests = await this.prisma.quest.findMany({
      where: { userId, milestone: { journeyId: goal.journey.id }, status: { not: 'COMPLETED' } },
      include: { ...questInclude, milestone: { select: { journeyId: true, order: true } } },
    });
    if (!quests.length) return null;
    quests.sort(
      (a, b) =>
        Number(b.status === 'IN_PROGRESS') - Number(a.status === 'IN_PROGRESS') ||
        b.progress - a.progress ||
        a.milestone.order - b.milestone.order ||
        a.order - b.order,
    );
    return toQuestView(quests[0], goal.role.title);
  }

  async setTask(userId: string, questId: string, taskId: string, completed: boolean): Promise<QuestProgressResult> {
    const quest = await this.load(userId, questId);
    if (quest.status === 'COMPLETED') throw badRequest('This quest is already completed.');
    const task = quest.tasks.find((t) => t.id === taskId);
    if (!task) throw notFound('Task');
    if (task.completed === completed) return this.result(userId, questId, null, 0, false);

    await this.prisma.questTask.update({ where: { id: taskId }, data: { completed, completedAt: completed ? new Date() : null } });
    const tasks = quest.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t));
    const progress = questProgressFromTasks(tasks);
    await this.prisma.$transaction([
      this.prisma.quest.update({ where: { id: questId }, data: { progress, status: progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED' } }),
      this.prisma.questProgress.create({ data: { questId, userId, taskId, progressBefore: quest.progress, progressAfter: progress } }),
      this.prisma.careerJourney.update({ where: { id: quest.milestone.journeyId }, data: { lastProgressAt: new Date() } }),
    ]);
    await this.journeys.refreshMilestone(quest.milestoneId);

    let xpGained = 0;
    let leveledUp = false;
    if (completed) {
      const award = await this.users.award(userId, {
        type: 'TASK_COMPLETED',
        title: task.title,
        description: quest.title,
        xp: XP_REWARDS.TASK_COMPLETED,
        metadata: { questId, taskId },
      });
      xpGained = award.xpGained;
      leveledUp = award.leveledUp;
    } else {
      await this.users.revokeXp(userId, XP_REWARDS.TASK_COMPLETED);
      xpGained = -XP_REWARDS.TASK_COMPLETED;
    }
    const readiness = await this.sync.afterChange(userId, `task:${completed ? 'done' : 'undone'}`);
    return this.result(userId, questId, readiness, xpGained, leveledUp);
  }

  async submitEvidence(userId: string, questId: string, input: EvidenceInput) {
    const quest = await this.load(userId, questId);
    if (!input.url && !input.text && !input.fileId) throw badRequest('Add a link, a file or a short reflection as evidence.');
    if (input.fileId) {
      const file = await this.prisma.storedFile.findFirst({ where: { id: input.fileId, userId } });
      if (!file) throw notFound('File');
    }
    const review = await this.ai.generateText(
      'You are Orbit reviewing evidence for a career quest. In two sentences, say what the evidence demonstrates and one concrete improvement. Be encouraging but honest. You are not the final authority; the user confirms completion. No emoji.',
      JSON.stringify({ quest: quest.title, objective: quest.objective, requirement: quest.evidenceRequirement, evidence: { type: input.type, url: input.url, text: input.text?.slice(0, 1500) } }),
      160,
    );
    const evidence = await this.prisma.questEvidence.create({
      data: {
        questId,
        userId,
        type: input.type,
        url: input.url,
        text: input.text,
        fileId: input.fileId,
        aiReview: review,
        reviewStatus: review ? 'REVIEWED' : 'SKIPPED',
      },
    });
    await this.users.award(userId, { type: 'EVIDENCE_SUBMITTED', title: `Evidence added to “${quest.title}”`, xp: 0, metadata: { evidenceId: evidence.id } });
    await this.sync.afterChange(userId, 'evidence_submitted');
    return this.view(userId, questId);
  }

  /** User confirms completion (AI is never the sole authority on real-world achievements). */
  async complete(userId: string, questId: string, completeRemainingTasks: boolean): Promise<QuestProgressResult> {
    const quest = await this.load(userId, questId);
    if (quest.status === 'COMPLETED') throw badRequest('This quest is already completed.');
    const open = quest.tasks.filter((t) => !t.completed);
    if (open.length && !completeRemainingTasks) {
      throw badRequest(`Finish the remaining ${open.length} task${open.length === 1 ? '' : 's'} first, or confirm they are done.`);
    }
    if (quest.evidenceRequired && quest.evidence.length === 0) {
      throw badRequest('This quest needs evidence before it can be completed.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.questTask.updateMany({ where: { questId, completed: false }, data: { completed: true, completedAt: now } }),
      this.prisma.quest.update({ where: { id: questId }, data: { status: 'COMPLETED', progress: 100, completedAt: now } }),
      this.prisma.questProgress.create({ data: { questId, userId, progressBefore: quest.progress, progressAfter: 100, note: 'Quest completed' } }),
      this.prisma.careerJourney.update({ where: { id: quest.milestone.journeyId }, data: { lastProgressAt: now } }),
    ]);
    const award = await this.users.award(userId, {
      type: 'QUEST_COMPLETED',
      title: `Completed ${quest.title}`,
      xp: quest.xp,
      metadata: { questId, category: quest.category },
    });
    let xpGained = award.xpGained;
    let leveledUp = award.leveledUp;
    const milestone = await this.journeys.refreshMilestone(quest.milestoneId);
    if (milestone.completedNow) {
      const m = await this.prisma.milestone.findUniqueOrThrow({ where: { id: quest.milestoneId } });
      const bonus = await this.users.award(userId, { type: 'MILESTONE_COMPLETED', title: `Milestone reached: ${m.title}`, xp: XP_REWARDS.MILESTONE_COMPLETED });
      xpGained += bonus.xpGained;
      leveledUp = leveledUp || bonus.leveledUp;
    }
    // A completed skill quest becomes durable proficiency on the user's profile.
    if (quest.relatedSkillId && quest.skillGain > 0) {
      const existing = await this.prisma.userSkill.findUnique({ where: { userId_skillId: { userId, skillId: quest.relatedSkillId } } });
      if (!existing) {
        await this.users.award(userId, { type: 'SKILL_ACQUIRED', title: `Acquired ${quest.relatedSkill?.name ?? 'a new skill'}`, xp: 0 });
      }
    }
    const readiness = await this.sync.afterChange(userId, 'quest_completed', { recommendations: true });
    const result = await this.result(userId, questId, readiness, xpGained, leveledUp);
    return { ...result, milestoneCompleted: milestone.completedNow };
  }

  async update(userId: string, questId: string, data: { deadline?: string | null }) {
    await this.load(userId, questId);
    await this.prisma.quest.update({ where: { id: questId }, data: { deadline: data.deadline ? new Date(data.deadline) : null } });
    return this.view(userId, questId);
  }

  private async result(userId: string, questId: string, readiness: QuestProgressResult['readiness'], xpGained: number, leveledUp: boolean): Promise<QuestProgressResult> {
    return {
      quest: await this.view(userId, questId),
      readiness,
      xpGained,
      level: await this.users.level(userId),
      leveledUp,
      milestoneCompleted: false,
    };
  }
}
