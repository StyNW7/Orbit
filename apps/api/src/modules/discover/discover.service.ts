import { Injectable, Logger } from '@nestjs/common';
import type { Book, Event, Prisma, ResearchPaper, Resource, RoleModel, SavedKind, SavedStatus } from '@prisma/client';
import type {
  BookView,
  DiscoverHighlights,
  GrowthItemView,
  PaperView,
  PersonComparison,
  PersonView,
  SavedItemView,
} from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfig } from '../../config/app-config';
import { badRequest, notFound } from '../../common/http/errors';
import { iso } from '../../common/mappers';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import { ROLE_BY_SLUG } from '../../catalog/roles.catalog';
import { CareerContextService, type CareerContext } from '../career/career-context.service';
import { RecommendationService, type UserSignal } from '../recommendations/recommendation.service';
import { JobsService, type JobFilters } from '../opportunities/jobs.service';
import { UsersService } from '../users/users.service';
import {
  GoogleBooksProvider,
  OpenAlexProvider,
  OpenLibraryProvider,
  SemanticScholarProvider,
  titleKey,
  type BookProvider,
  type PaperProvider,
} from './knowledge-providers';

type SavedRef = { id: string; status: SavedStatus };
const skillName = (slug: string) => SKILL_BY_SLUG.get(slug)?.name ?? slug;

