import { SKILL_LEVELS } from './constants';

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human label for a 0–100 proficiency value. */
export function skillLevelLabel(level: number): string {
  let label: string = SKILL_LEVELS[0].label;
  for (const band of SKILL_LEVELS) {
    if (level >= band.min) label = band.label;
  }
  return label;
}

/** XP needed to *reach* a given Orbit Level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return (75 * (l - 1) * l);
}

export interface OrbitLevel {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  /** 0–100 progress towards next level */
  progress: number;
}

export function levelFromXp(xp: number): OrbitLevel {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);
  return { level, xp, currentLevelXp, nextLevelXp, progress: clamp(progress) };
}

export function readinessBand(score: number): { label: string; tone: 'low' | 'mid' | 'high' } {
  if (score >= 80) return { label: 'Career-ready', tone: 'high' };
  if (score >= 65) return { label: 'Almost there', tone: 'high' };
  if (score >= 45) return { label: 'Building momentum', tone: 'mid' };
  return { label: 'Getting started', tone: 'low' };
}

export function percent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Lowercased, punctuation-light key used to compare skill names and aliases. */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
