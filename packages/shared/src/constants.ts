/**
 * Orbit domain constants shared by the web client and the API.
 * Enum string values mirror the Prisma enums in apps/api/prisma/schema.prisma.
 */

export const BRAND = {
  name: 'Orbit',
  tagline: 'Build Your Path. Become Career-Ready.',
  green: '#0AB46A',
  orange: '#FB9002',
} as const;

// ---------------------------------------------------------------------------
// Career Universe
// ---------------------------------------------------------------------------

export const NODE_TYPES = [
  'USER',
  'CAREER_ROLE',
  'SKILL',
  'EXPERIENCE',
  'OPPORTUNITY',
  'MENTOR',
  'ROLE_MODEL',
  'PAPER',
  'BOOK',
  'COURSE',
  'EVENT',
  'CERTIFICATION',
  'COMPETITION',
  'PROJECT',
  'QUEST',
  'GAP',
  'GOAL',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_RELATIONSHIPS = [
  'TARGETS',
  'HAS_SKILL',
  'HAS_EXPERIENCE',
  'REQUIRES',
  'RECOMMENDED_FOR',
  'IMPROVES',
  'RELATED_TO',
  'SUPPORTS',
  'PART_OF',
  'APPLIED_TO',
  'LEARNED_FROM',
  'INSPIRED_BY',
] as const;
export type EdgeRelationship = (typeof EDGE_RELATIONSHIPS)[number];

/** Universe filter groups shown in the graph toolbar. */
export const UNIVERSE_FILTERS = [
  { id: 'ALL', label: 'All', types: [] as NodeType[] },
  { id: 'CAREER', label: 'Career', types: ['USER', 'CAREER_ROLE', 'GOAL', 'QUEST'] as NodeType[] },
  { id: 'SKILLS', label: 'Skills', types: ['SKILL', 'GAP'] as NodeType[] },
  {
    id: 'EXPERIENCE',
    label: 'Experience',
    types: ['EXPERIENCE', 'PROJECT', 'COMPETITION', 'CERTIFICATION'] as NodeType[],
  },
  { id: 'OPPORTUNITY', label: 'Opportunity', types: ['OPPORTUNITY', 'EVENT'] as NodeType[] },
  { id: 'KNOWLEDGE', label: 'Knowledge', types: ['BOOK', 'PAPER', 'COURSE'] as NodeType[] },
  { id: 'PEOPLE', label: 'People', types: ['MENTOR', 'ROLE_MODEL'] as NodeType[] },
] as const;
export type UniverseFilterId = (typeof UNIVERSE_FILTERS)[number]['id'];

export const NODE_TYPE_META: Record<NodeType, { label: string; group: UniverseFilterId }> = {
  USER: { label: 'You', group: 'CAREER' },
  CAREER_ROLE: { label: 'Career Role', group: 'CAREER' },
  GOAL: { label: 'Career Goal', group: 'CAREER' },
  QUEST: { label: 'Quest', group: 'CAREER' },
  SKILL: { label: 'Skill', group: 'SKILLS' },
  GAP: { label: 'Skill Gap', group: 'SKILLS' },
  EXPERIENCE: { label: 'Experience', group: 'EXPERIENCE' },
  PROJECT: { label: 'Project', group: 'EXPERIENCE' },
  COMPETITION: { label: 'Competition', group: 'EXPERIENCE' },
  CERTIFICATION: { label: 'Certification', group: 'EXPERIENCE' },
  OPPORTUNITY: { label: 'Opportunity', group: 'OPPORTUNITY' },
  EVENT: { label: 'Event', group: 'OPPORTUNITY' },
  BOOK: { label: 'Book', group: 'KNOWLEDGE' },
  PAPER: { label: 'Research Paper', group: 'KNOWLEDGE' },
  COURSE: { label: 'Course', group: 'KNOWLEDGE' },
  MENTOR: { label: 'Mentor', group: 'PEOPLE' },
  ROLE_MODEL: { label: 'Role Model', group: 'PEOPLE' },
};

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export const READINESS_CATEGORIES = [
  'SKILL',
  'EXPERIENCE',
  'PORTFOLIO',
  'KNOWLEDGE',
  'APPLICATION',
  'INTERVIEW',
] as const;
export type ReadinessCategory = (typeof READINESS_CATEGORIES)[number];

export const READINESS_CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  SKILL: 'Skill Match',
  EXPERIENCE: 'Experience Match',
  PORTFOLIO: 'Portfolio',
  KNOWLEDGE: 'Knowledge',
  APPLICATION: 'Application Readiness',
  INTERVIEW: 'Interview Readiness',
};

