import { useMemo } from 'react';
import {
  AGENT_ENGINE_LABELS,
  APPLICATION_STATUS_LABELS,
  EVIDENCE_TYPE_LABELS,
  EXPERIENCE_TYPE_LABELS,
  GROWTH_TYPE_LABELS,
  JOB_MATCH_LABELS,
  NODE_TYPE_META,
  NOTE_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  READINESS_CATEGORY_LABELS,
  WORK_MODE_LABELS,
  skillLevelLabel,
  type AgentEngine,
  type ApplicationStatus,
  type EvidenceType,
  type ExperienceType,
  type JobMatchComponent,
  type NodeType,
  type NoteType,
  type OpportunityType,
  type ReadinessCategory,
  type WorkMode,
} from '@orbit/shared';
import { useT, type MessageKey } from './index';

/** Localized labels for shared domain enums (the API and DB keep the English enum values). */
export function useLabels() {
  const { t, tm, locale } = useT();
  return useMemo(
    () => ({
      nodeType: (v: NodeType) => tm(`enum.nodeType.${v}`, NODE_TYPE_META[v]?.label ?? v),
      filter: (id: string, fallback: string) => tm(`enum.filter.${id}`, fallback),
      relation: (v: string) => tm(`enum.relation.${v}`, v),
      readiness: (v: ReadinessCategory | string) => tm(`enum.readiness.${v}`, READINESS_CATEGORY_LABELS[v as ReadinessCategory] ?? v),
      readinessShort: (v: ReadinessCategory | string) => tm(`enum.readinessShort.${v}`, v),
      jobMatch: (v: JobMatchComponent) => tm(`enum.jobMatch.${v}`, JOB_MATCH_LABELS[v]),
      skillLevel: (level: number) => {
        const en = skillLevelLabel(level);
        return tm(`enum.skillLevel.${en}`, en);
      },
      workMode: (v: WorkMode) => tm(`enum.workMode.${v}`, WORK_MODE_LABELS[v] ?? v),
      oppType: (v: OpportunityType) => tm(`enum.oppType.${v}`, OPPORTUNITY_TYPE_LABELS[v] ?? v),
      expType: (v: ExperienceType) => tm(`enum.expType.${v}`, EXPERIENCE_TYPE_LABELS[v] ?? v),
      growth: (v: keyof typeof GROWTH_TYPE_LABELS) => tm(`enum.growth.${v}`, GROWTH_TYPE_LABELS[v] ?? v),
      appStatus: (v: ApplicationStatus) => tm(`enum.appStatus.${v}`, APPLICATION_STATUS_LABELS[v] ?? v),
      evidence: (v: EvidenceType) => tm(`enum.evidence.${v}`, EVIDENCE_TYPE_LABELS[v] ?? v),
      noteType: (v: NoteType) => tm(`enum.noteType.${v}`, NOTE_TYPE_LABELS[v] ?? v),
      engine: (v: AgentEngine) => tm(`enum.engine.${v}`, AGENT_ENGINE_LABELS[v] ?? v),
      actionLevel: (v: string) => tm(`enum.actionLevel.${v}`, v),
      actionStatus: (v: string) => tm(`enum.actionStatus.${v}`, v.replace('_', ' ').toLowerCase()),
      interest: (v: string) => tm(`enum.interest.${v}`, v),
      industry: (v: string) => tm(`enum.industry.${v}`, v),
      band: (score: number) => t(bandKey(score)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );
}

export function bandKey(score: number): MessageKey {
  if (score >= 80) return 'band.careerReady';
  if (score >= 65) return 'band.almost';
  if (score >= 45) return 'band.momentum';
  return 'band.starting';
}
