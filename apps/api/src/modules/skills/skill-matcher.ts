import { normalizeTerm } from '@orbit/shared';
import { SKILLS, type SkillDefinition } from '../../catalog/skills.catalog';
import { escapeRegExp } from '../ai/embedding.service';

export interface SkillHit {
  slug: string;
  name: string;
  hits: number;
}

/** Aliases that are too ambiguous to count on their own in free text. */
const WEAK_ALIASES = new Set(['js', 'ts', 'node', 'api', 'query', 'analysis', 'writing', 'cloud', 'lead ', 'led ', 'ml', 'mc', 'pitch', 'mvp', 'qa']);

const PATTERNS: { skill: SkillDefinition; pattern: RegExp; weak: boolean }[] = SKILLS.flatMap((skill) =>
  [skill.name.toLowerCase(), ...skill.aliases].map((alias) => ({
    skill,
    weak: WEAK_ALIASES.has(alias),
    pattern: new RegExp(`(?<![a-z0-9])${escapeRegExp(normalizeTerm(alias))}(?![a-z0-9])`, 'g'),
  })),
);

/** Detect catalog skills mentioned in free text (CV, job post, note). */
export function detectSkills(text: string, minHits = 1): SkillHit[] {
  const t = ` ${normalizeTerm(text)} `;
  const counts = new Map<string, SkillHit>();
  for (const { skill, pattern, weak } of PATTERNS) {
    const matches = t.match(pattern)?.length ?? 0;
    if (!matches) continue;
    const entry = counts.get(skill.slug) ?? { slug: skill.slug, name: skill.name, hits: 0 };
    entry.hits += weak ? matches * 0.5 : matches;
    counts.set(skill.slug, entry);
  }
  return [...counts.values()].filter((h) => h.hits >= minHits).sort((a, b) => b.hits - a.hits);
}

/** Resolve a free-form skill name to a catalog slug when possible. */
export function resolveSkillSlug(name: string): string | null {
  const n = normalizeTerm(name);
  for (const skill of SKILLS) {
    if (skill.slug === n || normalizeTerm(skill.name) === n) return skill.slug;
    if (skill.aliases.some((a) => normalizeTerm(a) === n)) return skill.slug;
  }
  const detected = detectSkills(name);
  return detected[0]?.slug ?? null;
}
