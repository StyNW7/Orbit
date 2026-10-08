import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import type { NextBestAction } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { questTemplateForSkill } from '../../catalog/roles.catalog';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';

const DAY = 86_400_000;

/**
 * Orbit's North Star question — "what should this user do next?" — answered
 * deterministically from long-term memory, in priority order:
 *   urgent deadlines → interview prep → current quest → top gap → journey → events.
 */
@Injectable()
export class NextBestActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
  ) {}

  async compute(userId: string, ctx?: CareerContext): Promise<NextBestAction | null> {
    const c = ctx ?? (await this.context.load(userId));
    const now = Date.now();
    const goal = c.primaryGoal;
    if (!goal) {
      return {
        title: 'Build your Career Intelligence',
        reason: 'Orbit needs your target role and experience to map your path.',
        expectedImpact: 'Unlocks readiness, your Career Universe and recommendations.',
        kind: 'PROFILE',
        actionLabel: 'Start onboarding',
        actionUrl: '/onboarding',
      };
    }

    // 1. Application deadline within 3 days
    const urgent = c.applications
      .filter((a) => ['SAVED', 'PREPARING'].includes(a.status) && a.deadline && a.deadline.getTime() - now < 3 * DAY && a.deadline.getTime() > now)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0];
    if (urgent) {
      return {
        title: `Submit your ${urgent.opportunity.title} application`,
        reason: `The deadline at ${urgent.opportunity.company} is ${format(urgent.deadline!, 'EEEE, d MMM')}.`,
        expectedImpact: 'Moves a high-match opportunity forward and raises Application Readiness.',
        kind: 'APPLICATION',
        actionLabel: 'Open application',
        actionUrl: `/app/discover/applications/${urgent.id}`,
      };
    }

    // 2. Interview stage without recent practice
    const interviewing = c.applications.find((a) => a.status === 'INTERVIEW');
    if (interviewing) {
      const recent = c.interviews.some((i) => i.applicationId === interviewing.id && now - i.createdAt.getTime() < 7 * DAY);
      if (!recent) {
        return {
          title: `Practise for your ${interviewing.opportunity.company} interview`,
          reason: 'You are in the interview stage and have not practised in the last week.',
          expectedImpact: 'Raises Interview Readiness with contextual questions for this role.',
          kind: 'INTERVIEW',
          actionLabel: 'Start practice',
          actionUrl: `/app/discover/applications/${interviewing.id}?practice=1`,
        };
      }
    }

    // 3. Next task of the current quest
    const journeyId = goal.journey?.id;
    if (journeyId) {
      const quests = await this.prisma.quest.findMany({
        where: { userId, milestone: { journeyId }, status: { not: 'COMPLETED' } },
        include: { tasks: { orderBy: { order: 'asc' } }, milestone: { select: { order: true } }, relatedSkill: true },
      });
      quests.sort(
        (a, b) =>
          Number(b.status === 'IN_PROGRESS') - Number(a.status === 'IN_PROGRESS') ||
          b.progress - a.progress ||
          a.milestone.order - b.milestone.order ||
          a.order - b.order,
      );
      const quest = quests[0];
      if (quest) {
        const task = quest.tasks.find((t) => !t.completed);
        const perTask = quest.tasks.length ? quest.skillGain / quest.tasks.length : 0;
        const impact = quest.relatedSkill && perTask > 0
          ? `+${Math.round(perTask)} ${quest.relatedSkill.name} proficiency and progress on ${quest.title}.`
          : `Progress on ${quest.title} (${quest.xp} XP on completion).`;
        if (task) {
          return {
            title: task.title,
            reason: `Next step in “${quest.title}” (${quest.progress}% complete).`,
            expectedImpact: impact,
            kind: 'QUEST_TASK',
            actionLabel: 'Open quest',
            actionUrl: `/app/journey?quest=${quest.id}`,
          };
        }
        return {
          title: `Complete “${quest.title}”`,
          reason: 'All tasks are done — confirm completion to claim your XP.',
          expectedImpact: `${quest.xp} XP and an updated Career Readiness.`,
          kind: 'QUEST_TASK',
          actionLabel: 'Complete quest',
          actionUrl: `/app/journey?quest=${quest.id}`,
        };
      }
    }

    // 4. Largest gap not yet in the journey
    const gap = this.context.gapsFor(c).find((g) => !g.inJourney);
    if (gap) {
      const simulated = new Map(c.skillLevels);
      simulated.set(gap.skillId, gap.requiredLevel);
      const delta = this.readiness.computeFor({ ...c, skillLevels: simulated }, goal).score - this.readiness.computeFor(c, goal).score;
      return {
        title: `Add ${gap.name} to your journey`,
        reason: `${gap.name} is your largest ${goal.role.title} gap (${gap.currentLevel} of ${gap.requiredLevel}).`,
        expectedImpact: `Career Readiness +${Math.max(0, Math.round(delta * 10) / 10)} estimated points when closed.`,
        kind: 'ADD_SKILL',
        actionLabel: 'Add to Journey',
        actionUrl: '/app/journey',
        action: { type: 'ADD_SKILL_TO_JOURNEY', payload: { skillSlug: gap.slug, questTitle: questTemplateForSkill(gap.slug).title } },
      };
    }

    // 5. No journey yet
    if (!journeyId) {
      return {
        title: `Generate your ${goal.role.title} Journey`,
        reason: 'Turn your gaps into milestones and quests.',
        expectedImpact: 'A clear weekly path toward career readiness.',
        kind: 'BUILD_JOURNEY',
        actionLabel: 'Build Journey',
        actionUrl: '/app/journey',
        action: { type: 'BUILD_JOURNEY', payload: {} },
      };
    }

    // 6. Relevant upcoming event
    const event = await this.prisma.event.findFirst({
      where: { startsAt: { gte: new Date(), lte: new Date(now + 7 * DAY) }, roleSlugs: { has: goal.role.slug } },
      orderBy: { startsAt: 'asc' },
    });
    if (event) {
      return {
        title: `Join ${event.title}`,
        reason: `Happening ${format(event.startsAt, 'EEEE, d MMM')} and relevant to ${goal.role.title}.`,
        expectedImpact: 'Builds knowledge and your network.',
        kind: 'EVENT',
        actionLabel: 'View event',
        actionUrl: `/app/discover?tab=growth&focus=${event.id}`,
      };
    }
    return null;
  }
}
