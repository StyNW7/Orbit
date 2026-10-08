/**
 * CV → structured profile.
 *
 * 1. Structured AI extraction (when a model is reachable), validated with Zod.
 * 2. Deterministic heuristic parser as a fallback (and as a sanity net).
 * Either way the output is normalised into the same ExtractedProfile shape,
 * skills are mapped onto Orbit's catalog, and proficiency is estimated
 * conservatively from evidence in the CV.
 */
import { z } from 'zod';
import type { ExperienceType } from '@orbit/shared';
import { clamp, normalizeTerm } from '@orbit/shared';
import { detectSkills, resolveSkillSlug } from '../skills/skill-matcher';

export const ExtractedSchema = z.object({
  headline: z.string().max(200).nullish(),
  summary: z.string().max(1500).nullish(),
  currentStatus: z.string().max(120).nullish(),
  location: z.string().max(120).nullish(),
  linkedinUrl: z.string().max(300).nullish(),
  githubUrl: z.string().max(300).nullish(),
  portfolioUrl: z.string().max(300).nullish(),
  education: z
    .array(
      z.object({
        institution: z.string().min(2).max(200),
        degree: z.string().max(200).nullish(),
        field: z.string().max(200).nullish(),
        startDate: z.string().max(40).nullish(),
        endDate: z.string().max(40).nullish(),
        gpa: z.string().max(40).nullish(),
      }),
    )
    .max(6)
    .default([]),
  experiences: z
    .array(
      z.object({
        type: z.enum(['WORK', 'INTERNSHIP', 'ORGANIZATION', 'PROJECT', 'COMPETITION', 'VOLUNTEER', 'LEADERSHIP', 'RESEARCH']).catch('WORK'),
        title: z.string().min(2).max(200),
        organization: z.string().max(200).default(''),
        description: z.string().max(2000).nullish(),
        startDate: z.string().max(40).nullish(),
        endDate: z.string().max(40).nullish(),
        current: z.boolean().default(false),
        skills: z.array(z.string().max(80)).max(20).default([]),
      }),
    )
    .max(20)
    .default([]),
  skills: z
    .array(z.object({ name: z.string().min(1).max(80), level: z.number().min(0).max(100).nullish() }))
    .max(60)
    .default([]),
  achievements: z
    .array(z.object({ type: z.enum(['AWARD', 'CERTIFICATION', 'PUBLICATION']).catch('AWARD'), title: z.string().min(2).max(200), issuer: z.string().max(200).nullish(), date: z.string().max(40).nullish() }))
    .max(20)
    .default([]),
});

export type ExtractedProfile = z.infer<typeof ExtractedSchema>;

