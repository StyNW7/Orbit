import { Injectable, Logger } from '@nestjs/common';
import type { RecommendationWhy, SkillGapView } from '@orbit/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import { CareerContextService, type CareerContext } from '../career/career-context.service';

export type VectorTable = 'Opportunity' | 'Book' | 'ResearchPaper' | 'Event' | 'Resource' | 'RoleModel';

export interface UserSignal {
  ctx: CareerContext;
  gaps: SkillGapView[];
  gapSeverity: Map<string, number>; // slug -> severity
  roleSlugs: string[]; // primary first
  primaryRoleTitle: string | null;
  vector: number[] | null;
}

const CACHE_TTL_MS = 2 * 60_000;

/**
 * Hybrid recommendation engine shared by jobs, growth, knowledge and people.
 *   candidate generation : structured filters  +  pgvector similarity
 *   ranking              : deterministic scoring
 *   explanation          : templated "why", optionally enriched by the LLM
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger('Recommendations');
  private readonly vectorCache = new Map<string, { key: string; vector: number[]; at: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
    private readonly context: CareerContextService,
  ) {}

  async signal(userId: string, ctx?: CareerContext): Promise<UserSignal> {
    const c = ctx ?? (await this.context.load(userId));
    const gaps = this.context.gapsFor(c);
    const roleSlugs = c.goals.map((g) => g.role.slug);
    return {
      ctx: c,
      gaps,
      gapSeverity: new Map(gaps.map((g) => [g.slug, g.severity])),
      roleSlugs,
      primaryRoleTitle: c.primaryGoal?.role.title ?? null,
      vector: await this.profileVector(c, gaps),
    };
  }

  /** Embedding of the user's career intent: target role, gaps, strengths, interests. */
  private async profileVector(ctx: CareerContext, gaps: SkillGapView[]): Promise<number[] | null> {
    const role = ctx.primaryGoal?.role;
    const strengths = [...ctx.skillLevelsBySlug.entries()]
      .filter(([, l]) => l >= 50)
      .map(([slug]) => SKILL_BY_SLUG.get(slug)?.name ?? slug);
    const text = [
      role ? `${role.title}. ${role.description}` : '',
      gaps.length ? `Learning goals: ${gaps.map((g) => g.name).join(', ')}` : '',
      strengths.length ? `Strengths: ${strengths.join(', ')}` : '',
      ctx.profile?.interests?.length ? `Interests: ${ctx.profile.interests.join(', ')}` : '',
      ctx.profile?.headline ?? '',
    ].join('. ');
    const cached = this.vectorCache.get(ctx.user.id);
    if (cached && cached.key === text && Date.now() - cached.at < CACHE_TTL_MS) return cached.vector;
    try {
      const vector = await this.embeddings.embed(text);
      this.vectorCache.set(ctx.user.id, { key: text, vector, at: Date.now() });
      return vector;
    } catch (error) {
      this.logger.warn(`Profile embedding unavailable: ${(error as Error).message}`);
      return null;
    }
  }

  /** pgvector nearest neighbours. Returns id -> cosine similarity (0..1). */
  async vectorCandidates(table: VectorTable, vector: number[] | null, limit = 60, extraWhere = 'TRUE'): Promise<Map<string, number>> {
    if (!vector) return new Map();
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ id: string; similarity: number }[]>(
        `SELECT id::text AS id, 1 - (embedding <=> $1::vector) AS similarity
           FROM "${table}"
          WHERE embedding IS NOT NULL AND "embeddingModel" = $2 AND ${extraWhere}
          ORDER BY embedding <=> $1::vector
          LIMIT $3`,
        EmbeddingService.toSql(vector),
        this.embeddings.modelTag,
        limit,
      );
      return new Map(rows.map((r) => [r.id, Math.max(0, Math.min(1, Number(r.similarity)))]));
    } catch (error) {
      this.logger.warn(`Vector search on ${table} failed: ${(error as Error).message}`);
      return new Map();
    }
  }

  /** Store an embedding for any recommendable row. */
  async storeEmbedding(table: VectorTable, id: string, text: string): Promise<void> {
    try {
      const vector = await this.embeddings.embed(text);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET embedding = $1::vector, "embeddingModel" = $2 WHERE id = $3::uuid`,
        EmbeddingService.toSql(vector),
        this.embeddings.modelTag,
        id,
      );
    } catch (error) {
      this.logger.warn(`Embedding for ${table}:${id} skipped: ${(error as Error).message}`);
    }
  }

  /** Deterministic relevance for a knowledge/growth item (0–100). */
  relevance(signal: UserSignal, item: { skills: string[]; roleSlugs: string[] }, similarity: number | undefined): number {
    const maxSeverity = Math.max(1, ...signal.gaps.map((g) => g.severity));
    const gapScore = item.skills.reduce((best, s) => Math.max(best, (signal.gapSeverity.get(s) ?? 0) / maxSeverity), 0);
    const skillOverlap = item.skills.some((s) => signal.ctx.skillLevelsBySlug.has(s)) ? 0.4 : 0;
    const primary = signal.roleSlugs[0];
    const roleScore = primary && item.roleSlugs.includes(primary) ? 1 : item.roleSlugs.some((r) => signal.roleSlugs.includes(r)) ? 0.6 : 0;
    const sim = similarity ?? 0;
    const score = Math.max(gapScore, skillOverlap) * 0.5 + roleScore * 0.3 + sim * 0.2;
    return Math.round(Math.min(1, score) * 100);
  }

  /** The gap (by severity) this item helps close, if any. */
  topGapFor(signal: UserSignal, skills: string[]): SkillGapView | null {
    return signal.gaps.find((g) => skills.includes(g.slug)) ?? null;
  }

  why(signal: UserSignal, skills: string[], kind: string): RecommendationWhy {
    const gap = this.topGapFor(signal, skills);
    const skill = gap?.name ?? skills.map((s) => SKILL_BY_SLUG.get(s)?.name).find(Boolean) ?? null;
    const role = signal.primaryRoleTitle;
    let whyItMatters: string;
    if (gap) {
      whyItMatters = `${gap.name} is ${signal.gaps[0]?.slug === gap.slug ? 'your largest' : 'an open'} ${role ?? 'career'} gap (${gap.currentLevel} of ${gap.requiredLevel}). This ${kind} builds it directly.`;
    } else if (skill && role) {
      whyItMatters = `Strengthens ${skill}, which ${role} roles rely on.`;
    } else if (role) {
      whyItMatters = `Relevant to your ${role} direction.`;
    } else {
      whyItMatters = `Matches the interests in your profile.`;
    }
    return {
      whyItMatters,
      improvesSkill: skill,
      supportsGoal: role,
      addressesGap: gap?.name ?? null,
    };
  }
}
