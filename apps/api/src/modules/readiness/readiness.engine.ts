/**
 * Career Readiness Engine — deterministic, explainable, configurable.
 *
 * The LLM never computes this score. It may only *explain* it.
 * Each category returns a 0–1 ratio plus human-readable details; the total is
 * a weighted sum (weights default to DEFAULT_READINESS_WEIGHTS and can be
 * overridden with READINESS_WEIGHTS).
 */
import {
  DEFAULT_READINESS_WEIGHTS,
  READINESS_CATEGORIES,
  READINESS_CATEGORY_LABELS,
  type ApplicationStatus,
  type ExperienceType,
  type QuestCategory,
  type ReadinessCategory,
  type ReadinessCategoryResult,
} from '@orbit/shared';
import type { ExperienceSignal } from '../../catalog/roles.catalog';

export interface ReadinessRequirement {
  skillId: string;
  skillName: string;
  requiredLevel: number;
  importance: number;
}

export interface ReadinessExperience {
  type: ExperienceType;
  title: string;
  organization: string;
  description: string | null;
  skills: string[];
  startDate: Date | null;
  endDate: Date | null;
  current: boolean;
}

export interface ReadinessQuest {
  category: QuestCategory;
  impact: ReadinessCategory;
  progress: number;
}

export interface ReadinessInput {
  role: { slug: string; title: string; requirements: ReadinessRequirement[]; experienceSignals: ExperienceSignal[] };
  /** effective proficiency per skillId (base level + quest progress) */
  skillLevels: Map<string, number>;
  experiences: ReadinessExperience[];
  achievements: { type: 'AWARD' | 'CERTIFICATION' | 'PUBLICATION'; title: string }[];
  quests: ReadinessQuest[];
  evidence: { type: string }[];
  knowledgeCompleted: number;
  educationCount: number;
  profile: {
    hasCv: boolean;
    hasHeadline: boolean;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    githubUrl: string | null;
    skillCount: number;
  };
  applications: { status: ApplicationStatus; prepProgress: number }[];
  interviews: { completed: boolean; averageScore: number | null }[];
  weights?: Partial<Record<ReadinessCategory, number>>;
  now?: Date;
}

export interface ReadinessComputation {
  /** 0–100 with one decimal */
  score: number;
  breakdown: ReadinessCategoryResult[];
  ratios: Record<ReadinessCategory, number>;
}