@Injectable()
export class DiscoverService {
  private readonly logger = new Logger('Discover');
  private readonly bookProviders: BookProvider[];
  private readonly paperProviders: PaperProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly context: CareerContextService,
    private readonly recs: RecommendationService,
    private readonly jobMatcher: JobsService,
    private readonly users: UsersService,
  ) {
    this.bookProviders = [new GoogleBooksProvider(config.env.GOOGLE_BOOKS_API_KEY), new OpenLibraryProvider()];
    this.paperProviders = [new OpenAlexProvider(config.env.OPENALEX_EMAIL), new SemanticScholarProvider(config.env.SEMANTIC_SCHOLAR_API_KEY)];
  }

  async signal(userId: string, ctx?: CareerContext): Promise<UserSignal> {
    return this.recs.signal(userId, ctx);
  }

  private async savedMap(userId: string, kind: SavedKind): Promise<Map<string, SavedRef>> {
    const rows = await this.prisma.savedOpportunity.findMany({ where: { userId, kind } });
    const key = (r: (typeof rows)[number]) => r.opportunityId ?? r.bookId ?? r.paperId ?? r.eventId ?? r.resourceId ?? r.roleModelId ?? '';
    return new Map(rows.map((r) => [key(r), { id: r.id, status: r.status }]));
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  async jobs(userId: string, filters: JobFilters, signal?: UserSignal) {
    const s = signal ?? (await this.signal(userId));
    const user = this.jobMatcher.matchUser(s, { isStudent: this.context.isStudent(s.ctx), technical: this.context.hasTechnicalBackground(s.ctx) });
    return this.jobMatcher.listMatches(s, user, filters);
  }

  async job(userId: string, jobId: string) {
    const s = await this.signal(userId);
    const user = this.jobMatcher.matchUser(s, { isStudent: this.context.isStudent(s.ctx), technical: this.context.hasTechnicalBackground(s.ctx) });
    return this.jobMatcher.detail(s, user, jobId);
  }

  // -------------------------------------------------------------------------
  // Growth: events + courses/certifications
  // -------------------------------------------------------------------------

  async growth(userId: string, type?: string, signal?: UserSignal): Promise<GrowthItemView[]> {
    const s = signal ?? (await this.signal(userId));
    const now = new Date();
    const [events, resources, eventSims, resourceSims, savedEvents, savedResources] = await Promise.all([
      this.prisma.event.findMany({ where: { startsAt: { gte: new Date(now.getTime() - 2 * 3600_000) } }, orderBy: { startsAt: 'asc' }, take: 80 }),
      this.prisma.resource.findMany({ take: 120 }),
      this.recs.vectorCandidates('Event', s.vector, 80),
      this.recs.vectorCandidates('Resource', s.vector, 120),
      this.savedMap(userId, 'EVENT'),
      this.savedMap(userId, 'RESOURCE'),
    ]);
    const items: GrowthItemView[] = [
      ...events.map((e) => this.eventView(s, e, eventSims.get(e.id), savedEvents.get(e.id) ?? null)),
      ...resources.map((r) => this.resourceView(s, r, resourceSims.get(r.id), savedResources.get(r.id) ?? null)),
    ];
    return items
      .filter((i) => !type || i.type === type)
      .sort((a, b) => b.relevance - a.relevance || (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  }

  private eventView(s: UserSignal, e: Event, sim: number | undefined, saved: SavedRef | null): GrowthItemView {
    const daysAway = (e.startsAt.getTime() - Date.now()) / 86_400_000;
    const urgency = daysAway <= 3 ? 6 : daysAway <= 14 ? 3 : 0;
    return {
      kind: 'EVENT',
      id: e.id,
      type: e.type,
      title: e.title,
      provider: e.organizer,
      description: e.description,
      url: e.url,
      startsAt: e.startsAt.toISOString(),
      deadline: iso(e.registrationDeadline),
      location: e.location,
      isOnline: e.isOnline,
      cost: e.cost,
      durationHours: e.endsAt ? Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 3600_000) : null,
      skills: e.skills.map(skillName),
      relevance: Math.min(100, this.recs.relevance(s, e, sim) + urgency),
      why: this.recs.why(s, e.skills, e.type === 'WORKSHOP' ? 'workshop' : 'event'),
      saved,
      isDemo: e.isDemo,
    };
  }

  private resourceView(s: UserSignal, r: Resource, sim: number | undefined, saved: SavedRef | null): GrowthItemView {
    return {
      kind: 'RESOURCE',
      id: r.id,
      type: r.type,
      title: r.title,
      provider: r.provider,
      description: r.description,
      url: r.url,
      startsAt: null,
      deadline: null,
      location: null,
      isOnline: true,
      cost: r.cost,
      durationHours: r.durationHours,
      skills: r.skills.map(skillName),
      relevance: this.recs.relevance(s, r, sim),
      why: this.recs.why(s, r.skills, r.type === 'CERTIFICATION' ? 'certification' : 'course'),
      saved,
      isDemo: false,
    };
  }

  // -------------------------------------------------------------------------
  // Knowledge
  // -------------------------------------------------------------------------

  async books(userId: string, q?: string, signal?: UserSignal): Promise<BookView[]> {
    const s = signal ?? (await this.signal(userId));
    if (q?.trim()) await this.searchExternalBooks(q.trim());
    const [books, sims, saved] = await Promise.all([
      this.prisma.book.findMany({
        where: q?.trim() ? { OR: [{ title: { contains: q.trim(), mode: 'insensitive' } }, { description: { contains: q.trim(), mode: 'insensitive' } }] } : {},
        take: 150,
      }),
      this.recs.vectorCandidates('Book', s.vector, 150),
      this.savedMap(userId, 'BOOK'),
    ]);
    return books
      .map((b) => this.bookView(s, b, sims.get(b.id), saved.get(b.id) ?? null))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 40);
  }

  private bookView(s: UserSignal, b: Book, sim: number | undefined, saved: SavedRef | null): BookView {
    const role = b.roleSlugs.find((r) => s.roleSlugs.includes(r)) ?? b.roleSlugs[0];
    return {
      id: b.id,
      source: b.source,
      title: b.title,
      authors: b.authors,
      description: b.description,
      coverUrl: b.coverUrl,
      publishedYear: b.publishedYear,
      level: b.level,
      infoUrl: b.infoUrl,
      skills: b.skills.map(skillName),
      relatedCareer: role ? ROLE_BY_SLUG.get(role)?.title ?? null : null,
      relevance: this.recs.relevance(s, b, sim),
      why: this.recs.why(s, b.skills, 'book'),
      saved,
    };
  }

  async papers(userId: string, q?: string, signal?: UserSignal): Promise<PaperView[]> {
    const s = signal ?? (await this.signal(userId));
    if (q?.trim()) await this.searchExternalPapers(q.trim());
    const [papers, sims, saved] = await Promise.all([
      this.prisma.researchPaper.findMany({
        where: q?.trim() ? { OR: [{ title: { contains: q.trim(), mode: 'insensitive' } }, { abstract: { contains: q.trim(), mode: 'insensitive' } }] } : {},
        take: 150,
      }),
      this.recs.vectorCandidates('ResearchPaper', s.vector, 150),
      this.savedMap(userId, 'PAPER'),
    ]);
    return papers
      .map((p) => this.paperView(s, p, sims.get(p.id), saved.get(p.id) ?? null))
      // Papers must connect to the user's career, gaps or interests — never random.
      .filter((p) => q?.trim() || p.relevance >= 25)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 30);
  }

  private paperView(s: UserSignal, p: ResearchPaper, sim: number | undefined, saved: SavedRef | null): PaperView {
    const role = p.roleSlugs.find((r) => s.roleSlugs.includes(r)) ?? p.roleSlugs[0];
    return {
      id: p.id,
      source: p.source,
      title: p.title,
      authors: p.authors,
      year: p.year,
      venue: p.venue,
      abstract: p.abstract,
      url: p.url,
      citationCount: p.citationCount,
      skills: p.skills.map(skillName),
      relatedCareer: role ? ROLE_BY_SLUG.get(role)?.title ?? null : null,
      relevance: this.recs.relevance(s, p, sim),
      why: this.recs.why(s, p.skills, 'paper'),
      saved,
    };
  }

  private async searchExternalBooks(q: string) {
    if (!this.config.externalProvidersEnabled) return;
    for (const provider of this.bookProviders) {
      try {
        const results = await provider.search(q, 8);
        for (const r of results) {
          const dedupeKey = titleKey(r.title, r.authors[0] ?? '');
          const existing = await this.prisma.book.findUnique({ where: { dedupeKey }, select: { id: true } });
          if (existing) continue;
          const row = await this.prisma.book.create({ data: { ...r, dedupeKey, level: null } });
          await this.recs.storeEmbedding('Book', row.id, `${r.title}. ${r.description}. Skills: ${r.skills.map(skillName).join(', ')}`);
        }
        if (results.length) return;
      } catch (error) {
        this.logger.warn(`Book provider ${provider.name} failed: ${(error as Error).message}`);
      }
    }
  }

  private async searchExternalPapers(q: string) {
    if (!this.config.externalProvidersEnabled) return;
    for (const provider of this.paperProviders) {
      try {
        const results = await provider.search(q, 8);
        for (const r of results) {
          const dedupeKey = titleKey(r.title, String(r.year ?? ''));
          const existing = await this.prisma.researchPaper.findUnique({ where: { dedupeKey }, select: { id: true } });
          if (existing) continue;
          const row = await this.prisma.researchPaper.create({ data: { ...r, dedupeKey } });
          await this.recs.storeEmbedding('ResearchPaper', row.id, `${r.title}. ${r.abstract.slice(0, 1000)}`);
        }
        if (results.length) return;
      } catch (error) {
        this.logger.warn(`Paper provider ${provider.name} failed: ${(error as Error).message}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  async people(userId: string, kind?: 'ROLE_MODEL' | 'MENTOR', signal?: UserSignal): Promise<PersonView[]> {
    const s = signal ?? (await this.signal(userId));
    const [people, sims, saved] = await Promise.all([
      this.prisma.roleModel.findMany({ where: kind ? { kind } : {} }),
      this.recs.vectorCandidates('RoleModel', s.vector, 60),
      this.savedMap(userId, 'ROLE_MODEL'),
    ]);
    return people
      .map((p) => this.personView(s, p, sims.get(p.id), saved.get(p.id) ?? null))
      .sort((a, b) => b.relevance - a.relevance);
  }

  private userSignals(ctx: CareerContext): Set<string> {
    const signals = new Set<string>();
    const types = new Set(ctx.experiences.map((e) => e.type));
    if (this.context.hasTechnicalBackground(ctx)) signals.add('technical-background');
    if (types.has('PROJECT')) signals.add('project-delivery');
    if (types.has('LEADERSHIP') || types.has('ORGANIZATION')) signals.add('leadership');
    if (types.has('RESEARCH')) signals.add('research');
    const level = (slug: string) => ctx.skillLevelsBySlug.get(slug) ?? 0;
    if (ctx.experiences.some((e) => (e.type === 'INTERNSHIP' || e.type === 'WORK') && /product|growth/i.test(`${e.title} ${e.description ?? ''}`)))
      signals.add('product-ownership');
    if (level('business-strategy') >= 40 || level('market-research') >= 40) signals.add('business-exposure');
    if (level('ux-design') >= 50 || level('ui-design') >= 50) signals.add('design-craft');
    if (['system-design', 'javascript', 'python', 'java', 'nodejs'].filter((sl) => level(sl) >= 65).length >= 2) signals.add('engineering-depth');
    if (level('communication') >= 60) signals.add('writing');
    return signals;
  }

  private personView(s: UserSignal, p: RoleModel, sim: number | undefined, saved: SavedRef | null): PersonView {
    const ctx = s.ctx;
    const mine = this.userSignals(ctx);
    const signalLabels: Record<string, string> = {
      'technical-background': 'Technical Background',
      'project-delivery': 'Project Experience',
      'product-ownership': 'Product Internship',
      leadership: 'Leadership Experience',
      research: 'Research Experience',
      'business-exposure': 'Business Exposure',
      'design-craft': 'Design Craft',
      'engineering-depth': 'Engineering Depth',
      writing: 'Clear Communication',
    };
    const similarities = [
      ...p.earlyCareerSignals.filter((sig) => mine.has(sig)).map((sig) => signalLabels[sig] ?? sig),
      ...p.skills.filter((sl) => (ctx.skillLevelsBySlug.get(sl) ?? 0) >= 55).map(skillName),
    ];
    const differences = [
      ...p.earlyCareerSignals.filter((sig) => !mine.has(sig)).map((sig) => signalLabels[sig] ?? sig),
      ...p.skills.filter((sl) => s.gapSeverity.has(sl)).map(skillName),
    ];
    const uniq = (xs: string[]) => [...new Set(xs)].slice(0, 4);
    const sims = uniq(similarities);
    const diffs = uniq(differences);
    const insight =
      sims.length >= 2
        ? `Your current profile resembles ${p.name.split(' ')[0]}'s early-career trajectory.`
        : sims.length === 1
          ? `You share ${sims[0].toLowerCase()} with ${p.name.split(' ')[0]}, an early signal in their path.`
          : `${p.name.split(' ')[0]}'s path shows a different route into this field worth learning from.`;
    const nextDiff = diffs[0];
    const recommendedAction = !nextDiff
      ? 'Keep building on your strengths and share your progress publicly.'
      : nextDiff === 'Product Internship'
        ? 'Gain practical Product experience.'
        : `Build ${nextDiff} to close the gap with this path.`;
    const comparison: PersonComparison = { similarities: sims, differences: diffs, insight, recommendedAction };
    const role = p.relatedRoleSlugs.find((r) => s.roleSlugs.includes(r)) ?? p.relatedRoleSlugs[0];
    const relevance = Math.round(
      Math.min(
        1,
        (role && s.roleSlugs[0] === role ? 0.55 : role && s.roleSlugs.includes(role) ? 0.35 : 0.1) + Math.min(0.3, sims.length * 0.08) + (sim ?? 0) * 0.15,
      ) * 100,
    );
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      headline: p.headline,
      careerSummary: p.careerSummary,
      skills: p.skills.map(skillName),
      expertise: p.expertise,
      careerTransitions: (p.careerTransitions as PersonView['careerTransitions']) ?? [],
      publicSources: (p.publicSources as PersonView['publicSources']) ?? [],
      relatedRole: role ? ROLE_BY_SLUG.get(role)?.title ?? null : null,
      location: p.location,
      availability: p.availability,
      isDemo: p.isDemo,
      relevance,
      whyRelevant: role
        ? `${p.kind === 'MENTOR' ? 'Mentors people moving into' : 'Built a career path relevant to'} ${ROLE_BY_SLUG.get(role)?.title ?? role}.`
        : 'Relevant to your interests.',
      comparison,
      saved,
    };
  }

  // -------------------------------------------------------------------------
  // Highlights (golden demo: one internship, book, paper, event, person)
  // -------------------------------------------------------------------------

  async highlights(userId: string): Promise<DiscoverHighlights> {
    const s = await this.signal(userId);
    const [jobs, growth, books, papers, people] = await Promise.all([
      this.jobs(userId, { type: 'INTERNSHIP', limit: 5 }, s),
      this.growth(userId, undefined, s),
      this.books(userId, undefined, s),
      this.papers(userId, undefined, s),
      this.people(userId, 'ROLE_MODEL', s),
    ]);
    return {
      internship: jobs[0] ?? null,
      book: books[0] ?? null,
      paper: papers[0] ?? null,
      event: growth.find((g) => g.kind === 'EVENT') ?? null,
      person: people[0] ?? null,
      focusGap: s.gaps[0]?.name ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Saved items
  // -------------------------------------------------------------------------

  private refField(kind: SavedKind): 'opportunityId' | 'bookId' | 'paperId' | 'eventId' | 'resourceId' | 'roleModelId' {
    return ({ OPPORTUNITY: 'opportunityId', BOOK: 'bookId', PAPER: 'paperId', EVENT: 'eventId', RESOURCE: 'resourceId', ROLE_MODEL: 'roleModelId' } as const)[kind];
  }

  async save(userId: string, kind: SavedKind, itemId: string): Promise<SavedItemView> {
    const exists = await this.itemExists(kind, itemId);
    if (!exists) throw notFound('Item');
    const field = this.refField(kind);
    const existing = await this.prisma.savedOpportunity.findFirst({ where: { userId, [field]: itemId } });
    const row = existing ?? (await this.prisma.savedOpportunity.create({ data: { userId, kind, [field]: itemId } as Prisma.SavedOpportunityUncheckedCreateInput }));
    return (await this.savedViews(userId, [row.id]))[0];
  }

  async updateSaved(userId: string, id: string, status: SavedStatus): Promise<SavedItemView> {
    const row = await this.prisma.savedOpportunity.findFirst({ where: { id, userId } });
    if (!row) throw notFound('Saved item');
    const completed = status === 'COMPLETED' && row.status !== 'COMPLETED';
    await this.prisma.savedOpportunity.update({ where: { id }, data: { status, completedAt: status === 'COMPLETED' ? new Date() : null } });
    if (completed && row.kind !== 'OPPORTUNITY' && row.kind !== 'ROLE_MODEL') {
      const [view] = await this.savedViews(userId, [id]);
      await this.users.award(userId, { type: 'RESOURCE_COMPLETED', title: `Completed “${view.title}”`, xp: 40, metadata: { kind: row.kind } });
    }
    return (await this.savedViews(userId, [id]))[0];
  }

  async unsave(userId: string, id: string) {
    const row = await this.prisma.savedOpportunity.findFirst({ where: { id, userId } });
    if (!row) throw notFound('Saved item');
    await this.prisma.savedOpportunity.delete({ where: { id } });
    return { removed: true };
  }

  private async itemExists(kind: SavedKind, id: string): Promise<boolean> {
    const where = { where: { id }, select: { id: true } };
    switch (kind) {
      case 'OPPORTUNITY':
        return Boolean(await this.prisma.opportunity.findUnique(where));
      case 'BOOK':
        return Boolean(await this.prisma.book.findUnique(where));
      case 'PAPER':
        return Boolean(await this.prisma.researchPaper.findUnique(where));
      case 'EVENT':
        return Boolean(await this.prisma.event.findUnique(where));
      case 'RESOURCE':
        return Boolean(await this.prisma.resource.findUnique(where));
      case 'ROLE_MODEL':
        return Boolean(await this.prisma.roleModel.findUnique(where));
      default:
        throw badRequest('Unknown item kind');
    }
  }

  async savedViews(userId: string, ids?: string[]): Promise<SavedItemView[]> {
    const rows = await this.prisma.savedOpportunity.findMany({
      where: { userId, ...(ids ? { id: { in: ids } } : {}) },
      include: { opportunity: true, book: true, paper: true, event: true, resource: true, roleModel: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => {
      let title = '';
      let subtitle = '';
      let url: string | null = null;
      let itemId = '';
      if (r.opportunity) [title, subtitle, url, itemId] = [r.opportunity.title, r.opportunity.company, `/app/discover/jobs/${r.opportunity.id}`, r.opportunity.id];
      else if (r.book) [title, subtitle, url, itemId] = [r.book.title, r.book.authors.join(', '), r.book.infoUrl, r.book.id];
      else if (r.paper) [title, subtitle, url, itemId] = [r.paper.title, `${r.paper.authors[0] ?? ''}${r.paper.year ? ` · ${r.paper.year}` : ''}`, r.paper.url, r.paper.id];
      else if (r.event) [title, subtitle, url, itemId] = [r.event.title, r.event.organizer, r.event.url, r.event.id];
      else if (r.resource) [title, subtitle, url, itemId] = [r.resource.title, r.resource.provider, r.resource.url, r.resource.id];
      else if (r.roleModel) [title, subtitle, url, itemId] = [r.roleModel.name, r.roleModel.headline, null, r.roleModel.id];
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        itemId,
        title,
        subtitle,
        url,
        createdAt: r.createdAt.toISOString(),
        completedAt: iso(r.completedAt),
      };
    });
  }
}