export const DEFAULT_READINESS_WEIGHTS: Record<ReadinessCategory, number> = {
  SKILL: 0.3,
  EXPERIENCE: 0.25,
  PORTFOLIO: 0.15,
  KNOWLEDGE: 0.1,
  APPLICATION: 0.1,
  INTERVIEW: 0.1,
};

export const JOB_MATCH_WEIGHTS = {
  roleAlignment: 0.25,
  skillMatch: 0.25,
  experienceMatch: 0.2,
  preferenceMatch: 0.15,
  careerGoalMatch: 0.15,
} as const;
export type JobMatchComponent = keyof typeof JOB_MATCH_WEIGHTS;

export const JOB_MATCH_LABELS: Record<JobMatchComponent, string> = {
  roleAlignment: 'Role Alignment',
  skillMatch: 'Skill Match',
  experienceMatch: 'Experience Match',
  preferenceMatch: 'Preference Match',
  careerGoalMatch: 'Career Goal Match',
};

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export const SKILL_CATEGORIES = [
  'PRODUCT',
  'DATA',
  'ENGINEERING',
  'AI',
  'DESIGN',
  'BUSINESS',
  'SOFT_SKILL',
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_LEVELS = [
  { label: 'Beginner', min: 0 },
  { label: 'Elementary', min: 26 },
  { label: 'Intermediate', min: 46 },
  { label: 'Advanced', min: 66 },
  { label: 'Expert', min: 86 },
] as const;

// ---------------------------------------------------------------------------
// Profile & preferences
// ---------------------------------------------------------------------------

export const CAREER_INTERESTS = [
  'Product Management',
  'Software Engineering',
  'AI / Machine Learning',
  'Data',
  'UI/UX',
  'Business',
  'Consulting',
] as const;

export const INDUSTRIES = [
  'Technology',
  'Fintech',
  'E-commerce',
  'EdTech',
  'HealthTech',
  'Consulting',
  'Media',
  'Logistics',
  'Government & Public Sector',
] as const;

export const WORK_MODES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export const OPPORTUNITY_TYPES = ['FULL_TIME', 'INTERNSHIP', 'GRADUATE_PROGRAM', 'PART_TIME'] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  FULL_TIME: 'Full-time',
  INTERNSHIP: 'Internship',
  GRADUATE_PROGRAM: 'Graduate Program',
  PART_TIME: 'Part-time',
};

// ---------------------------------------------------------------------------
// Experiences
// ---------------------------------------------------------------------------

export const EXPERIENCE_TYPES = [
  'WORK',
  'INTERNSHIP',
  'ORGANIZATION',
  'PROJECT',
  'COMPETITION',
  'VOLUNTEER',
  'LEADERSHIP',
  'RESEARCH',
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];
export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  WORK: 'Work',
  INTERNSHIP: 'Internship',
  ORGANIZATION: 'Organization',
  PROJECT: 'Project',
  COMPETITION: 'Competition',
  VOLUNTEER: 'Volunteer',
  LEADERSHIP: 'Leadership',
  RESEARCH: 'Research',
};

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  'WORKSHOP',
  'SEMINAR',
  'CONFERENCE',
  'COMPETITION',
  'HACKATHON',
  'BOOTCAMP',
  'CAREER_EVENT',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const RESOURCE_TYPES = ['COURSE', 'CERTIFICATION', 'ARTICLE', 'LEARNING_RESOURCE'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const GROWTH_TYPE_LABELS: Record<EventType | ResourceType, string> = {
  COURSE: 'Course',
  CERTIFICATION: 'Certification',
  WORKSHOP: 'Workshop',
  SEMINAR: 'Seminar',
  COMPETITION: 'Competition',
  HACKATHON: 'Hackathon',
  CONFERENCE: 'Conference',
  BOOTCAMP: 'Bootcamp',
  CAREER_EVENT: 'Career Event',
  ARTICLE: 'Article',
  LEARNING_RESOURCE: 'Learning Resource',
};

export const DISCOVER_TABS = ['jobs', 'growth', 'knowledge', 'people'] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number];

export const SAVED_KINDS = ['OPPORTUNITY', 'BOOK', 'PAPER', 'EVENT', 'RESOURCE', 'ROLE_MODEL'] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];

export const SAVED_STATUSES = ['SAVED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const APPLICATION_STATUSES = [
  'SAVED',
  'PREPARING',
  'APPLIED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: 'Saved',
  PREPARING: 'Preparing',
  APPLIED: 'Applied',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};