export interface NormalizedSkill {
  slug: string;
  level: number;
}

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured career data from a CV for Orbit, a career platform.
Return JSON with keys: headline, summary, currentStatus, location, linkedinUrl, githubUrl, portfolioUrl,
education[{institution, degree, field, startDate, endDate, gpa}],
experiences[{type, title, organization, description, startDate, endDate, current, skills[]}],
skills[{name, level}], achievements[{type, title, issuer, date}].
experience.type must be one of WORK, INTERNSHIP, ORGANIZATION, PROJECT, COMPETITION, VOLUNTEER, LEADERSHIP, RESEARCH.
Use LEADERSHIP for leading roles in organisations, PROJECT for personal/academic projects, COMPETITION for hackathons and contests.
achievement.type must be AWARD, CERTIFICATION or PUBLICATION. Dates as "YYYY-MM" when possible.
skill.level is an honest 0-100 estimate based only on evidence in the CV (40 = coursework level, 60 = applied in projects, 75+ = professional use). Never invent facts.`;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  januari: 0, februari: 1, maret: 2, mei: 4, juni: 5, juli: 6, agustus: 7, oktober: 9, desember: 11,
};

export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s || /present|now|current|sekarang/.test(s)) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  m = s.match(/([a-z]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]] !== undefined) return new Date(Date.UTC(Number(m[2]), MONTHS[m[1]], 1));
  m = s.match(/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[2]), Number(m[1]) - 1, 1));
  m = s.match(/(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[1]), 0, 1));
  return null;
}

const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:–|—|-|to|until|s\/d)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|present|now|current|sekarang)/i;

// ---------------------------------------------------------------------------
// Heuristic parser
// ---------------------------------------------------------------------------

type Section = 'summary' | 'education' | 'experience' | 'organization' | 'projects' | 'achievements' | 'certifications' | 'skills' | 'other';

const SECTION_PATTERNS: [Section, RegExp][] = [
  ['summary', /^(summary|profile|about me|professional summary|ringkasan)$/i],
  ['education', /^(education|academic background|pendidikan)$/i],
  ['experience', /^(work experience|experience|professional experience|employment|internships?|pengalaman( kerja)?)$/i],
  ['organization', /^(organi[sz]ation(al)? experience|organi[sz]ations?|leadership( experience)?|activities|extracurricular|volunteer(ing)?|pengalaman organisasi)$/i],
  ['projects', /^(projects?|personal projects|academic projects|portfolio)$/i],
  ['achievements', /^(achievements?|awards?|honou?rs|competitions?|awards (and|&) achievements|prestasi)$/i],
  ['certifications', /^(certifications?|certificates?|licenses|courses|sertifikasi)$/i],
  ['skills', /^(skills|technical skills|core skills|skills (and|&) tools|keahlian)$/i],
];

function sectionOf(line: string): Section | null {
  const clean = line.replace(/[:•\-–—_*#]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length > 40) return null;
  for (const [section, pattern] of SECTION_PATTERNS) if (pattern.test(clean)) return section;
  return null;
}

const BULLET = /^\s*([•●▪◦\-–*]|\d+\.)\s+/;

const SINGLE_DATE = /^((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}$/i;
const INSTITUTION = /university|universitas|institute|institut|college|school|polytechnic|politeknik|academy|akademi|sma\b|smk\b/i;

function splitHeader(line: string): { title: string; organization: string } {
  const cleaned = line.replace(DATE_RANGE, '').replace(/[|·,]\s*$/, '').trim();
  // Prefer explicit separators; fall back to commas.
  let parts = cleaned.split(/\s+(?:—|–|-|\||@|at)\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = cleaned.split(/,\s+(?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], organization: parts.slice(1).join(', ') };
  return { title: cleaned, organization: '' };
}

/** Does a non-bullet line start a new entry, or continue the current one? */
function looksLikeHeader(line: string, section: Section): boolean {
  if (section === 'education') return INSTITUTION.test(line);
  if (/^[a-z(]/.test(line)) return false;
  if (DATE_RANGE.test(line)) return true;
  if (/\s(—|–|-|\||@|at)\s/.test(line) && line.length < 140) return true;
  return line.length < 70 && !/[.;]$/.test(line);
}

function inferExperienceType(section: Section, text: string): ExperienceType {
  const t = text.toLowerCase();
  if (section === 'projects') return 'PROJECT';
  if (/hackathon|competition|finalist|winner|champion|juara|olympiad|contest/.test(t)) return 'COMPETITION';
  if (/\bintern(ship)?\b|magang/.test(t)) return 'INTERNSHIP';
  if (/research|thesis|lab assistant/.test(t)) return 'RESEARCH';
  if (/volunteer|relawan/.test(t)) return 'VOLUNTEER';
  if (section === 'organization') return /head|lead|president|chair|ketua|coordinator|captain|director/.test(t) ? 'LEADERSHIP' : 'ORGANIZATION';
  return 'WORK';
}

export function heuristicExtract(text: string): ExtractedProfile {
  const lines = text.split('\n').map((l) => l.trim());
  const out: ExtractedProfile = { education: [], experiences: [], skills: [], achievements: [] };
  const firstLines = lines.filter(Boolean).slice(0, 4);
  out.headline = firstLines.find((l, i) => i > 0 && l.length < 120 && !/@|http|\+\d/.test(l)) ?? null;
  const all = text.toLowerCase();
  out.linkedinUrl = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? null;
  out.githubUrl = text.match(/(https?:\/\/)?(www\.)?github\.com\/[\w-]+/i)?.[0] ?? null;
  out.portfolioUrl = text.match(/(https?:\/\/)?[\w-]+\.(vercel\.app|netlify\.app|github\.io|notion\.site|framer\.website)[^\s]*/i)?.[0] ?? null;
  if (/student|mahasiswa|undergraduate/.test(all)) out.currentStatus = 'Student';
  const locationMatch = text.match(/(Jakarta|Bandung|Surabaya|Yogyakarta|Medan|Semarang|Bali|Tangerang|Bekasi|Depok|Malang|Makassar|Singapore)[^\n·|]*/i);
  out.location = locationMatch?.[0]?.trim().slice(0, 80) ?? null;

  let section: Section = 'other';
  let current: { header: string; dates: string; bullets: string[]; section: Section } | null = null;
  const summary: string[] = [];
  const flush = () => {
    if (!current) return;
    const { header, dates, bullets } = current;
    const range = (dates || header).match(DATE_RANGE);
    const single = !range && SINGLE_DATE.test(dates.trim()) ? dates.trim() : null;
    const start = range?.[1] ?? single;
    const end = range?.[2] ?? single;
    const isCurrent = Boolean(end && /present|now|current|sekarang/i.test(end));
    const { title, organization } = splitHeader(header);
    const description = bullets.join('\n');
    if (current.section === 'education') {
      const gpa = `${header} ${dates} ${description}`.match(/(?:gpa|ipk)[:\s]*([\d.,]+\s*\/\s*[\d.,]+|[\d.,]+)/i)?.[1] ?? null;
      const degreeMatch = `${title} ${organization}`.match(/(bachelor|master|b\.?sc|s\.?kom|s1|diploma|associate)[^,—–|]*/i);
      const institution = INSTITUTION.test(title) ? title : organization || title;
      out.education.push({
        institution,
        degree: degreeMatch?.[0]?.trim() ?? null,
        field: degreeMatch?.[0]?.match(/(?:of|in)\s+(.+)/i)?.[1]?.trim() ?? null,
        startDate: start,
        endDate: end,
        gpa,
      });
    } else if (current.section === 'achievements' || current.section === 'certifications') {
      const cleanTitle = header.replace(DATE_RANGE, '').replace(/,?\s*\b(19|20)\d{2}\s*$/, '').trim();
      if (cleanTitle.length >= 4) {
        const issuer = splitHeader(cleanTitle).organization || null;
        const isCert = current.section === 'certifications' || /certif|certificate|credential/i.test(header);
        const year = `${header} ${dates}`.match(/\b(20\d{2}|19\d{2})\b/)?.[1] ?? null;
        out.achievements.push({ type: isCert ? 'CERTIFICATION' : 'AWARD', title: cleanTitle.slice(0, 200), issuer, date: start ?? year });
        // Competitions are also experiences (initiative, problem solving under pressure).
        if (!isCert && /hackathon|competition|finalist|winner|champion|juara|olympiad|contest/i.test(header)) {
          out.experiences.push({
            type: 'COMPETITION',
            title: cleanTitle.slice(0, 200),
            organization: issuer ?? '',
            description: description || null,
            startDate: start ?? year,
            endDate: end ?? year,
            current: false,
            skills: detectSkills(`${cleanTitle} ${description}`).slice(0, 8).map((s) => s.name),
          });
        }
      }
    } else if (['experience', 'organization', 'projects'].includes(current.section) && title.length >= 2) {
      out.experiences.push({
        type: inferExperienceType(current.section, `${title} ${organization} ${description}`),
        title: title.slice(0, 200),
        organization: organization.slice(0, 200),
        description: description || null,
        startDate: start,
        endDate: isCurrent ? null : end,
        current: isCurrent,
        skills: detectSkills(`${title} ${description}`).slice(0, 8).map((s) => s.name),
      });
    }
    current = null;
  };

  for (const raw of lines) {
    if (!raw) continue;
    const sec = sectionOf(raw);
    if (sec) {
      flush();
      section = sec;
      continue;
    }
    if (section === 'summary') {
      summary.push(raw);
      continue;
    }
    if (section === 'skills' || section === 'other') continue;
    const isBullet = BULLET.test(raw);
    const isDateLine =
      (DATE_RANGE.test(raw) && raw.replace(DATE_RANGE, '').replace(/[|·,]/g, '').trim().length < 25) || SINGLE_DATE.test(raw);
    if (isBullet && current) {
      current.bullets.push(raw.replace(BULLET, '').trim());
    } else if (isDateLine && current && !current.dates) {
      current.dates = raw;
    } else if (section === 'certifications') {
      // Each non-bullet line in this section is its own item.
      flush();
      current = { header: raw.replace(BULLET, ''), dates: '', bullets: [], section };
      flush();
    } else if (current && !looksLikeHeader(raw, section)) {
      // Wrapped lines continue the previous bullet; other lines become details.
      if (current.bullets.length && /^[a-z(]/.test(raw)) current.bullets[current.bullets.length - 1] += ` ${raw}`;
      else current.bullets.push(raw);
    } else {
      flush();
      current = { header: raw.replace(BULLET, ''), dates: '', bullets: [], section };
    }
  }
  flush();
  out.summary = summary.join(' ').slice(0, 1500) || null;

  // Skills: catalog matches anywhere in the CV.
  out.skills = detectSkills(text).map((s) => ({ name: s.name, level: null }));
  return out;
}

// ---------------------------------------------------------------------------
// Normalisation & proficiency estimation
// ---------------------------------------------------------------------------

/**
 * Estimate 0–100 proficiency per catalog skill from CV evidence.
 * Conservative by design: a CV alone rarely proves advanced mastery.
 */
export function estimateSkillLevels(profile: ExtractedProfile, cvText: string): NormalizedSkill[] {
  const hits = new Map(detectSkills(cvText).map((h) => [h.slug, h.hits]));
  const levels = new Map<string, number>();
  const bump = (slug: string | null, amount: number) => {
    if (!slug) return;
    levels.set(slug, (levels.get(slug) ?? 28) + amount);
  };

  for (const s of profile.skills) {
    const slug = resolveSkillSlug(s.name);
    if (!slug) continue;
    if (s.level !== null && s.level !== undefined) levels.set(slug, Math.max(levels.get(slug) ?? 0, s.level));
    else bump(slug, 0);
  }
  for (const [slug, count] of hits) bump(slug, Math.min(4, count) * 6);

  for (const e of profile.experiences) {
    const text = `${e.title} ${e.description ?? ''} ${e.skills.join(' ')}`;
    for (const s of detectSkills(text)) bump(s.slug, e.type === 'WORK' || e.type === 'INTERNSHIP' ? 10 : 7);
    const lower = text.toLowerCase();
    if (e.type === 'LEADERSHIP' || /\b(led|lead|head|president|chair|coordinat|managed)/.test(lower)) {
      bump('leadership', 14);
      bump('stakeholder-management', 6);
      bump('project-management', 6);
    }
    if (/present|pitch|speaker|workshop|taught|mentor/.test(lower)) {
      bump('communication', 8);
      bump('public-speaking', 8);
    }
    if (/team|collaborat|cross-functional/.test(lower)) bump('teamwork', 8);
    if (e.type === 'COMPETITION') bump('problem-solving', 10);
    if (e.type === 'PROJECT') bump('problem-solving', 6);
  }
  // Every CV that describes experience demonstrates some written communication.
  if (profile.experiences.length >= 2) bump('communication', 10);

  return [...levels.entries()]
    .map(([slug, level]) => ({ slug, level: Math.round(clamp(level, 15, 82)) }))
    .sort((a, b) => b.level - a.level);
}

export function dedupeKey(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => normalizeTerm(p ?? '')).join('|');
}
