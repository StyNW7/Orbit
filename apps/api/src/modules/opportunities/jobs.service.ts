import { Injectable, Logger } from '@nestjs/common';
import type { Opportunity } from '@prisma/client';
import type { JobMatchView, OpportunityType, ProviderRefreshResult, WorkMode } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config';
import { notFound } from '../../common/http/errors';
import { toOpportunityView } from '../../common/mappers';
import { AiService } from '../ai/ai.service';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import { ROLES } from '../../catalog/roles.catalog';
import { RecommendationService, type UserSignal } from '../recommendations/recommendation.service';
import { computeJobMatch, type MatchUser } from './job-match.engine';
import { L, currentLocale } from '../../common/i18n/locale';
import {
  ArbeitnowJobProvider,
  CuratedJobProvider,
  RemotiveJobProvider,
  WeWorkRemotelyProvider,
  dedupeKey,
  type JobProvider,
  type NormalizedJob,
} from './job-providers';

export interface JobFilters {
  type?: OpportunityType;
  workMode?: WorkMode;
  q?: string;
  limit?: number;
}

const DAY = 86_400_000;

@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');
  private readonly providers: JobProvider[] = [
    new CuratedJobProvider(),
    new RemotiveJobProvider(),
    new ArbeitnowJobProvider(),
    new WeWorkRemotelyProvider(),
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly recs: RecommendationService,
    private readonly ai: AiService,
  ) {}

  // -------------------------------------------------------------------------
  // Ingestion
  // -------------------------------------------------------------------------

  async ingest(jobs: NormalizedJob[]): Promise<number> {
    let imported = 0;
    for (const job of jobs) {
      if (!job.title || !job.company) continue;
      const key = dedupeKey(job);
      const data = {
        source: job.source,
        externalId: job.externalId,
        title: job.title.slice(0, 200),
        company: job.company.slice(0, 120),
        description: job.description,
        location: job.location.slice(0, 120),
        workMode: job.workMode,
        employmentType: job.employmentType,
        seniority: job.seniority,
        skills: job.skills,
        roleSlugs: job.roleSlugs,
        industry: job.industry,
        applyUrl: job.applyUrl,
        salaryRange: job.salaryRange,
        isDemo: job.isDemo,
        isActive: true,
        publishedAt: job.publishedAt,
        expiresAt: job.expiresAt,
        deadline: job.deadline,
        fetchedAt: new Date(),
      };
      const existing = await this.prisma.opportunity.findUnique({ where: { dedupeKey: key }, select: { id: true, embeddingModel: true } });
      const row = existing
        ? await this.prisma.opportunity.update({ where: { id: existing.id }, data })
        : await this.prisma.opportunity.create({ data: { ...data, dedupeKey: key } });
      if (!existing) imported += 1;
      await this.recs.storeEmbedding('Opportunity', row.id, embeddingText(row));
    }
    return imported;
  }

  async refresh(roleSlugs?: string[]): Promise<ProviderRefreshResult[]> {
    const roles = roleSlugs?.length ? roleSlugs : ROLES.map((r) => r.slug);
    const keywords = roles.flatMap((slug) => ROLES.find((r) => r.slug === slug)?.keywords.slice(0, 3) ?? []);
    const results: ProviderRefreshResult[] = [];
    for (const provider of this.providers) {
      if (provider.external && !this.config.externalProvidersEnabled) {
        results.push({ provider: provider.name, fetched: 0, imported: 0, status: 'skipped', message: 'External providers disabled' });
        continue;
      }
      try {
        const jobs = await provider.fetch({ roleSlugs: roles, keywords });
        const relevant = provider.external ? jobs.filter((j) => j.roleSlugs.length > 0) : jobs;
        const imported = await this.ingest(relevant);
        results.push({ provider: provider.name, fetched: jobs.length, imported, status: 'ok' });
      } catch (error) {
        this.logger.warn(`Provider ${provider.name} failed: ${(error as Error).message}`);
        results.push({ provider: provider.name, fetched: 0, imported: 0, status: 'failed', message: 'Provider temporarily unavailable' });
      }
    }
    // Expire stale external listings.
    await this.prisma.opportunity.updateMany({
      where: { isDemo: false, fetchedAt: { lt: new Date(Date.now() - 30 * DAY) } },
      data: { isActive: false },
    });
    return results;
  }

  // -------------------------------------------------------------------------
  // Matching
  // -------------------------------------------------------------------------

  matchUser(signal: UserSignal, ctxHelpers: { isStudent: boolean; technical: boolean }): MatchUser {
    const ctx = signal.ctx;
    const now = new Date();
    const primary = ctx.primaryGoal?.role;
    return {
      skillLevels: ctx.skillLevelsBySlug,
      skillNames: new Map([...SKILL_BY_SLUG.values()].map((s) => [s.slug, s.name])),
      primaryRole: primary ? { slug: primary.slug, title: primary.title, keywords: primary.keywords } : null,
      otherRoleSlugs: ctx.goals.filter((g) => !g.isPrimary).map((g) => g.role.slug),
      experiences: ctx.experiences.map((e) => ({
        type: e.type,
        months: e.startDate ? Math.max(0, ((e.current || !e.endDate ? now : e.endDate).getTime() - e.startDate.getTime()) / (30 * DAY)) : 0,
      })),
      isStudent: ctxHelpers.isStudent,
      technicalBackground: ctxHelpers.technical,
      preferences: {
        workModes: ctx.profile?.preferredWorkModes ?? [],
        roleTypes: ctx.profile?.preferredRoleTypes ?? [],
        locations: ctx.profile?.preferredLocations ?? [],
        industries: ctx.profile?.preferredIndustries ?? [],
      },
      journeySkillSlugs: ctx.journeySkillSlugs,
    };
  }

  async listMatches(signal: UserSignal, user: MatchUser, filters: JobFilters = {}): Promise<JobMatchView[]> {
    const now = new Date();
    const activeWhere = { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const similarities = await this.recs.vectorCandidates('Opportunity', signal.vector, 80, `"isActive" = true`);
    const q = filters.q?.trim();
    const candidates = await this.prisma.opportunity.findMany({
      where: {
        AND: [
          activeWhere,
          filters.type ? { employmentType: filters.type } : {},
          filters.workMode ? { workMode: filters.workMode } : {},
          q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { company: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {
                OR: [{ id: { in: [...similarities.keys()] } }, { roleSlugs: { hasSome: signal.roleSlugs.length ? signal.roleSlugs : ['_'] } }],
              },
        ],
      },
      take: 150,
    });
    const userId = signal.ctx.user.id;
    const [saved, applications] = await Promise.all([
      this.prisma.savedOpportunity.findMany({ where: { userId, kind: 'OPPORTUNITY' }, select: { opportunityId: true } }),
      this.prisma.application.findMany({ where: { userId }, select: { id: true, opportunityId: true } }),
    ]);
    const savedIds = new Set(saved.map((s) => s.opportunityId));
    const appByOpp = new Map(applications.map((a) => [a.opportunityId, a.id]));

    return candidates
      .map((o) => this.toMatchView(o, user, similarities.get(o.id) ?? null, savedIds.has(o.id), appByOpp.get(o.id) ?? null))
      .sort((a, b) => b.match.overall - a.match.overall || Number(b.opportunity.isDemo) - Number(a.opportunity.isDemo))
      .slice(0, filters.limit ?? 40);
  }

  toMatchView(o: Opportunity, user: MatchUser, similarity: number | null, saved: boolean, applicationId: string | null): JobMatchView {
    const m = computeJobMatch(
      {
        title: o.title,
        description: o.description,
        skills: o.skills,
        roleSlugs: o.roleSlugs,
        workMode: o.workMode,
        employmentType: o.employmentType,
        location: o.location,
        seniority: o.seniority,
        industry: o.industry,
      },
      user,
      similarity,
    );
    return {
      opportunity: { ...toOpportunityView(o), skills: o.skills.map((s) => SKILL_BY_SLUG.get(s)?.name ?? s) },
      match: {
        overall: m.overall,
        components: m.components,
        matchedSkills: m.matchedSkills,
        missingSkills: m.missingSkills.map((g) => ({ name: g.name, slug: g.slug, inJourney: g.inJourney })),
        reasons: m.reasons,
        recommendedAction: m.recommendedAction,
      },
      saved: saved || applicationId !== null,
      applicationId,
    };
  }

  async detail(signal: UserSignal, user: MatchUser, jobId: string): Promise<JobMatchView & { explanation: string; explainedBy: 'AI' | 'TEMPLATE' }> {
    const job = await this.prisma.opportunity.findUnique({ where: { id: jobId } });
    if (!job) throw notFound('Opportunity');
    const sims = await this.recs.vectorCandidates('Opportunity', signal.vector, 200, `"isActive" = true`);
    const userId = signal.ctx.user.id;
    const [saved, app] = await Promise.all([
      this.prisma.savedOpportunity.findFirst({ where: { userId, opportunityId: jobId } }),
      this.prisma.application.findFirst({ where: { userId, opportunityId: jobId }, select: { id: true } }),
    ]);
    const view = this.toMatchView(job, user, sims.get(jobId) ?? null, Boolean(saved), app?.id ?? null);
    const template = templateExplanation(view, signal.primaryRoleTitle);
    const ai = await this.ai.generateText(
      `You are Orbit, a career agent. In 3 short sentences, explain to the user why this job matches them and what to do next. Use only the facts provided. No emoji.${currentLocale() === 'id' ? ' Write in natural Bahasa Indonesia and address the user as "kamu".' : ''}`,
      JSON.stringify({
        job: { title: job.title, company: job.company, type: job.employmentType },
        targetRole: signal.primaryRoleTitle,
        match: view.match,
      }),
      220,
      8_000,
    );
    return { ...view, explanation: ai ?? template, explainedBy: ai ? 'AI' : 'TEMPLATE' };
  }
}

export function embeddingText(o: Pick<Opportunity, 'title' | 'company' | 'description' | 'skills' | 'roleSlugs'>): string {
  const skills = o.skills.map((s) => SKILL_BY_SLUG.get(s)?.name ?? s).join(', ');
  const roles = o.roleSlugs.map((r) => ROLES.find((x) => x.slug === r)?.title ?? r).join(', ');
  return `${o.title} at ${o.company}. Roles: ${roles}. Skills: ${skills}. ${o.description.slice(0, 1200)}`;
}

function templateExplanation(view: JobMatchView, role: string | null): string {
  const m = view.match;
  const parts = [L(`${view.opportunity.title} is a ${m.overall}% match${role ? ` for your ${role} goal` : ''}.`, `${view.opportunity.title} ${m.overall}% cocok${role ? ` dengan tujuan ${role}-mu` : ' denganmu'}.`)];
  if (m.reasons.length) parts.push(L(`You bring ${m.reasons.slice(0, 3).join(', ')}.`, `Kamu membawa ${m.reasons.slice(0, 3).join(', ')}.`));
  const gaps = m.missingSkills.map((s) => s.name).slice(0, 2);
  if (gaps.length) parts.push(L(`The main gap is ${gaps.join(' and ')} — ${m.recommendedAction.toLowerCase()}.`, `Gap utamanya adalah ${gaps.join(' dan ')} — ${m.recommendedAction.charAt(0).toLowerCase()}${m.recommendedAction.slice(1)}.`));
  else parts.push(L('You meet the core skill requirements — prepare a tailored application.', 'Kamu sudah memenuhi kebutuhan skill inti — siapkan lamaran yang disesuaikan.'));
  return parts.join(' ');
}