/** Statuses shown as columns in the pipeline board. */
export const APPLICATION_PIPELINE: ApplicationStatus[] = [
  'SAVED',
  'PREPARING',
  'APPLIED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
];

// ---------------------------------------------------------------------------
// Journey & quests
// ---------------------------------------------------------------------------

export const QUEST_CATEGORIES = [
  'SKILL',
  'PROJECT',
  'PORTFOLIO',
  'EXPERIENCE',
  'KNOWLEDGE',
  'CERTIFICATION',
  'APPLICATION',
  'INTERVIEW',
  'NETWORKING',
] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];

export const QUEST_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export const EVIDENCE_TYPES = ['URL', 'FILE', 'TEXT', 'GITHUB', 'PORTFOLIO', 'CERTIFICATE'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  URL: 'Link',
  FILE: 'File',
  TEXT: 'Text Reflection',
  GITHUB: 'GitHub Link',
  PORTFOLIO: 'Portfolio Link',
  CERTIFICATE: 'Certificate',
};

/** XP for meaningful actions. Quests carry their own XP; these are defaults. */
export const XP_REWARDS = {
  SKILL_QUEST: 100,
  PROJECT_QUEST: 300,
  CERTIFICATION: 250,
  INTERVIEW_PRACTICE: 100,
  INTERNSHIP_OFFER: 500,
  KNOWLEDGE_COMPLETED: 40,
  TASK_COMPLETED: 10,
  MILESTONE_COMPLETED: 150,
  NOTE_WRITTEN: 5,
} as const;

// ---------------------------------------------------------------------------
// Journal & notifications
// ---------------------------------------------------------------------------

export const NOTE_TYPES = [
  'INTERVIEW_REFLECTION',
  'LEARNING_REFLECTION',
  'CAREER_THOUGHT',
  'EXPERIENCE_UPDATE',
  'PERSONAL_DEVELOPMENT',
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  INTERVIEW_REFLECTION: 'Interview reflection',
  LEARNING_REFLECTION: 'Learning reflection',
  CAREER_THOUGHT: 'Career thought',
  EXPERIENCE_UPDATE: 'Experience update',
  PERSONAL_DEVELOPMENT: 'Personal development',
};

export const NOTIFICATION_TYPES = [
  'JOB_DEADLINE',
  'EVENT_REMINDER',
  'QUEST_DEADLINE',
  'SAVED_OPPORTUNITY',
  'WEEKLY_REVIEW',
  'INACTIVE_JOURNEY',
  'APPLICATION_FOLLOW_UP',
  'CUSTOM_REMINDER',
  'INSIGHT',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const AGENT_TOOLS = [
  'get_user_context',
  'analyze_career_profile',
  'analyze_career_gap',
  'find_opportunities',
  'search_growth_resources',
  'search_books',
  'search_papers',
  'find_role_models',
  'build_career_journey',
  'update_career_graph',
  'update_progress',
  'manage_application',
  'create_reminder',
  'get_next_best_action',
] as const;
export type AgentToolName = (typeof AGENT_TOOLS)[number];

export const AGENT_ACTION_LEVELS = ['READ', 'SUGGEST', 'WRITE'] as const;
export type AgentActionLevel = (typeof AGENT_ACTION_LEVELS)[number];

export const AGENT_ACTION_STATUSES = [
  'EXECUTED',
  'SUGGESTED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'REJECTED',
  'FAILED',
] as const;
export type AgentActionStatus = (typeof AGENT_ACTION_STATUSES)[number];

/** Action types the frontend can render as interactive cards. */
export const AGENT_ACTION_TYPES = [
  'ADD_SKILL_TO_JOURNEY',
  'ADD_QUEST',
  'SAVE_OPPORTUNITY',
  'UPDATE_APPLICATION_STATUS',
  'CREATE_REMINDER',
  'SET_PRIMARY_GOAL',
  'ADD_CAREER_GOAL',
  'BUILD_JOURNEY',
  'UPDATE_QUEST_PROGRESS',
  'ADD_GRAPH_NODE',
  'SAVE_RESOURCE',
  'NAVIGATE',
] as const;
export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

export const AGENT_ENGINES = ['langflow', 'direct', 'planner'] as const;
export type AgentEngine = (typeof AGENT_ENGINES)[number];
export const AGENT_ENGINE_LABELS: Record<AgentEngine, string> = {
  langflow: 'Langflow agent',
  direct: 'Direct model',
  planner: 'Orbit planner',
};
