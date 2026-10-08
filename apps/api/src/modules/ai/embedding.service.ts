import { Injectable, Logger } from '@nestjs/common';
import { normalizeTerm } from '@orbit/shared';
import { AppConfig } from '../../config/app-config';
import { SKILLS } from '../../catalog/skills.catalog';

export const EMBEDDING_DIM = 768;

const STOPWORDS = new Set(
  'a an and are as at be by for from has have in into is it its of on or that the this to was were will with you your our we their they i me my about over under than then so not'.split(
    ' ',
  ),
);

/**
 * Replaceable embedding service backing pgvector similarity search.
 *
 * - `local`  : deterministic feature-hashing embeddings (768-d). No model,
 *              no cost, works offline. Skill aliases are canonicalised first so
 *              "Mixpanel" and "product metrics" land near "product analytics".
 * - `ollama` : real semantic embeddings via Ollama (e.g. nomic-embed-text, 768-d).
 *
 * Every stored vector is tagged with `modelTag` so spaces are never mixed.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger('Embeddings');
  private readonly aliasPatterns: [RegExp, string][];

  constructor(private readonly config: AppConfig) {
    this.aliasPatterns = SKILLS.flatMap((s) =>
      [s.name.toLowerCase(), ...s.aliases]
        .map((alias) => normalizeTerm(alias))
        .filter((alias) => alias.length >= 2)
        .map((alias) => [alias, ` skill_${s.slug.replace(/-/g, '_')} `] as [string, string]),
    )
      .sort((a, b) => b[0].length - a[0].length)
      .map(([alias, token]) => [
        new RegExp(`(?<![a-z0-9])${escapeRegExp(alias)}(?![a-z0-9])`, 'g'),
        token,
      ]);
  }

  get provider(): 'local' | 'ollama' {
    return this.config.env.EMBEDDING_PROVIDER;
  }

  get modelTag(): string {
    return this.provider === 'ollama' ? `ollama:${this.config.env.EMBEDDING_MODEL}` : `local-hash-${EMBEDDING_DIM}`;
  }

  async embed(text: string): Promise<number[]> {
    if (this.provider === 'ollama') return this.embedOllama(text);
    return this.embedLocal(text);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) out.push(await this.embed(t));
    return out;
  }

  static toSql(vector: number[]): string {
    return `[${vector.map((v) => (Number.isFinite(v) ? v.toFixed(6) : '0')).join(',')}]`;
  }

  static cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // -------------------------------------------------------------------------

  private canonicalize(text: string): string {
    let t = ` ${normalizeTerm(text)} `;
    for (const [pattern, token] of this.aliasPatterns) t = t.replace(pattern, token);
    return t;
  }

  embedLocal(text: string): number[] {
    const vec = new Array<number>(EMBEDDING_DIM).fill(0);
    const tokens = this.canonicalize(text)
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w));
    const features: [string, number][] = [];
    tokens.forEach((tok, i) => {
      const weight = tok.startsWith('skill_') ? 2.5 : 1;
      features.push([tok, weight]);
      if (tok.length > 4 && !tok.startsWith('skill_')) features.push([tok.slice(0, 5), 0.5]); // crude stemming
      if (i > 0) features.push([`${tokens[i - 1]}_${tok}`, 0.7]);
    });
    for (const [feature, weight] of features) {
      const h = fnv1a(feature);
      const idx = h % EMBEDDING_DIM;
      const sign = (h >>> 16) & 1 ? 1 : -1;
      vec[idx] += sign * weight;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }

  private async embedOllama(text: string): Promise<number[]> {
    const res = await fetch(`${this.config.env.OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.env.EMBEDDING_MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      this.logger.warn(`Ollama embedding failed (${res.status})`);
      throw new Error('Embedding provider unavailable');
    }
    const data = (await res.json()) as { embeddings?: number[][] };
    const vector = data.embeddings?.[0];
    if (!vector || vector.length !== EMBEDDING_DIM) {
      throw new Error(`Embedding model must return ${EMBEDDING_DIM} dimensions`);
    }
    return vector;
  }
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
