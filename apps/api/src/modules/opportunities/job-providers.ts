/**
 * Job provider adapters. Orbit never depends on a single source and never
 * scrapes restricted platforms. Every provider returns the same normalized DTO.
 *
 *   CuratedJobProvider     — reviewed demo/partner listings (always available)
 *   RemotiveJobProvider    — public API  https://remotive.com/api/remote-jobs
 *   ArbeitnowJobProvider   — public API  https://www.arbeitnow.com/api/job-board-api
 *   WeWorkRemotelyProvider — public RSS  https://weworkremotely.com (category feeds)
 */
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { OpportunityType, WorkMode } from '@orbit/shared';
import { normalizeTerm } from '@orbit/shared';
import { ROLES } from '../../catalog/roles.catalog';
import { detectSkills } from '../skills/skill-matcher';
import { CURATED_JOBS } from '../../catalog/seed-content';

export interface NormalizedJob {
  source: string;
  externalId: string | null;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: WorkMode;
  employmentType: OpportunityType;
  seniority: 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR';
  skills: string[];
  roleSlugs: string[];
  industry: string | null;
  applyUrl: string | null;
  salaryRange: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  deadline: Date | null;
  isDemo: boolean;
}

export interface JobQuery {
  roleSlugs: string[];
  keywords: string[];
}

