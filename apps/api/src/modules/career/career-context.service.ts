import { Injectable } from '@nestjs/common';
import type {
  Achievement,
  Application,
  CareerGoal,
  CareerProfile,
  CareerRole,
  Education,
  Experience,
  InterviewSession,
  Opportunity,
  Quest,
  QuestEvidence,
  RoleSkillRequirement,
  Skill,
  UserSkill,
} from '@prisma/client';
import { skillLevelLabel, type SkillGapView, type StrengthView } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ExperienceSignal } from '../../catalog/roles.catalog';

export type RoleWithRequirements = CareerRole & { requirements: (RoleSkillRequirement & { skill: Skill })[] };
export type GoalWithRole = CareerGoal & { role: RoleWithRequirements; journey: { id: string } | null };
export type QuestWithSkill = Quest & { relatedSkill: Skill | null };

export interface CareerContext {
  user: { id: string; name: string; email: string; xp: number };
  profile: CareerProfile | null;
  education: Education[];
  experiences: Experience[];
  achievements: Achievement[];
  userSkills: (UserSkill & { skill: Skill })[];
  goals: GoalWithRole[];
  primaryGoal: GoalWithRole | null;
  quests: QuestWithSkill[];
  evidence: QuestEvidence[];
  applications: (Application & { opportunity: Opportunity })[];
  interviews: InterviewSession[];
  knowledgeCompleted: number;
  /** effective proficiency (base + quest progress) by skill id */
  skillLevels: Map<string, number>;
  /** effective proficiency by skill slug */
  skillLevelsBySlug: Map<string, number>;
  skillById: Map<string, Skill>;
  /** skill slugs that already have an active quest */
  journeySkillSlugs: Set<string>;
}

@Injectable()
export class CareerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<CareerContext> {
    const [user, profile, education, experiences, achievements, userSkills, goals, quests, evidence, applications, interviews, knowledgeCompleted] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, xp: true } }),
        this.prisma.careerProfile.findUnique({ where: { userId } }),
        this.prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
        this.prisma.experience.findMany({ where: { userId }, orderBy: [{ current: 'desc' }, { startDate: 'desc' }] }),
        this.prisma.achievement.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
        this.prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
        this.prisma.careerGoal.findMany({
          where: { userId, status: 'ACTIVE' },
          include: {
            role: { include: { requirements: { include: { skill: true }, orderBy: { importance: 'desc' } } } },
            journey: { select: { id: true } },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        }),
        this.prisma.quest.findMany({ where: { userId }, include: { relatedSkill: true } }),
        this.prisma.questEvidence.findMany({ where: { userId } }),
        this.prisma.application.findMany({ where: { userId }, include: { opportunity: true } }),
        this.prisma.interviewSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        this.prisma.savedOpportunity.count({
          where: { userId, status: 'COMPLETED', kind: { in: ['BOOK', 'PAPER', 'RESOURCE', 'EVENT'] } },
        }),
      ]);

    const skillById = new Map<string, Skill>();
    const skillLevels = new Map<string, number>();
    for (const us of userSkills) {
      skillById.set(us.skillId, us.skill);
      skillLevels.set(us.skillId, us.level);
    }
    for (const goal of goals) for (const r of goal.role.requirements) skillById.set(r.skillId, r.skill);

    // Quest progress adds proficiency to the related skill (reversible, deterministic).
    const journeySkillSlugs = new Set<string>();
    for (const q of quests) {
      if (!q.relatedSkillId || !q.relatedSkill) continue;
      skillById.set(q.relatedSkillId, q.relatedSkill);
      journeySkillSlugs.add(q.relatedSkill.slug);
      const gain = Math.round((q.progress / 100) * q.skillGain);
      if (gain > 0) skillLevels.set(q.relatedSkillId, Math.min(100, (skillLevels.get(q.relatedSkillId) ?? 0) + gain));
    }
    const skillLevelsBySlug = new Map<string, number>();
    for (const [id, level] of skillLevels) {
      const s = skillById.get(id);
      if (s) skillLevelsBySlug.set(s.slug, level);
    }

    return {
      user,
      profile,
      education,
      experiences,
      achievements,
      userSkills,
      goals,
      primaryGoal: goals.find((g) => g.isPrimary) ?? goals[0] ?? null,
      quests,
      evidence,
      applications,
      interviews,
      knowledgeCompleted,
      skillLevels,
      skillLevelsBySlug,
      skillById,
      journeySkillSlugs,
    };
  }

  gapsFor(ctx: CareerContext, goal: GoalWithRole | null = ctx.primaryGoal): SkillGapView[] {
    if (!goal) return [];
    return goal.role.requirements
      .map((r) => {
        const current = ctx.skillLevels.get(r.skillId) ?? 0;
        return {
          skillId: r.skillId,
          slug: r.skill.slug,
          name: r.skill.name,
          category: r.skill.category,
          currentLevel: current,
          requiredLevel: r.requiredLevel,
          importance: r.importance,
          severity: Math.round(r.importance * Math.max(0, (r.requiredLevel - current) / r.requiredLevel) * 100) / 100,
          inJourney: ctx.journeySkillSlugs.has(r.skill.slug),
        };
      })
      .filter((g) => g.currentLevel < g.requiredLevel)
      .sort((a, b) => b.severity - a.severity);
  }

  strengthsFor(ctx: CareerContext, goal: GoalWithRole | null = ctx.primaryGoal): StrengthView[] {
    const required = new Map(goal?.role.requirements.map((r) => [r.skillId, r.requiredLevel]) ?? []);
    const out: StrengthView[] = [];
    for (const [skillId, level] of ctx.skillLevels) {
      const skill = ctx.skillById.get(skillId);
      if (!skill || level < 55) continue;
      const req = required.get(skillId);
      out.push({
        skillId,
        name: skill.name,
        level,
        reason:
          req !== undefined
            ? level >= req
              ? `Meets the ${skillLevelLabel(req).toLowerCase()} level your target role expects`
              : `Close to the level your target role expects`
            : `${skillLevelLabel(level)} level from your experience`,
      });
    }
    return out.sort((a, b) => (required.has(b.skillId) ? 1 : 0) - (required.has(a.skillId) ? 1 : 0) || b.level - a.level).slice(0, 6);
  }

  signalsFor(goal: GoalWithRole): ExperienceSignal[] {
    return (goal.role.experienceSignals as unknown as ExperienceSignal[]) ?? [];
  }

  isStudent(ctx: CareerContext): boolean {
    const status = `${ctx.profile?.currentStatus ?? ''} ${ctx.profile?.headline ?? ''}`.toLowerCase();
    if (/student|undergraduate|mahasiswa|fresh graduate/.test(status)) return true;
    const now = new Date();
    return ctx.education.some((e) => !e.endDate || e.endDate > now);
  }

  hasTechnicalBackground(ctx: CareerContext): boolean {
    const fields = ctx.education.map((e) => `${e.field ?? ''} ${e.degree ?? ''}`).join(' ').toLowerCase();
    if (/computer|informatics|engineering|information|software|data|science|teknik|informatika/.test(fields)) return true;
    const tech = ['ENGINEERING', 'AI', 'DATA'];
    return [...ctx.skillLevels].some(([id, lvl]) => lvl >= 50 && tech.includes(ctx.skillById.get(id)?.category ?? ''));
  }
}
