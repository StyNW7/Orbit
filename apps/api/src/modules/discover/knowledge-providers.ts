/**
 * Book and research-paper provider adapters (free public APIs), normalized
 * into Orbit's internal models.
 *
 *   Books : Google Books API, Open Library Search API
 *   Papers: OpenAlex, Semantic Scholar Graph API
 */
import { createHash } from 'node:crypto';
import { normalizeTerm } from '@orbit/shared';
import { inferRoles, inferSkills, stripHtml } from '../opportunities/job-providers';

export interface NormalizedBook {
  source: string;
  externalId: string | null;
  title: string;
  authors: string[];
  description: string;
  coverUrl: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  infoUrl: string | null;
  skills: string[];
  roleSlugs: string[];
}

export interface NormalizedPaper {
  source: string;
  externalId: string | null;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string;
  url: string | null;
  doi: string | null;
  citationCount: number | null;
  skills: string[];
  roleSlugs: string[];
}

export interface BookProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<NormalizedBook[]>;
}

export interface PaperProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<NormalizedPaper[]>;
}

export const titleKey = (title: string, extra = '') =>
  createHash('sha1').update(`${normalizeTerm(title)}|${normalizeTerm(extra)}`).digest('hex');

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 10_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Orbit-Career-Platform/1.0', ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

export class GoogleBooksProvider implements BookProvider {
  readonly name = 'google-books';
  constructor(private readonly apiKey?: string) {}

  async search(query: string, limit: number): Promise<NormalizedBook[]> {
    const key = this.apiKey ? `&key=${this.apiKey}` : '';
    const data = await getJson(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}&printType=books&langRestrict=en${key}`,
    );
    return (data.items ?? [])
      .map((item: any) => {
        const v = item.volumeInfo ?? {};
        const description = stripHtml(v.description ?? '');
        if (!v.title || description.length < 40) return null;
        return {
          source: this.name,
          externalId: item.id,
          title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
          authors: v.authors ?? [],
          description: description.slice(0, 1500),
          coverUrl: v.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
          publishedYear: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) || null : null,
          pageCount: v.pageCount ?? null,
          infoUrl: v.infoLink ?? null,
          skills: inferSkills(`${v.title} ${description} ${(v.categories ?? []).join(' ')}`),
          roleSlugs: inferRoles(v.title, description),
        } satisfies NormalizedBook;
      })
      .filter(Boolean) as NormalizedBook[];
  }
}

export class OpenLibraryProvider implements BookProvider {
  readonly name = 'open-library';

  async search(query: string, limit: number): Promise<NormalizedBook[]> {
    const data = await getJson(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject`,
    );
    return (data.docs ?? []).map((d: any) => {
      const subjects = (d.subject ?? []).slice(0, 12).join(', ');
      return {
        source: this.name,
        externalId: d.key,
        title: d.title,
        authors: d.author_name ?? [],
        description: subjects ? `Topics: ${subjects}.` : 'Book from Open Library.',
        coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
        publishedYear: d.first_publish_year ?? null,
        pageCount: d.number_of_pages_median ?? null,
        infoUrl: d.key ? `https://openlibrary.org${d.key}` : null,
        skills: inferSkills(`${d.title} ${subjects}`),
        roleSlugs: inferRoles(d.title, subjects),
      } satisfies NormalizedBook;
    });
  }
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------

function reconstructAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(' ');
}

export class OpenAlexProvider implements PaperProvider {
  readonly name = 'openalex';
  constructor(private readonly email?: string) {}

  async search(query: string, limit: number): Promise<NormalizedPaper[]> {
    const mailto = this.email ? `&mailto=${encodeURIComponent(this.email)}` : '';
    const data = await getJson(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&filter=has_abstract:true&sort=relevance_score:desc${mailto}`,
    );
    return (data.results ?? []).map((w: any) => {
      const abstract = reconstructAbstract(w.abstract_inverted_index).slice(0, 2000);
      const title = w.display_name ?? w.title ?? 'Untitled';
      return {
        source: this.name,
        externalId: w.id,
        title,
        authors: (w.authorships ?? []).slice(0, 6).map((a: any) => a.author?.display_name).filter(Boolean),
        year: w.publication_year ?? null,
        venue: w.primary_location?.source?.display_name ?? null,
        abstract,
        url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
        doi: w.doi ?? null,
        citationCount: w.cited_by_count ?? null,
        skills: inferSkills(`${title} ${abstract}`),
        roleSlugs: inferRoles(title, abstract),
      } satisfies NormalizedPaper;
    });
  }
}

export class SemanticScholarProvider implements PaperProvider {
  readonly name = 'semantic-scholar';
  constructor(private readonly apiKey?: string) {}

  async search(query: string, limit: number): Promise<NormalizedPaper[]> {
    const data = await getJson(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,year,authors,venue,url,citationCount,externalIds`,
      this.apiKey ? { 'x-api-key': this.apiKey } : {},
    );
    return (data.data ?? [])
      .filter((p: any) => p.abstract)
      .map((p: any) => ({
        source: this.name,
        externalId: p.paperId,
        title: p.title,
        authors: (p.authors ?? []).slice(0, 6).map((a: any) => a.name),
        year: p.year ?? null,
        venue: p.venue || null,
        abstract: String(p.abstract).slice(0, 2000),
        url: p.url ?? null,
        doi: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null,
        citationCount: p.citationCount ?? null,
        skills: inferSkills(`${p.title} ${p.abstract}`),
        roleSlugs: inferRoles(p.title, p.abstract),
      }));
  }
}