export interface JobProvider {
  readonly name: string;
  readonly external: boolean;
  fetch(query: JobQuery): Promise<NormalizedJob[]>;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

export function dedupeKey(job: Pick<NormalizedJob, 'title' | 'company' | 'location'>): string {
  const base = `${normalizeTerm(job.title)}|${normalizeTerm(job.company)}|${normalizeTerm(job.location).split(' ')[0] ?? ''}`;
  return createHash('sha1').update(base).digest('hex');
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(br|\/p|\/li|\/h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

export function inferSeniority(title: string): NormalizedJob['seniority'] {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b|graduate|trainee|entry|junior associate|apprentice/.test(t)) return 'ENTRY';
  if (/\bjunior\b|\bjr\.?\b|associate/.test(t)) return 'JUNIOR';
  if (/senior|\bsr\.?\b|lead|principal|staff|head|director|manager of/.test(t)) return 'SENIOR';
  return 'MID';
}

export function inferEmploymentType(title: string, raw?: string | null): OpportunityType {
  const t = `${title} ${raw ?? ''}`.toLowerCase();
  if (/intern/.test(t)) return 'INTERNSHIP';
  if (/graduate program|graduate programme|management trainee/.test(t)) return 'GRADUATE_PROGRAM';
  if (/part[\s_-]?time|contract|freelance/.test(t)) return 'PART_TIME';
  return 'FULL_TIME';
}

export function inferRoles(title: string, description: string): string[] {
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  const scored = ROLES.map((r) => ({
    slug: r.slug,
    score: r.keywords.reduce((s, k) => s + (t.includes(k) ? 3 : 0) + (d.includes(k) ? 0.5 : 0), 0),
  }))
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((r) => r.slug);
}

export function inferSkills(text: string, extra: string[] = []): string[] {
  const hits = detectSkills(`${text} ${extra.join(' ')}`);
  return hits.slice(0, 10).map((h) => h.slug);
}

function finalize(job: Omit<NormalizedJob, 'skills' | 'roleSlugs' | 'seniority'> & { tags?: string[] }): NormalizedJob {
  const description = job.description.slice(0, 6000);
  return {
    ...job,
    description,
    seniority: inferSeniority(job.title),
    skills: inferSkills(`${job.title} ${description}`, job.tags ?? []),
    roleSlugs: inferRoles(job.title, description),
  };
}

/** Third-party feeds are untrusted: only http(s) links are stored and later rendered as hrefs. */
export function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

async function getJson(url: string, timeoutMs = 12_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Orbit-Career-Platform/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Orbit-Career-Platform/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export class CuratedJobProvider implements JobProvider {
  readonly name = 'curated';
  readonly external = false;

  async fetch(): Promise<NormalizedJob[]> {
    const now = Date.now();
    const day = 86_400_000;
    return CURATED_JOBS.map((j) =>
      finalize({
        source: 'curated',
        externalId: j.id,
        title: j.title,
        company: j.company,
        description: j.description,
        location: j.location,
        workMode: j.workMode,
        employmentType: j.employmentType,
        industry: j.industry,
        applyUrl: null,
        salaryRange: j.salaryRange ?? null,
        publishedAt: new Date(now - j.postedDaysAgo * day),
        expiresAt: new Date(now + (j.deadlineInDays + 14) * day),
        deadline: new Date(now + j.deadlineInDays * day),
        isDemo: true,
        tags: j.skills,
      }),
    );
  }
}

export class RemotiveJobProvider implements JobProvider {
  readonly name = 'remotive';
  readonly external = true;
  private static readonly CATEGORY: Record<string, string> = {
    'product-manager': 'product',
    'software-engineer': 'software-dev',
    'ai-engineer': 'data',
    'data-analyst': 'data',
    'ux-designer': 'design',
  };

  async fetch(query: JobQuery): Promise<NormalizedJob[]> {
    const categories = [...new Set(query.roleSlugs.map((r) => RemotiveJobProvider.CATEGORY[r]).filter(Boolean))];
    const out: NormalizedJob[] = [];
    for (const category of categories.slice(0, 2)) {
      const data = await getJson(`https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}&limit=25`);
      for (const j of data.jobs ?? []) {
        out.push(
          finalize({
            source: this.name,
            externalId: String(j.id),
            title: j.title,
            company: j.company_name,
            description: stripHtml(j.description ?? ''),
            location: j.candidate_required_location || 'Remote',
            workMode: 'REMOTE',
            employmentType: inferEmploymentType(j.title, j.job_type),
            industry: 'Technology',
            applyUrl: httpUrl(j.url),
            salaryRange: j.salary || null,
            publishedAt: j.publication_date ? new Date(j.publication_date) : null,
            expiresAt: null,
            deadline: null,
            isDemo: false,
            tags: j.tags ?? [],
          }),
        );
      }
    }
    return out;
  }
}

export class ArbeitnowJobProvider implements JobProvider {
  readonly name = 'arbeitnow';
  readonly external = true;

  async fetch(query: JobQuery): Promise<NormalizedJob[]> {
    const data = await getJson('https://www.arbeitnow.com/api/job-board-api');
    const keywords = query.keywords.map((k) => k.toLowerCase());
    return (data.data ?? [])
      .filter((j: any) => keywords.some((k) => `${j.title} ${(j.tags ?? []).join(' ')}`.toLowerCase().includes(k)))
      .slice(0, 30)
      .map((j: any) =>
        finalize({
          source: this.name,
          externalId: j.slug,
          title: j.title,
          company: j.company_name,
          description: stripHtml(j.description ?? ''),
          location: j.location || (j.remote ? 'Remote' : 'Europe'),
          workMode: j.remote ? 'REMOTE' : 'ONSITE',
          employmentType: inferEmploymentType(j.title, (j.job_types ?? []).join(' ')),
          industry: 'Technology',
          applyUrl: httpUrl(j.url),
          salaryRange: null,
          publishedAt: j.created_at ? new Date(j.created_at * 1000) : null,
          expiresAt: null,
          deadline: null,
          isDemo: false,
          tags: j.tags ?? [],
        }),
      );
  }
}

export class WeWorkRemotelyProvider implements JobProvider {
  readonly name = 'weworkremotely';
  readonly external = true;
  private static readonly FEEDS: Record<string, string> = {
    'product-manager': 'https://weworkremotely.com/categories/remote-product-jobs.rss',
    'software-engineer': 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
    'ux-designer': 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  };
  private readonly parser = new XMLParser({ ignoreAttributes: true });

  async fetch(query: JobQuery): Promise<NormalizedJob[]> {
    const feeds = [...new Set(query.roleSlugs.map((r) => WeWorkRemotelyProvider.FEEDS[r]).filter(Boolean))];
    const out: NormalizedJob[] = [];
    for (const feed of feeds.slice(0, 2)) {
      const xml = await getText(feed);
      const items = this.parser.parse(xml)?.rss?.channel?.item ?? [];
      for (const item of (Array.isArray(items) ? items : [items]).slice(0, 25)) {
        // WWR titles are "Company: Role"
        const [company, ...rest] = String(item.title ?? '').split(':');
        const title = rest.join(':').trim() || String(item.title);
        out.push(
          finalize({
            source: this.name,
            externalId: String(item.guid ?? item.link),
            title,
            company: company.trim() || 'Unknown company',
            description: stripHtml(String(item.description ?? '')),
            location: String(item.region ?? 'Remote'),
            workMode: 'REMOTE',
            employmentType: inferEmploymentType(title, String(item.type ?? '')),
            industry: 'Technology',
            applyUrl: httpUrl(item.link),
            salaryRange: null,
            publishedAt: item.pubDate ? new Date(item.pubDate) : null,
            expiresAt: null,
            deadline: null,
            isDemo: false,
          }),
        );
      }
    }
    return out;
  }
}
