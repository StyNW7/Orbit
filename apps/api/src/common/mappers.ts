import type {
  Achievement,
  AgentAction,
  AgentInsight,
  CareerNote,
  CareerProfile,
  CareerRole,
  Education,
  Experience,
  Notification,
  Opportunity,
  Quest,
  QuestEvidence,
  QuestTask,
  Skill,
  StoredFile,
} from '@prisma/client';
import type {
  AchievementView,
  AgentActionView,
  CareerGoalView,
  CareerProfileView,
  EducationView,
  ExperienceView,
  InsightView,
  NoteView,
  NotificationView,
  OpportunityView,
  QuestEvidenceView,
  QuestView,
  SkillView,
  StoredFileView,
} from '@orbit/shared';

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function toSkillView(s: Skill): SkillView {
  return { id: s.id, slug: s.slug, name: s.name, category: s.category, description: s.description };
}

export function toFileView(f: StoredFile | null | undefined): StoredFileView | null {
  if (!f) return null;
  return {
    id: f.id,
    filename: f.filename,
    mimeType: f.mimeType,
    size: f.size,
    purpose: f.purpose,
    url: `/files/${f.id}`,
    createdAt: f.createdAt.toISOString(),
  };
}

export function toProfileView(p: CareerProfile & { cvFile?: StoredFile | null }): CareerProfileView {
  return {
    id: p.id,
    headline: p.headline,
    summary: p.summary,
    currentStatus: p.currentStatus,
    university: p.university,
    major: p.major,
    graduationYear: p.graduationYear,
    location: p.location,
    interests: p.interests,
    preferredIndustries: p.preferredIndustries,
    preferredWorkModes: p.preferredWorkModes,
    preferredLocations: p.preferredLocations,
    preferredRoleTypes: p.preferredRoleTypes,
    additionalContext: p.additionalContext,
    linkedinUrl: p.linkedinUrl,
    portfolioUrl: p.portfolioUrl,
    githubUrl: p.githubUrl,
    onboardingCompleted: p.onboardingCompleted,
    extractionSource: p.extractionSource,
    cvFile: toFileView(p.cvFile),
    cvParsedAt: iso(p.cvParsedAt),
  };
}

export function toExperienceView(e: Experience): ExperienceView {
  return {
    id: e.id,
    type: e.type,
    title: e.title,
    organization: e.organization,
    description: e.description,
    startDate: iso(e.startDate),
    endDate: iso(e.endDate),
    current: e.current,
    skills: e.skills,
    achievements: e.achievements,
  };
}

export function toEducationView(e: Education): EducationView {
  return {
    id: e.id,
    institution: e.institution,
    degree: e.degree,
    field: e.field,
    startDate: iso(e.startDate),
    endDate: iso(e.endDate),
    gpa: e.gpa,
  };
}

export function toAchievementView(a: Achievement): AchievementView {
  return { id: a.id, type: a.type, title: a.title, issuer: a.issuer, date: iso(a.date), url: a.url };
}

export function toGoalView(
  g: { id: string; isPrimary: boolean; motivation: string | null; createdAt: Date; role: Pick<CareerRole, 'id' | 'slug' | 'title' | 'icon'>; journey?: { id: string } | null },
  readiness: number | null = null,
): CareerGoalView {
  return {
    id: g.id,
    role: { id: g.role.id, slug: g.role.slug, title: g.role.title, icon: g.role.icon },
    isPrimary: g.isPrimary,
    motivation: g.motivation,
    readiness,
    journeyId: g.journey?.id ?? null,
    createdAt: g.createdAt.toISOString(),
  };
}

export function toEvidenceView(e: QuestEvidence & { file?: StoredFile | null }): QuestEvidenceView {
  return {
    id: e.id,
    type: e.type,
    url: e.url,
    text: e.text,
    file: toFileView(e.file),
    aiReview: e.aiReview,
    reviewStatus: e.reviewStatus,
    createdAt: e.createdAt.toISOString(),
  };
}

export type QuestWithRelations = Quest & {
  tasks: QuestTask[];
  evidence: (QuestEvidence & { file?: StoredFile | null })[];
  relatedSkill: Skill | null;
  milestone: { journeyId: string; journey?: { title: string } };
};

export function toQuestView(q: QuestWithRelations, careerGoal: string | null = null): QuestView {
  return {
    id: q.id,
    milestoneId: q.milestoneId,
    journeyId: q.milestone.journeyId,
    title: q.title,
    description: q.description,
    objective: q.objective,
    category: q.category,
    impact: q.impact,
    relatedSkill: q.relatedSkill ? { id: q.relatedSkill.id, name: q.relatedSkill.name, slug: q.relatedSkill.slug } : null,
    relatedCareerGoal: careerGoal,
    estimatedEffort: q.estimatedEffort,
    xp: q.xp,
    status: q.status,
    progress: q.progress,
    evidenceRequirement: q.evidenceRequirement,
    evidenceRequired: q.evidenceRequired,
    deadline: iso(q.deadline),
    completedAt: iso(q.completedAt),
    tasks: [...q.tasks]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ id: t.id, title: t.title, order: t.order, completed: t.completed, completedAt: iso(t.completedAt) })),
    evidence: q.evidence.map(toEvidenceView),
    resources: Array.isArray(q.resources) ? (q.resources as QuestView['resources']) : [],
  };
}

export const questInclude = {
  tasks: true,
  evidence: { include: { file: true }, orderBy: { createdAt: 'desc' as const } },
  relatedSkill: true,
  milestone: { select: { journeyId: true, journey: { select: { title: true } } } },
};

export function toOpportunityView(o: Opportunity): OpportunityView {
  return {
    id: o.id,
    source: o.source,
    title: o.title,
    company: o.company,
    description: o.description,
    location: o.location,
    workMode: o.workMode,
    employmentType: o.employmentType,
    skills: o.skills,
    applyUrl: o.applyUrl,
    salaryRange: o.salaryRange,
    publishedAt: iso(o.publishedAt),
    deadline: iso(o.deadline ?? o.expiresAt),
    isDemo: o.isDemo,
  };
}

export function toNoteView(n: CareerNote): NoteView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    tags: n.tags,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export function toNotificationView(n: Notification): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    actionUrl: n.actionUrl,
    scheduledAt: n.scheduledAt.toISOString(),
    readAt: iso(n.readAt),
    status: n.status,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toInsightView(i: AgentInsight): InsightView {
  return {
    id: i.id,
    type: i.type,
    title: i.title,
    message: i.message,
    evidence: Array.isArray(i.evidence) ? (i.evidence as string[]) : [],
    suggestedAction: (i.suggestedAction as InsightView['suggestedAction']) ?? null,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
  };
}

export function toActionView(a: AgentAction): AgentActionView {
  return {
    id: a.id,
    type: a.type as AgentActionView['type'],
    tool: a.tool as AgentActionView['tool'],
    level: a.level,
    title: a.title,
    description: a.description,
    status: a.status,
    confirmationRequired: a.confirmationRequired,
    payload: (a.payload as Record<string, unknown>) ?? {},
    resultSummary: a.outputSummary,
    createdAt: a.createdAt.toISOString(),
  };
}
