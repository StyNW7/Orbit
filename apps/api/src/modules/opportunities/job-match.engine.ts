/**
 * Hybrid job matching — deterministic ranking with explainable components.
 *
 *   Role Alignment 25% · Skill Match 25% · Experience Match 20%
 *   Preference Match 15% · Career Goal Match 15%
 *
 * Vector similarity (pgvector) is only one *input* to role/goal alignment;
 * it never decides the score alone.
 */
import {
  JOB_MATCH_WEIGHTS,
  type ExperienceType,
  type JobMatchComponent,
  type OpportunityType,
  type WorkMode,
} from '@orbit/shared';
import { L } from '../../common/i18n/locale';

export interface MatchJob {
  title: string;
  description: string;
  skills: string[]; // skill slugs
  roleSlugs: string[];
  workMode: WorkMode;
  employmentType: OpportunityType;
  location: string;
  seniority: 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR';
  industry: string | null;
}

export interface MatchUser {
  skillLevels: Map<string, number>; // by slug
  skillNames: Map<string, string>; // slug -> display name
  primaryRole: { slug: string; title: string; keywords: string[] } | null;
  otherRoleSlugs: string[];
  experiences: { type: ExperienceType; months: number }[];
  isStudent: boolean;
  technicalBackground: boolean;
  preferences: {
    workModes: WorkMode[];
    roleTypes: OpportunityType[];
    locations: string[];
    industries: string[];
  };
  /** skills the user is already working on in a journey (by slug) */
  journeySkillSlugs: Set<string>;
}

export interface MatchSkillGap {
  slug: string;
  name: string;
  inJourney: boolean;
}

export interface JobMatchComputation {
  overall: number;
  components: Record<JobMatchComponent, number>;
  matchedSkills: string[];
  missingSkills: MatchSkillGap[];
  reasons: string[];
  recommendedAction: string;
}

const MATCHED_THRESHOLD = 40;
const SKILL_TARGET = 60;

const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100);

