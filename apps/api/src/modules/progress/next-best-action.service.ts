import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { NextBestAction } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { questTemplateForSkill } from '../../catalog/roles.catalog';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { L, currentLocale } from '../../common/i18n/locale';

const DAY = 86_400_000;

/** "Friday, 12 Oct" in the request's language. */
const day = (d: Date) => (currentLocale() === 'id' ? format(d, 'EEEE, d MMM', { locale: idLocale }) : format(d, 'EEEE, d MMM'));

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
        title: L('Build your Career Intelligence', 'Bangun Career Intelligence-mu'),
        reason: L('Orbit needs your target role and experience to map your path.', 'Orbit membutuhkan target peran dan pengalamanmu untuk memetakan jalurmu.'),
        expectedImpact: L('Unlocks readiness, your Career Universe and recommendations.', 'Membuka skor kesiapan, Career Universe, dan rekomendasi.'),
        kind: 'PROFILE',
        actionLabel: L('Start onboarding', 'Mulai onboarding'),
        actionUrl: '/onboarding',
      };
    }

    // 1. Application deadline within 3 days
    const urgent = c.applications
      .filter((a) => ['SAVED', 'PREPARING'].includes(a.status) && a.deadline && a.deadline.getTime() - now < 3 * DAY && a.deadline.getTime() > now)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())[0];
    if (urgent) {
      return {
        title: L(`Submit your ${urgent.opportunity.title} application`, `Kirim lamaran ${urgent.opportunity.title}-mu`),
        reason: L(`The deadline at ${urgent.opportunity.company} is ${day(urgent.deadline!)}.`, `Tenggat di ${urgent.opportunity.company} jatuh pada ${day(urgent.deadline!)}.`),
        expectedImpact: L('Moves a high-match opportunity forward and raises Application Readiness.', 'Memajukan peluang dengan kecocokan tinggi dan menaikkan Kesiapan Lamaran.'),
        kind: 'APPLICATION',
        actionLabel: L('Open application', 'Buka lamaran'),
        actionUrl: `/app/discover/applications/${urgent.id}`,
      };
    }

    // 2. Interview stage without recent practice
    const interviewing = c.applications.find((a) => a.status === 'INTERVIEW');
    if (interviewing) {
      const recent = c.interviews.some((i) => i.applicationId === interviewing.id && now - i.createdAt.getTime() < 7 * DAY);
      if (!recent) {
        return {
          title: L(`Practise for your ${interviewing.opportunity.company} interview`, `Latihan untuk interview di ${interviewing.opportunity.company}`),
          reason: L('You are in the interview stage and have not practised in the last week.', 'Kamu sudah di tahap interview dan belum berlatih dalam seminggu terakhir.'),
          expectedImpact: L('Raises Interview Readiness with contextual questions for this role.', 'Menaikkan Kesiapan Interview dengan pertanyaan kontekstual untuk peran ini.'),
          kind: 'INTERVIEW',
          actionLabel: L('Start practice', 'Mulai latihan'),
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
        const impact =
          quest.relatedSkill && perTask > 0
            ? L(`+${Math.round(perTask)} ${quest.relatedSkill.name} proficiency and progress on ${quest.title}.`, `+${Math.round(perTask)} kemahiran ${quest.relatedSkill.name} dan progres di ${quest.title}.`)
            : L(`Progress on ${quest.title} (${quest.xp} XP on completion).`, `Progres di ${quest.title} (${quest.xp} XP saat selesai).`);
        if (task) {
          return {
            title: task.title,
            reason: L(`Next step in “${quest.title}” (${quest.progress}% complete).`, `Langkah berikutnya di “${quest.title}” (${quest.progress}% selesai).`),
            expectedImpact: impact,
            kind: 'QUEST_TASK',
            actionLabel: L('Open quest', 'Buka quest'),
            actionUrl: `/app/journey?quest=${quest.id}`,
          };
        }
        return {
          title: L(`Complete “${quest.title}”`, `Selesaikan “${quest.title}”`),
          reason: L('All tasks are done — confirm completion to claim your XP.', 'Semua tugas sudah selesai — konfirmasi untuk mengklaim XP-mu.'),
          expectedImpact: L(`${quest.xp} XP and an updated Career Readiness.`, `${quest.xp} XP dan Kesiapan Karier yang diperbarui.`),
          kind: 'QUEST_TASK',
          actionLabel: L('Complete quest', 'Selesaikan quest'),
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
        title: L(`Add ${gap.name} to your journey`, `Tambahkan ${gap.name} ke journey-mu`),
        reason: L(`${gap.name} is your largest ${goal.role.title} gap (${gap.currentLevel} of ${gap.requiredLevel}).`, `${gap.name} adalah gap terbesarmu untuk ${goal.role.title} (${gap.currentLevel} dari ${gap.requiredLevel}).`),
        expectedImpact: L(
          `Career Readiness +${Math.max(0, Math.round(delta * 10) / 10)} estimated points when closed.`,
          `Estimasi Kesiapan Karier +${Math.max(0, Math.round(delta * 10) / 10)} poin jika gap ini tertutup.`,
        ),
        kind: 'ADD_SKILL',
        actionLabel: L('Add to Journey', 'Tambah ke Journey'),
        actionUrl: '/app/journey',
        action: { type: 'ADD_SKILL_TO_JOURNEY', payload: { skillSlug: gap.slug, questTitle: questTemplateForSkill(gap.slug).title } },
      };
    }

    // 5. No journey yet
    if (!journeyId) {
      return {
        title: L(`Generate your ${goal.role.title} Journey`, `Buat Journey ${goal.role.title}-mu`),
        reason: L('Turn your gaps into milestones and quests.', 'Ubah gap-mu menjadi milestone dan quest.'),
        expectedImpact: L('A clear weekly path toward career readiness.', 'Jalur mingguan yang jelas menuju kesiapan karier.'),
        kind: 'BUILD_JOURNEY',
        actionLabel: L('Build Journey', 'Buat Journey'),
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
        title: L(`Join ${event.title}`, `Ikuti ${event.title}`),
        reason: L(`Happening ${day(event.startsAt)} and relevant to ${goal.role.title}.`, `Berlangsung ${day(event.startsAt)} dan relevan untuk ${goal.role.title}.`),
        expectedImpact: L('Builds knowledge and your network.', 'Menambah pengetahuan dan memperluas jaringanmu.'),
        kind: 'EVENT',
        actionLabel: L('View event', 'Lihat acara'),
        actionUrl: `/app/discover?tab=growth&focus=${event.id}`,
      };
    }
    return null;
  }
}
