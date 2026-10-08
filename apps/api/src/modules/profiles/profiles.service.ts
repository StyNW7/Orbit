import { Injectable, Logger } from '@nestjs/common';
import type { ExperienceType, OpportunityType, Prisma, WorkMode } from '@prisma/client';
import type { AnalysisStep, AnalyzeProfileResult, CareerIntelligence, ProfileDetail, UserSkillView } from '@orbit/shared';
import { levelFromXp } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { badRequest, notFound } from '../../common/http/errors';
import {
  toAchievementView,
  toEducationView,
  toExperienceView,
  toGoalView,
  toProfileView,
  toSkillView,
} from '../../common/mappers';
import { AiService } from '../ai/ai.service';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { ReadinessService } from '../career/readiness.service';
import { SyncService } from '../graph/graph.module';
import { UsersService } from '../users/users.service';
import { NextBestActionService } from '../progress/next-best-action.service';
import { GoalsService } from './goals.service';
import {
  EXTRACTION_SYSTEM_PROMPT,
  ExtractedSchema,
  dedupeKey,
  estimateSkillLevels,
  heuristicExtract,
  parseDate,
  type ExtractedProfile,
} from './cv-extraction';

export interface AnalyzeInput {
  targetRoleSlug: string;
  cvText?: string;
  interests: string[];
  preferredIndustries: string[];
  preferredWorkModes: WorkMode[];
  preferredLocations: string[];
  preferredRoleTypes: OpportunityType[];
  additionalContext?: string;
}