function keywordHit(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

export function roleAlignment(job: MatchJob, user: MatchUser, similarity: number | null): number {
  let rule = 0.2;
  if (user.primaryRole) {
    if (job.roleSlugs.includes(user.primaryRole.slug)) {
      rule = 0.8 + (keywordHit(job.title, user.primaryRole.keywords) ? 0.2 : 0.1);
    } else if (job.roleSlugs.some((r) => user.otherRoleSlugs.includes(r))) {
      rule = 0.6;
    } else if (keywordHit(`${job.title} ${job.description}`, user.primaryRole.keywords)) {
      rule = 0.5;
    }
  }
  return similarity === null ? rule : rule * 0.75 + similarity * 0.25;
}

export function skillMatch(job: MatchJob, user: MatchUser): { score: number; matched: string[]; missing: MatchSkillGap[] } {
  if (job.skills.length === 0) return { score: 0.6, matched: [], missing: [] };
  let sum = 0;
  const matched: { name: string; level: number }[] = [];
  const missing: MatchSkillGap[] = [];
  for (const slug of job.skills) {
    const level = user.skillLevels.get(slug) ?? 0;
    sum += Math.min(1, level / SKILL_TARGET);
    const name = user.skillNames.get(slug) ?? slug;
    if (level >= MATCHED_THRESHOLD) matched.push({ name, level });
    else missing.push({ slug, name, inJourney: user.journeySkillSlugs.has(slug) });
  }
  matched.sort((a, b) => b.level - a.level);
  return { score: sum / job.skills.length, matched: matched.map((m) => m.name), missing };
}

export function experienceMatch(job: MatchJob, user: MatchUser): number {
  const relevantTypes: ExperienceType[] = ['PROJECT', 'ORGANIZATION', 'LEADERSHIP', 'INTERNSHIP', 'WORK', 'COMPETITION', 'RESEARCH'];
  const relevant = user.experiences.filter((e) => relevantTypes.includes(e.type));
  const professional = user.experiences.filter((e) => e.type === 'WORK' || e.type === 'INTERNSHIP');
  const months = professional.reduce((m, e) => m + e.months, 0);
  const isEntry = job.employmentType === 'INTERNSHIP' || job.employmentType === 'GRADUATE_PROGRAM' || job.seniority === 'ENTRY';
  if (isEntry) return 0.55 + 0.45 * Math.min(1, relevant.length / 3);
  const required = job.seniority === 'JUNIOR' ? 12 : job.seniority === 'MID' ? 36 : 60;
  const base = Math.min(1, months / required);
  return Math.max(user.isStudent ? 0.15 : 0.25, base * 0.85 + Math.min(1, relevant.length / 4) * 0.15);
}

export function preferenceMatch(job: MatchJob, user: MatchUser): number {
  const p = user.preferences;
  const parts: number[] = [];
  parts.push(p.workModes.length === 0 ? 0.75 : p.workModes.includes(job.workMode) ? 1 : 0.35);
  parts.push(p.roleTypes.length === 0 ? 0.75 : p.roleTypes.includes(job.employmentType) ? 1 : 0.3);
  if (p.locations.length === 0) parts.push(0.75);
  else {
    const loc = job.location.toLowerCase();
    const hit = job.workMode === 'REMOTE' || p.locations.some((l) => loc.includes(l.toLowerCase()) || l.toLowerCase().includes(loc));
    parts.push(hit ? 1 : 0.4);
  }
  if (p.industries.length > 0 && job.industry) {
    parts.push(p.industries.some((i) => i.toLowerCase() === job.industry!.toLowerCase()) ? 1 : 0.5);
  }
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function careerGoalMatch(job: MatchJob, user: MatchUser, similarity: number | null): number {
  let rule = 0.25;
  if (user.primaryRole && job.roleSlugs.includes(user.primaryRole.slug)) rule = 1;
  else if (job.roleSlugs.some((r) => user.otherRoleSlugs.includes(r))) rule = 0.7;
  else if (user.primaryRole && keywordHit(job.description, user.primaryRole.keywords)) rule = 0.45;
  return similarity === null ? rule : rule * 0.8 + similarity * 0.2;
}

export function computeJobMatch(job: MatchJob, user: MatchUser, similarity: number | null = null): JobMatchComputation {
  const skills = skillMatch(job, user);
  const raw: Record<JobMatchComponent, number> = {
    roleAlignment: roleAlignment(job, user, similarity),
    skillMatch: skills.score,
    experienceMatch: experienceMatch(job, user),
    preferenceMatch: preferenceMatch(job, user),
    careerGoalMatch: careerGoalMatch(job, user, similarity),
  };
  const overall = (Object.keys(JOB_MATCH_WEIGHTS) as JobMatchComponent[]).reduce(
    (sum, k) => sum + raw[k] * JOB_MATCH_WEIGHTS[k],
    0,
  );
  const components = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, pct(v)])) as Record<JobMatchComponent, number>;

  const reasons: string[] = [];
  const types = new Set(user.experiences.map((e) => e.type));
  if (types.has('LEADERSHIP') || types.has('ORGANIZATION')) reasons.push(L('Leadership', 'Kepemimpinan'));
  if (user.technicalBackground) reasons.push(L('Technical Background', 'Latar Belakang Teknis'));
  if (types.has('PROJECT')) reasons.push(L('Project Experience', 'Pengalaman Proyek'));
  for (const s of skills.matched) {
    if (reasons.length >= 5) break;
    if (!reasons.includes(s)) reasons.push(s);
  }

  const firstGap = skills.missing[0];
  const recommendedAction = firstGap
    ? firstGap.inJourney
      ? L(`Keep progressing ${firstGap.name} in your Journey`, `Lanjutkan progres ${firstGap.name} di Journey-mu`)
      : L(`Add ${firstGap.name} to Journey`, `Tambahkan ${firstGap.name} ke Journey`)
    : L('Prepare your application', 'Siapkan lamaranmu');

  return {
    overall: pct(overall),
    components,
    matchedSkills: skills.matched,
    missingSkills: skills.missing,
    reasons: reasons.slice(0, 5),
    recommendedAction,
  };
}
