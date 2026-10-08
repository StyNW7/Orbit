/**
 * Journey planner — turns a role template plus the user's gaps into
 * milestones and quests. Pure and idempotent: existing milestone/quest keys
 * are skipped so the same plan can be applied repeatedly.
 */
import type { ReadinessCategory } from '@orbit/shared';
import { SKILL_BY_SLUG } from '../../catalog/skills.catalog';
import {
  questTemplateForSkill,
  type MilestoneTemplate,
  type QuestTemplate,
  type RoleDefinition,
} from '../../catalog/roles.catalog';

export interface PlannedQuest extends QuestTemplate {
  order: number;
  /** already satisfied by the user's current profile */
  preCompleted: boolean;
}

export interface PlannedMilestone {
  key: string;
  title: string;
  description: string;
  impact: ReadinessCategory;
  skillSlug?: string;
  order: number;
  quests: PlannedQuest[];
  isNew: boolean;
}

export interface ExistingJourneyShape {
  /** milestone key -> quest keys present */
  milestones: Map<string, Set<string>>;
}

export interface PlannerGap {
  slug: string;
  severity: number;
}

const MAX_EXTRA_GAP_MILESTONES = 2;

function requiredLevel(role: RoleDefinition, slug: string | undefined): number | null {
  if (!slug) return null;
  return role.requirements.find((r) => r.skill === slug)?.level ?? null;
}

function toPlannedQuests(
  role: RoleDefinition,
  quests: QuestTemplate[],
  levels: Map<string, number>,
  existingKeys: Set<string> | undefined,
): PlannedQuest[] {
  return quests
    .filter((q) => !existingKeys?.has(q.key))
    .map((q, i) => {
      const req = requiredLevel(role, q.skillSlug);
      const level = q.skillSlug ? levels.get(q.skillSlug) ?? 0 : 0;
      const preCompleted = q.category === 'SKILL' && req !== null && level >= req;
      return { ...q, order: i, preCompleted };
    });
}

export function templateOrder(role: RoleDefinition, key: string): number | null {
  const idx = role.journey.findIndex((m) => m.key === key);
  return idx === -1 ? null : idx * 10;
}

/** Full journey plan: template milestones + up to two uncovered critical gaps. */
export function planJourney(
  role: RoleDefinition,
  levels: Map<string, number>,
  gaps: PlannerGap[],
  existing: ExistingJourneyShape = { milestones: new Map() },
): PlannedMilestone[] {
  const plan: PlannedMilestone[] = [];
  const coveredSkills = new Set<string>();
  role.journey.forEach((m, idx) => {
    if (m.skillSlug) coveredSkills.add(m.skillSlug);
    m.quests.forEach((q) => q.skillSlug && coveredSkills.add(q.skillSlug));
    const existingQuests = existing.milestones.get(m.key);
    const quests = toPlannedQuests(role, m.quests, levels, existingQuests);
    if (existingQuests && quests.length === 0) return;
    plan.push({
      key: m.key,
      title: m.title,
      description: m.description,
      impact: m.impact,
      skillSlug: m.skillSlug,
      order: idx * 10,
      quests,
      isNew: !existingQuests,
    });
  });

  // Insert uncovered critical gaps right after the last skill-focused template milestone.
  const lastSkillIdx = role.journey.reduce((acc, m, idx) => (m.impact === 'SKILL' ? idx : acc), 0);
  const extra = [...gaps]
    .sort((a, b) => b.severity - a.severity)
    .filter((g) => !coveredSkills.has(g.slug) && !existing.milestones.has(`skill:${g.slug}`))
    .slice(0, MAX_EXTRA_GAP_MILESTONES);
  extra.forEach((gap, i) => {
    const tpl = questTemplateForSkill(gap.slug);
    const skill = SKILL_BY_SLUG.get(gap.slug);
    plan.push({
      key: `skill:${gap.slug}`,
      title: skill?.name ?? gap.slug,
      description: `Close your ${skill?.name ?? gap.slug} gap with focused practice.`,
      impact: 'SKILL',
      skillSlug: gap.slug,
      order: lastSkillIdx * 10 + 1 + i,
      quests: toPlannedQuests(role, [tpl], levels, undefined),
      isNew: true,
    });
  });

  return plan.sort((a, b) => a.order - b.order);
}

/** Plan for "Add <skill> to Journey". Returns null when the quest already exists. */
export function planSkillAddition(
  role: RoleDefinition,
  skillSlug: string,
  levels: Map<string, number>,
  existing: ExistingJourneyShape,
): PlannedMilestone | null {
  const key = `skill:${skillSlug}`;
  const templateMilestone: MilestoneTemplate | undefined = role.journey.find((m) => m.key === key);
  const quests = templateMilestone
    ? templateMilestone.quests.filter((q) => q.skillSlug === skillSlug).slice(0, 1)
    : [questTemplateForSkill(skillSlug)];
  const existingQuests = existing.milestones.get(key);
  const planned = toPlannedQuests(role, quests.length ? quests : [questTemplateForSkill(skillSlug)], levels, existingQuests);
  if (planned.length === 0) return null;

  let order = templateOrder(role, key);
  if (order === null) {
    const portfolio = templateOrder(role, 'portfolio');
    order = portfolio !== null ? portfolio - 1 : role.journey.length * 10;
  }
  const skill = SKILL_BY_SLUG.get(skillSlug);
  return {
    key,
    title: templateMilestone?.title ?? skill?.name ?? skillSlug,
    description: templateMilestone?.description ?? `Close your ${skill?.name ?? skillSlug} gap with focused practice.`,
    impact: 'SKILL',
    skillSlug,
    order,
    // A quest the user explicitly asked for is never pre-completed.
    quests: planned.map((q) => ({ ...q, preCompleted: false })),
    isNew: !existingQuests,
  };
}

/** Progress of a quest from its tasks (0–100). */
export function questProgressFromTasks(tasks: { completed: boolean }[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

/** Milestone progress = average quest progress. */
export function milestoneProgress(quests: { progress: number }[]): number {
  if (quests.length === 0) return 0;
  return Math.round(quests.reduce((s, q) => s + q.progress, 0) / quests.length);
}