export interface ProfileUpdate {
  name?: string;
  headline?: string | null;
  summary?: string | null;
  currentStatus?: string | null;
  university?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  location?: string | null;
  interests?: string[];
  preferredIndustries?: string[];
  preferredWorkModes?: WorkMode[];
  preferredLocations?: string[];
  preferredRoleTypes?: OpportunityType[];
  additionalContext?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger('Profiles');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly context: CareerContextService,
    private readonly readiness: ReadinessService,
    private readonly sync: SyncService,
    private readonly users: UsersService,
    private readonly nba: NextBestActionService,
    private readonly goals: GoalsService,
  ) {}

  // -------------------------------------------------------------------------
  // Onboarding analysis
  // -------------------------------------------------------------------------

  async analyze(userId: string, input: AnalyzeInput): Promise<AnalyzeProfileResult> {
    const role = await this.prisma.careerRole.findUnique({ where: { slug: input.targetRoleSlug } });
    if (!role) throw badRequest('Please choose a target role.');
    const steps: AnalysisStep[] = [];
    const existing = await this.prisma.careerProfile.findUnique({ where: { userId } });
    const cvText = (input.cvText?.trim() || existing?.cvText || '').slice(0, 30_000);

    // 1. Reading
    steps.push(
      cvText
        ? { id: 'extract', label: 'Reading your experience', status: 'done', detail: `Read ${cvText.length.toLocaleString()} characters from your CV.` }
        : { id: 'extract', label: 'Reading your experience', status: 'skipped', detail: 'No CV provided — using your answers only.' },
    );

    // 2. Structuring (AI with validation, heuristic fallback)
    let extracted: ExtractedProfile = { education: [], experiences: [], skills: [], achievements: [] };
    let source: 'AI' | 'HEURISTIC' | 'MANUAL' = 'MANUAL';
    if (cvText) {
      const heuristic = heuristicExtract(cvText);
      const aiResult = await this.ai.generateJson(EXTRACTION_SYSTEM_PROMPT, `CV TEXT:\n${cvText.slice(0, 12_000)}`, ExtractedSchema, 2500, 45_000);
      if (aiResult && (aiResult.experiences?.length ?? 0) + (aiResult.education?.length ?? 0) > 0) {
        extracted = {
          ...aiResult,
          education: aiResult.education ?? [],
          experiences: aiResult.experiences ?? [],
          skills: aiResult.skills ?? [],
          achievements: aiResult.achievements ?? [],
          linkedinUrl: aiResult.linkedinUrl ?? heuristic.linkedinUrl,
          githubUrl: aiResult.githubUrl ?? heuristic.githubUrl,
        };
        source = 'AI';
      } else {
        extracted = heuristic;
        source = 'HEURISTIC';
      }
      steps.push({
        id: 'structure',
        label: 'Mapping your strengths',
        status: 'done',
        detail: `${source === 'AI' ? 'AI extraction' : 'Structured parsing'} found ${extracted.experiences.length} experiences, ${extracted.education.length} education entries and ${extracted.achievements.length} achievements.`,
      });
    } else {
      steps.push({ id: 'structure', label: 'Mapping your strengths', status: 'skipped', detail: 'Add a CV later to map experiences automatically.' });
    }

    // 3. Skills
    const contextText = `${cvText}\n${input.additionalContext ?? ''}`;
    const skillLevels = contextText.trim() ? estimateSkillLevels(extracted, contextText) : [];
    await this.persistExtraction(userId, extracted, skillLevels);
    steps.push({ id: 'skills', label: 'Identifying career gaps', status: 'done', detail: `Mapped ${skillLevels.length} skills against ${role.title} requirements.` });

    // 4. Profile, preferences and goal
    await this.prisma.careerProfile.upsert({
      where: { userId },
      update: {
        headline: existing?.headline ?? extracted.headline ?? null,
        summary: existing?.summary ?? extracted.summary ?? null,
        currentStatus: existing?.currentStatus ?? extracted.currentStatus ?? null,
        location: existing?.location ?? extracted.location ?? null,
        linkedinUrl: existing?.linkedinUrl ?? normalizeUrl(extracted.linkedinUrl),
        githubUrl: existing?.githubUrl ?? normalizeUrl(extracted.githubUrl),
        portfolioUrl: existing?.portfolioUrl ?? normalizeUrl(extracted.portfolioUrl),
        interests: input.interests,
        preferredIndustries: input.preferredIndustries,
        preferredWorkModes: input.preferredWorkModes,
        preferredLocations: input.preferredLocations,
        preferredRoleTypes: input.preferredRoleTypes,
        additionalContext: input.additionalContext ?? null,
        cvText: cvText || null,
        cvParsedAt: cvText ? new Date() : existing?.cvParsedAt ?? null,
        extractionSource: source,
        onboardingCompleted: true,
        ...this.educationSummary(extracted),
      },
      create: {
        userId,
        headline: extracted.headline ?? null,
        summary: extracted.summary ?? null,
        currentStatus: extracted.currentStatus ?? null,
        location: extracted.location ?? null,
        linkedinUrl: normalizeUrl(extracted.linkedinUrl),
        githubUrl: normalizeUrl(extracted.githubUrl),
        portfolioUrl: normalizeUrl(extracted.portfolioUrl),
        interests: input.interests,
        preferredIndustries: input.preferredIndustries,
        preferredWorkModes: input.preferredWorkModes,
        preferredLocations: input.preferredLocations,
        preferredRoleTypes: input.preferredRoleTypes,
        additionalContext: input.additionalContext ?? null,
        cvText: cvText || null,
        cvParsedAt: cvText ? new Date() : null,
        extractionSource: source,
        onboardingCompleted: true,
        ...this.educationSummary(extracted),
      },
    });
    await this.goals.setPrimaryByRole(userId, role.id, input.additionalContext ?? null);
    await this.users.award(userId, { type: 'PROFILE_ANALYZED', title: 'Built Career Intelligence', xp: 50 });

    // 5. Readiness + Universe
    const readiness = await this.sync.afterChange(userId, 'profile_analyzed', { recommendations: true });
    steps.push({ id: 'readiness', label: 'Calculating career readiness', status: readiness ? 'done' : 'failed', detail: readiness ? `${role.title} readiness: ${Math.round(readiness.score)}%.` : 'Readiness could not be calculated.' });
    steps.push({ id: 'graph', label: 'Building your Orbit', status: 'done', detail: 'Your Career Universe is ready.' });

    return { steps, extractionSource: source, intelligence: await this.intelligence(userId) };
  }

  private educationSummary(extracted: ExtractedProfile) {
    const edu = extracted.education[0];
    if (!edu) return {};
    const year = parseDate(edu.endDate)?.getUTCFullYear() ?? null;
    return { university: edu.institution, major: edu.field ?? edu.degree ?? null, graduationYear: year };
  }

  private async persistExtraction(userId: string, extracted: ExtractedProfile, skills: { slug: string; level: number }[]) {
    const [education, experiences, achievements, catalog] = await Promise.all([
      this.prisma.education.findMany({ where: { userId } }),
      this.prisma.experience.findMany({ where: { userId } }),
      this.prisma.achievement.findMany({ where: { userId } }),
      this.prisma.skill.findMany({ select: { id: true, slug: true } }),
    ]);
    const eduKeys = new Set(education.map((e) => dedupeKey(e.institution)));
    const expKeys = new Set(experiences.map((e) => dedupeKey(e.title, e.organization)));
    const achKeys = new Set(achievements.map((a) => dedupeKey(a.title)));
    const skillIds = new Map(catalog.map((s) => [s.slug, s.id]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const e of extracted.education) {
      if (eduKeys.has(dedupeKey(e.institution))) continue;
      ops.push(
        this.prisma.education.create({
          data: { userId, institution: e.institution, degree: e.degree ?? null, field: e.field ?? null, startDate: parseDate(e.startDate), endDate: parseDate(e.endDate), gpa: e.gpa ?? null },
        }),
      );
    }
    for (const e of extracted.experiences) {
      if (expKeys.has(dedupeKey(e.title, e.organization))) continue;
      ops.push(
        this.prisma.experience.create({
          data: {
            userId,
            type: e.type as ExperienceType,
            title: e.title,
            organization: e.organization || '—',
            description: e.description ?? null,
            startDate: parseDate(e.startDate),
            endDate: e.current ? null : parseDate(e.endDate),
            current: e.current,
            skills: e.skills,
          },
        }),
      );
    }
    for (const a of extracted.achievements) {
      if (achKeys.has(dedupeKey(a.title))) continue;
      ops.push(this.prisma.achievement.create({ data: { userId, type: a.type, title: a.title, issuer: a.issuer ?? null, date: parseDate(a.date) } }));
    }
    for (const s of skills) {
      const skillId = skillIds.get(s.slug);
      if (!skillId) continue;
      ops.push(
        this.prisma.userSkill.upsert({
          where: { userId_skillId: { userId, skillId } },
          update: {},
          create: { userId, skillId, level: s.level, source: 'CV' },
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops);
  }

  // -------------------------------------------------------------------------
  // Read / update
  // -------------------------------------------------------------------------

  async detail(userId: string): Promise<ProfileDetail> {
    const [user, profile, education, experiences, achievements, ctx] = await Promise.all([
      this.users.getById(userId),
      this.prisma.careerProfile.findUnique({ where: { userId }, include: { cvFile: true } }),
      this.prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      this.prisma.experience.findMany({ where: { userId }, orderBy: [{ current: 'desc' }, { startDate: 'desc' }] }),
      this.prisma.achievement.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      this.context.load(userId),
    ]);
    const scores = this.readiness.scoresForGoals(ctx);
    return {
      user: this.users.toSessionUser(user),
      profile: toProfileView(profile ?? (await this.prisma.careerProfile.create({ data: { userId }, include: { cvFile: true } }))),
      education: education.map(toEducationView),
      experiences: experiences.map(toExperienceView),
      skills: this.skillViews(ctx),
      achievements: achievements.map(toAchievementView),
      goals: ctx.goals.map((g) => toGoalView(g, scores.get(g.id) ?? null)),
      level: levelFromXp(user.xp),
    };
  }

  skillViews(ctx: CareerContext): UserSkillView[] {
    return ctx.userSkills
      .map((us) => ({
        id: us.id,
        skill: toSkillView(us.skill),
        level: us.level,
        effectiveLevel: ctx.skillLevels.get(us.skillId) ?? us.level,
        source: us.source,
      }))
      .sort((a, b) => b.effectiveLevel - a.effectiveLevel);
  }

  async update(userId: string, data: ProfileUpdate): Promise<ProfileDetail> {
    const { name, ...profileData } = data;
    if (name) {
      await this.prisma.user.update({ where: { id: userId }, data: { name } });
      this.users.invalidate(userId);
    }
    await this.prisma.careerProfile.upsert({ where: { userId }, update: profileData, create: { userId, ...profileData } });
    await this.sync.afterChange(userId, 'profile_updated', { recommendations: Boolean(profileData.preferredWorkModes || profileData.preferredRoleTypes) });
    return this.detail(userId);
  }

  // -------------------------------------------------------------------------
  // Career Intelligence (Career DNA)
  // -------------------------------------------------------------------------

  async intelligence(userId: string): Promise<CareerIntelligence> {
    const ctx = await this.context.load(userId);
    const goal = ctx.primaryGoal;
    const readiness = goal ? await this.readiness.current(userId, ctx) : null;
    const gaps = this.context.gapsFor(ctx);
    const strengths = this.context.strengthsFor(ctx);
    const traits = this.traits(ctx);
    const status = ctx.profile?.currentStatus ?? (this.context.isStudent(ctx) ? 'Student' : 'Professional');
    const firstName = ctx.user.name.split(' ')[0];
    const summary = goal
      ? `${firstName} is a ${status.toLowerCase()} moving toward ${goal.role.title}. ` +
        (strengths.length ? `Strongest in ${strengths.slice(0, 3).map((s) => s.name).join(', ')}. ` : '') +
        (gaps.length ? `The biggest gaps are ${gaps.slice(0, 2).map((g) => g.name).join(' and ')}.` : 'Core skill requirements are met.')
      : `${firstName} has not set a target role yet.`;
    const headline = traits.length >= 2 ? `${traits[0]} with ${traits[1].toLowerCase()}` : traits[0] ?? 'Early-career explorer';

    return {
      targetRole: goal ? { slug: goal.role.slug, title: goal.role.title, description: goal.role.description } : null,
      goalId: goal?.id ?? null,
      readiness,
      careerDna: { headline, summary, traits },
      strengths,
      gaps: gaps.slice(0, 8),
      experienceHighlights: ctx.experiences.slice(0, 5).map(toExperienceView),
      keySkills: this.skillViews(ctx).slice(0, 10),
      preferences: {
        workModes: ctx.profile?.preferredWorkModes ?? [],
        industries: ctx.profile?.preferredIndustries ?? [],
        locations: ctx.profile?.preferredLocations ?? [],
        roleTypes: ctx.profile?.preferredRoleTypes ?? [],
      },
      recommendedFocus: await this.nba.compute(userId, ctx),
    };
  }

  private traits(ctx: CareerContext): string[] {
    const traits: string[] = [];
    const types = new Set(ctx.experiences.map((e) => e.type));
    if (this.context.hasTechnicalBackground(ctx)) traits.push('Technical Background');
    if (types.has('LEADERSHIP') || (ctx.skillLevelsBySlug.get('leadership') ?? 0) >= 60) traits.push('Leadership');
    if (types.has('PROJECT')) traits.push('Project Experience');
    if ((ctx.skillLevelsBySlug.get('communication') ?? 0) >= 55) traits.push('Communication');
    if (types.has('COMPETITION')) traits.push('Competitive Builder');
    if (types.has('INTERNSHIP') || types.has('WORK')) traits.push('Professional Exposure');
    if (types.has('RESEARCH')) traits.push('Research Mindset');
    return traits.slice(0, 5);
  }

  // -------------------------------------------------------------------------
  // Experiences, education, achievements, skills
  // -------------------------------------------------------------------------

  async addExperience(userId: string, data: { type: ExperienceType; title: string; organization: string; description?: string; startDate?: string; endDate?: string; current?: boolean; skills?: string[] }) {
    const exp = await this.prisma.experience.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        organization: data.organization,
        description: data.description ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.current || !data.endDate ? null : new Date(data.endDate),
        current: data.current ?? false,
        skills: data.skills ?? [],
      },
    });
    await this.users.award(userId, { type: 'EXPERIENCE_ADDED', title: `Added ${exp.title}`, description: exp.organization, xp: 20 });
    await this.sync.afterChange(userId, 'experience_added');
    return toExperienceView(exp);
  }

  async updateExperience(userId: string, id: string, data: Partial<{ type: ExperienceType; title: string; organization: string; description: string; startDate: string; endDate: string | null; current: boolean; skills: string[] }>) {
    const owned = await this.prisma.experience.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Experience');
    const exp = await this.prisma.experience.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate === null || data.current ? null : data.endDate ? new Date(data.endDate) : undefined,
      },
    });
    await this.sync.afterChange(userId, 'experience_updated');
    return toExperienceView(exp);
  }

  async removeExperience(userId: string, id: string) {
    const owned = await this.prisma.experience.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Experience');
    await this.prisma.experience.delete({ where: { id } });
    await this.sync.afterChange(userId, 'experience_removed');
    return { removed: true };
  }

  async upsertSkill(userId: string, skillSlug: string, level: number) {
    const skill = await this.prisma.skill.findUnique({ where: { slug: skillSlug } });
    if (!skill) throw notFound('Skill');
    await this.prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      update: { level, source: 'USER' },
      create: { userId, skillId: skill.id, level, source: 'USER' },
    });
    await this.sync.afterChange(userId, 'skill_updated');
    return this.skillViews(await this.context.load(userId));
  }

  async removeSkill(userId: string, userSkillId: string) {
    const owned = await this.prisma.userSkill.findFirst({ where: { id: userSkillId, userId } });
    if (!owned) throw notFound('Skill');
    await this.prisma.userSkill.delete({ where: { id: userSkillId } });
    await this.sync.afterChange(userId, 'skill_removed');
    return { removed: true };
  }

  async addEducation(userId: string, data: { institution: string; degree?: string; field?: string; startDate?: string; endDate?: string; gpa?: string }) {
    const edu = await this.prisma.education.create({
      data: { userId, ...data, startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null },
    });
    await this.sync.afterChange(userId, 'education_added');
    return toEducationView(edu);
  }

  async removeEducation(userId: string, id: string) {
    const owned = await this.prisma.education.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Education');
    await this.prisma.education.delete({ where: { id } });
    await this.sync.afterChange(userId, 'education_removed');
    return { removed: true };
  }

  async addAchievement(userId: string, data: { type: 'AWARD' | 'CERTIFICATION' | 'PUBLICATION'; title: string; issuer?: string; date?: string; url?: string }) {
    const a = await this.prisma.achievement.create({ data: { userId, ...data, date: data.date ? new Date(data.date) : null } });
    await this.sync.afterChange(userId, 'achievement_added');
    return toAchievementView(a);
  }

  async removeAchievement(userId: string, id: string) {
    const owned = await this.prisma.achievement.findFirst({ where: { id, userId } });
    if (!owned) throw notFound('Achievement');
    await this.prisma.achievement.delete({ where: { id } });
    await this.sync.afterChange(userId, 'achievement_removed');
    return { removed: true };
  }
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