const PORTFOLIO_TARGET = 4;
const KNOWLEDGE_TARGET = 6;
/** Partial skill credit is convex: being halfway to the required level is worth less than half. */
const SKILL_CURVE = 1.5;
const PARTIAL_EXPERIENCE_CREDIT = 0.4;
const ADVANCED_APPLICATION: ApplicationStatus[] = ['PREPARING', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER'];

const ratio = (value: number, target: number) => (target <= 0 ? 1 : Math.min(1, Math.max(0, value / target)));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function normalizeWeights(weights?: Partial<Record<ReadinessCategory, number>>): Record<ReadinessCategory, number> {
  const merged = { ...DEFAULT_READINESS_WEIGHTS, ...(weights ?? {}) };
  const total = READINESS_CATEGORIES.reduce((sum, c) => sum + Math.max(0, merged[c]), 0);
  if (total <= 0) return { ...DEFAULT_READINESS_WEIGHTS };
  return Object.fromEntries(READINESS_CATEGORIES.map((c) => [c, Math.max(0, merged[c]) / total])) as Record<
    ReadinessCategory,
    number
  >;
}

function monthsBetween(start: Date | null, end: Date | null, now: Date): number {
  if (!start) return 0;
  const to = end ?? now;
  return Math.max(0, (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth()));
}

function experienceText(e: ReadinessExperience): string {
  return `${e.title} ${e.organization} ${e.description ?? ''} ${e.skills.join(' ')}`.toLowerCase();
}

function questProgress(quests: ReadinessQuest[], predicate: (q: ReadinessQuest) => boolean): number {
  return quests.filter(predicate).reduce((sum, q) => sum + q.progress / 100, 0);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function scoreSkills(input: ReadinessInput): { ratio: number; details: string[] } {
  const reqs = input.role.requirements;
  if (reqs.length === 0) return { ratio: 0, details: ['No skill requirements defined for this role.'] };
  let weighted = 0;
  let totalImportance = 0;
  let met = 0;
  for (const r of reqs) {
    const level = input.skillLevels.get(r.skillId) ?? 0;
    weighted += r.importance * Math.pow(Math.min(1, level / r.requiredLevel), SKILL_CURVE);
    totalImportance += r.importance;
    if (level >= r.requiredLevel) met += 1;
  }
  return {
    ratio: weighted / totalImportance,
    details: [`${met} of ${reqs.length} required skills at target level`],
  };
}

export function scoreExperience(input: ReadinessInput): { ratio: number; details: string[] } {
  const now = input.now ?? new Date();
  const details: string[] = [];
  let total = 0;
  for (const signal of input.role.experienceSignals) {
    let satisfied = 0;
    if (signal.types.length === 0) {
      // tenure signal: total months across all experiences
      const months = input.experiences.reduce((m, e) => m + monthsBetween(e.startDate, e.current ? null : e.endDate, now), 0);
      satisfied = Math.min(1, months / 12);
    } else {
      for (const e of input.experiences) {
        if (!signal.types.includes(e.type)) continue;
        const text = experienceText(e);
        const keywordHit = signal.keywords.length === 0 || signal.keywords.some((k) => text.includes(k));
        satisfied = Math.max(satisfied, keywordHit ? 1 : PARTIAL_EXPERIENCE_CREDIT);
      }
    }
    total += signal.weight * satisfied;
    details.push(`${signal.label}: ${satisfied >= 1 ? 'met' : satisfied > 0 ? 'partially met' : 'missing'}`);
  }
  const questBonus = questProgress(input.quests, (q) => q.impact === 'EXPERIENCE') * 0.15;
  return { ratio: Math.min(1, total + questBonus), details };
}

export function scorePortfolio(input: ReadinessInput): { ratio: number; details: string[] } {
  const projects = input.experiences.filter((e) => e.type === 'PROJECT').length;
  const awards = input.achievements.filter((a) => a.type === 'AWARD' || a.type === 'PUBLICATION').length;
  const questUnits = questProgress(input.quests, (q) => q.impact === 'PORTFOLIO' || q.category === 'PROJECT' || q.category === 'PORTFOLIO');
  const evidenceUnits = input.evidence.filter((e) => ['GITHUB', 'PORTFOLIO', 'URL', 'FILE'].includes(e.type)).length * 0.25;
  const linkUnits = input.profile.portfolioUrl || input.profile.githubUrl ? 0.5 : 0;
  const units = projects + awards * 0.5 + questUnits + evidenceUnits + linkUnits;
  return {
    ratio: ratio(units, PORTFOLIO_TARGET),
    details: [
      `${projects} project${projects === 1 ? '' : 's'} on record`,
      `${awards} award${awards === 1 ? '' : 's'} or publication${awards === 1 ? '' : 's'}`,
      linkUnits ? 'Public portfolio or GitHub linked' : 'No public portfolio linked yet',
    ],
  };
}

export function scoreKnowledge(input: ReadinessInput): { ratio: number; details: string[] } {
  const certifications = input.achievements.filter((a) => a.type === 'CERTIFICATION').length;
  const learningQuests = questProgress(
    input.quests,
    (q) => q.category === 'KNOWLEDGE' || q.category === 'CERTIFICATION' || q.category === 'SKILL',
  );
  const units = input.knowledgeCompleted + certifications + Math.min(1, input.educationCount) * 0.5 + learningQuests * 0.5;
  return {
    ratio: ratio(units, KNOWLEDGE_TARGET),
    details: [
      `${input.knowledgeCompleted} books, papers or courses completed`,
      `${certifications} certification${certifications === 1 ? '' : 's'}`,
    ],
  };
}

export function scoreApplication(input: ReadinessInput): { ratio: number; details: string[] } {
  const p = input.profile;
  let score = 0;
  const details: string[] = [];
  if (p.hasCv) score += 0.3;
  details.push(p.hasCv ? 'CV uploaded and analysed' : 'Upload your CV');
  const completeness =
    (p.hasHeadline ? 0.075 : 0) +
    (input.educationCount > 0 ? 0.075 : 0) +
    (input.experiences.length >= 2 ? 0.075 : 0) +
    (p.skillCount >= 5 ? 0.075 : 0);
  score += completeness;
  details.push(`Profile ${Math.round((completeness / 0.3) * 100)}% complete`);
  if (p.linkedinUrl) score += 0.1;
  if (p.portfolioUrl || p.githubUrl) score += 0.1;
  const active = input.applications.some((a) => ADVANCED_APPLICATION.includes(a.status) || a.prepProgress > 0);
  if (active) score += 0.1;
  details.push(active ? 'Application preparation underway' : 'No application in preparation yet');
  score += Math.min(0.1, questProgress(input.quests, (q) => q.impact === 'APPLICATION') * 0.1);
  return { ratio: Math.min(1, score), details };
}

export function scoreInterview(input: ReadinessInput, communicationSkillIds: string[]): { ratio: number; details: string[] } {
  const softLevels = communicationSkillIds.map((id) => input.skillLevels.get(id) ?? 0);
  const soft = softLevels.length ? softLevels.reduce((s, l) => s + Math.min(1, l / 70), 0) / softLevels.length : 0;
  const completed = input.interviews.filter((i) => i.completed);
  const practiceVolume = Math.min(1, completed.length / 3);
  const scored = completed.filter((i) => i.averageScore !== null);
  const avg = scored.length ? scored.reduce((s, i) => s + (i.averageScore ?? 0), 0) / scored.length / 100 : 0;
  const questBonus = Math.min(0.2, questProgress(input.quests, (q) => q.impact === 'INTERVIEW') * 0.2);
  const value = soft * 0.4 + practiceVolume * 0.3 + avg * 0.3 + questBonus;
  return {
    ratio: Math.min(1, value),
    details: [
      `${completed.length} practice session${completed.length === 1 ? '' : 's'} completed`,
      scored.length ? `Average coaching score ${Math.round(avg * 100)}` : 'No practice feedback yet',
    ],
  };
}

// ---------------------------------------------------------------------------
// Total
// ---------------------------------------------------------------------------

export function computeReadiness(input: ReadinessInput, communicationSkillIds: string[] = []): ReadinessComputation {
  const weights = normalizeWeights(input.weights);
  const results: Record<ReadinessCategory, { ratio: number; details: string[] }> = {
    SKILL: scoreSkills(input),
    EXPERIENCE: scoreExperience(input),
    PORTFOLIO: scorePortfolio(input),
    KNOWLEDGE: scoreKnowledge(input),
    APPLICATION: scoreApplication(input),
    INTERVIEW: scoreInterview(input, communicationSkillIds),
  };
  const breakdown: ReadinessCategoryResult[] = READINESS_CATEGORIES.map((category) => {
    const r = results[category];
    return {
      category,
      label: READINESS_CATEGORY_LABELS[category],
      score: Math.round(r.ratio * 100),
      weight: weights[category],
      contribution: round1(r.ratio * weights[category] * 100),
      details: r.details,
    };
  });
  const score = round1(READINESS_CATEGORIES.reduce((sum, c) => sum + results[c].ratio * weights[c] * 100, 0));
  const ratios = Object.fromEntries(READINESS_CATEGORIES.map((c) => [c, results[c].ratio])) as Record<ReadinessCategory, number>;
  return { score, breakdown, ratios };
}
