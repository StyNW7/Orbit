import type {
  AgentActionLevel,
  AgentActionStatus,
  AgentActionType,
  AgentEngine,
  AppLocale,
  AgentToolName,
  ApplicationStatus,
  EdgeRelationship,
  EventType,
  EvidenceType,
  ExperienceType,
  JobMatchComponent,
  NodeType,
  NoteType,
  NotificationType,
  OpportunityType,
  QuestCategory,
  QuestStatus,
  ReadinessCategory,
  ResourceType,
  SavedKind,
  SavedStatus,
  SkillCategory,
  WorkMode,
} from './constants';
import type { OrbitLevel } from './utils';

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthProviderKind = 'supabase' | 'local';

export interface AuthConfig {
  provider: AuthProviderKind;
  demoAvailable: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthResult {
  accessToken: string;
  user: SessionUser;
}

export interface MeResponse {
  user: SessionUser;
  onboardingCompleted: boolean;
  primaryRole: { slug: string; title: string } | null;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface SkillView {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  description: string | null;
}

export interface CareerRoleView {
  id: string;
  slug: string;
  title: string;
  family: string;
  description: string;
  icon: string;
  requirements: { skill: SkillView; requiredLevel: number; importance: number }[];
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface UserSkillView {
  id: string;
  skill: SkillView;
  level: number;
  effectiveLevel: number;
  source: 'CV' | 'USER' | 'QUEST' | 'AGENT';
}

export interface ExperienceView {
  id: string;
  type: ExperienceType;
  title: string;
  organization: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  skills: string[];
  achievements: string[];
}

export interface EducationView {
  id: string;
  institution: string;
  degree: string | null;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
  gpa: string | null;
}

export interface AchievementView {
  id: string;
  type: 'AWARD' | 'CERTIFICATION' | 'PUBLICATION';
  title: string;
  issuer: string | null;
  date: string | null;
  url: string | null;
}

export interface CareerGoalView {
  id: string;
  role: { id: string; slug: string; title: string; icon: string };
  isPrimary: boolean;
  motivation: string | null;
  readiness: number | null;
  journeyId: string | null;
  createdAt: string;
}

export interface CareerProfileView {
  id: string;
  headline: string | null;
  summary: string | null;
  currentStatus: string | null;
  university: string | null;
  major: string | null;
  graduationYear: number | null;
  location: string | null;
  interests: string[];
  preferredIndustries: string[];
  preferredWorkModes: WorkMode[];
  preferredLocations: string[];
  preferredRoleTypes: OpportunityType[];
  additionalContext: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  onboardingCompleted: boolean;
  extractionSource: 'AI' | 'HEURISTIC' | 'MANUAL' | null;
  cvFile: StoredFileView | null;
  cvParsedAt: string | null;
}

export interface ProfileDetail {
  user: SessionUser;
  profile: CareerProfileView;
  education: EducationView[];
  experiences: ExperienceView[];
  skills: UserSkillView[];
  achievements: AchievementView[];
  goals: CareerGoalView[];
  level: OrbitLevel;
}

export interface StoredFileView {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  purpose: 'CV' | 'EVIDENCE' | 'CERTIFICATE' | 'DOCUMENT';
  url: string | null;
  createdAt: string;
}

export interface CvUploadResult {
  file: StoredFileView;
  characters: number;
  preview: string;
}

export interface AnalyzeProfileInput {
  targetRoleSlug: string;
  cvFileId?: string;
  cvText?: string;
  interests: string[];
  preferredIndustries: string[];
  preferredWorkModes: WorkMode[];
  preferredLocations: string[];
  preferredRoleTypes: OpportunityType[];
  additionalContext?: string;
}

export interface AnalysisStep {
  id: 'extract' | 'structure' | 'skills' | 'readiness' | 'graph';
  label: string;
  status: 'done' | 'skipped' | 'failed';
  detail: string;
}

export interface AnalyzeProfileResult {
  steps: AnalysisStep[];
  extractionSource: 'AI' | 'HEURISTIC' | 'MANUAL';
  intelligence: CareerIntelligence;
}

// ---------------------------------------------------------------------------
// Career Intelligence & readiness
// ---------------------------------------------------------------------------

export interface ReadinessCategoryResult {
  category: ReadinessCategory;
  label: string;
  /** 0–100 score for this category */
  score: number;
  weight: number;
  /** weighted points contributed to the total */
  contribution: number;
  details: string[];
}

export interface ReadinessResult {
  score: number;
  roleSlug: string;
  roleTitle: string;
  breakdown: ReadinessCategoryResult[];
  previousScore: number | null;
  computedAt: string;
}

export interface SkillGapView {
  skillId: string;
  slug: string;
  name: string;
  category: SkillCategory;
  currentLevel: number;
  requiredLevel: number;
  importance: number;
  /** importance-weighted shortfall, used for ranking */
  severity: number;
  inJourney: boolean;
}

export interface StrengthView {
  skillId: string;
  name: string;
  level: number;
  reason: string;
}

export interface NextBestAction {
  title: string;
  reason: string;
  expectedImpact: string;
  kind: 'QUEST_TASK' | 'ADD_SKILL' | 'BUILD_JOURNEY' | 'APPLICATION' | 'INTERVIEW' | 'PROFILE' | 'EVENT';
  actionLabel: string;
  actionUrl: string;
  /** Optional backend action that the button triggers directly */
  action?: { type: AgentActionType; payload: Record<string, unknown> } | null;
}

export interface CareerIntelligence {
  targetRole: { slug: string; title: string; description: string } | null;
  goalId: string | null;
  readiness: ReadinessResult | null;
  careerDna: { headline: string; summary: string; traits: string[] };
  strengths: StrengthView[];
  gaps: SkillGapView[];
  experienceHighlights: ExperienceView[];
  keySkills: UserSkillView[];
  preferences: {
    workModes: WorkMode[];
    industries: string[];
    locations: string[];
    roleTypes: OpportunityType[];
  };
  recommendedFocus: NextBestAction | null;
}

// ---------------------------------------------------------------------------
// Career Universe
// ---------------------------------------------------------------------------

export interface GraphNodeView {
  id: string;
  key: string;
  type: NodeType;
  label: string;
  description: string | null;
  metadata: Record<string, unknown>;
  source: 'SYSTEM' | 'USER' | 'AGENT';
  confidence: number;
}

export interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
  relationship: EdgeRelationship;
  weight: number;
}

export interface UniverseGraph {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  updatedAt: string | null;
}

export interface NodeConnection {
  node: GraphNodeView;
  relationship: EdgeRelationship;
  direction: 'in' | 'out';
}

export interface NodeDetail {
  node: GraphNodeView;
  connections: NodeConnection[];
  skill?: {
    skillId: string;
    currentLevel: number;
    currentLabel: string;
    requiredLevel: number | null;
    requiredLabel: string | null;
    relatedCareer: string | null;
    requiredByJobs: number;
    resources: { courses: number; books: number; papers: number; events: number };
    inJourney: boolean;
    isGap: boolean;
  };
  recommendedAction: NextBestAction | null;
  link: { label: string; url: string } | null;
}

// ---------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------

export interface QuestTaskView {
  id: string;
  title: string;
  order: number;
  completed: boolean;
  completedAt: string | null;
}

export interface QuestEvidenceView {
  id: string;
  type: EvidenceType;
  url: string | null;
  text: string | null;
  file: StoredFileView | null;
  aiReview: string | null;
  reviewStatus: 'PENDING' | 'REVIEWED' | 'SKIPPED';
  createdAt: string;
}

export interface QuestView {
  id: string;
  milestoneId: string;
  journeyId: string;
  title: string;
  description: string;
  objective: string | null;
  category: QuestCategory;
  impact: ReadinessCategory;
  relatedSkill: { id: string; name: string; slug: string } | null;
  relatedCareerGoal: string | null;
  estimatedEffort: string;
  xp: number;
  status: QuestStatus;
  progress: number;
  evidenceRequirement: string | null;
  evidenceRequired: boolean;
  deadline: string | null;
  completedAt: string | null;
  tasks: QuestTaskView[];
  evidence: QuestEvidenceView[];
  resources: { title: string; url: string; kind: string }[];
}

export interface MilestoneView {
  id: string;
  key: string;
  title: string;
  description: string | null;
  order: number;
  status: QuestStatus;
  progress: number;
  impact: ReadinessCategory | null;
  completedAt: string | null;
  quests: QuestView[];
}

export interface JourneyDetail {
  id: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  goal: CareerGoalView;
  progress: number;
  totalXp: number;
  earnedXp: number;
  milestones: MilestoneView[];
  canExpand: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestProgressResult {
  quest: QuestView;
  readiness: ReadinessResult | null;
  xpGained: number;
  level: OrbitLevel;
  leveledUp: boolean;
  milestoneCompleted: boolean;
}

export interface AddSkillToJourneyResult {
  journey: JourneyDetail;
  milestoneId: string;
  questId: string;
  created: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------

export interface OpportunityView {
  id: string;
  source: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: WorkMode;
  employmentType: OpportunityType;
  skills: string[];
  applyUrl: string | null;
  salaryRange: string | null;
  publishedAt: string | null;
  deadline: string | null;
  isDemo: boolean;
}

export interface JobMatchResult {
  overall: number;
  components: Record<JobMatchComponent, number>;
  matchedSkills: string[];
  missingSkills: { name: string; slug: string; inJourney: boolean }[];
  reasons: string[];
  recommendedAction: string;
}

export interface JobMatchView {
  opportunity: OpportunityView;
  match: JobMatchResult;
  saved: boolean;
  applicationId: string | null;
}

export interface RecommendationWhy {
  whyItMatters: string;
  improvesSkill: string | null;
  supportsGoal: string | null;
  addressesGap: string | null;
}

export interface GrowthItemView {
  kind: 'EVENT' | 'RESOURCE';
  id: string;
  type: EventType | ResourceType;
  title: string;
  provider: string;
  description: string;
  url: string | null;
  startsAt: string | null;
  deadline: string | null;
  location: string | null;
  isOnline: boolean;
  cost: string | null;
  durationHours: number | null;
  skills: string[];
  relevance: number;
  why: RecommendationWhy;
  saved: { id: string; status: SavedStatus } | null;
  isDemo: boolean;
}

export interface BookView {
  id: string;
  source: string;
  title: string;
  authors: string[];
  description: string;
  coverUrl: string | null;
  publishedYear: number | null;
  level: string | null;
  infoUrl: string | null;
  skills: string[];
  relatedCareer: string | null;
  relevance: number;
  why: RecommendationWhy;
  saved: { id: string; status: SavedStatus } | null;
}

export interface PaperView {
  id: string;
  source: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string;
  url: string | null;
  citationCount: number | null;
  skills: string[];
  relatedCareer: string | null;
  relevance: number;
  why: RecommendationWhy;
  saved: { id: string; status: SavedStatus } | null;
}

export interface PersonComparison {
  similarities: string[];
  differences: string[];
  insight: string;
  recommendedAction: string;
}

export interface PersonView {
  id: string;
  kind: 'ROLE_MODEL' | 'MENTOR';
  name: string;
  headline: string;
  careerSummary: string;
  skills: string[];
  expertise: string[];
  careerTransitions: { period: string; title: string; organization: string }[];
  publicSources: { label: string; url: string }[];
  relatedRole: string | null;
  location: string | null;
  availability: string | null;
  isDemo: boolean;
  relevance: number;
  whyRelevant: string;
  comparison: PersonComparison;
  saved: { id: string; status: SavedStatus } | null;
}

export interface DiscoverHighlights {
  internship: JobMatchView | null;
  book: BookView | null;
  paper: PaperView | null;
  event: GrowthItemView | null;
  person: PersonView | null;
  focusGap: string | null;
}

export interface SavedItemView {
  id: string;
  kind: SavedKind;
  status: SavedStatus;
  itemId: string;
  title: string;
  subtitle: string;
  url: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProviderRefreshResult {
  provider: string;
  fetched: number;
  imported: number;
  status: 'ok' | 'skipped' | 'failed';
  message?: string;
}

// ---------------------------------------------------------------------------
// Applications & interviews
// ---------------------------------------------------------------------------

export interface PrepChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ApplicationView {
  id: string;
  status: ApplicationStatus;
  opportunity: OpportunityView;
  matchScore: number;
  deadline: string | null;
  appliedAt: string | null;
  notes: string | null;
  nextAction: string;
  prepChecklist: PrepChecklistItem[];
  prepProgress: number;
  statusHistory: { status: ApplicationStatus; at: string }[];
  interviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  focus: string;
  answer: string | null;
  feedback: string | null;
}

export interface InterviewScores {
  communication: number;
  structure: number;
  roleKnowledge: number;
  examples: number;
  confidence: number;
}

export interface InterviewSessionView {
  id: string;
  applicationId: string | null;
  roleTitle: string;
  company: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questions: InterviewQuestion[];
  scores: InterviewScores | null;
  summary: string | null;
  generatedBy: 'AI' | 'TEMPLATE';
  createdAt: string;
  completedAt: string | null;
}

export interface ApplicationDetail extends ApplicationView {
  match: JobMatchResult;
  interviews: InterviewSessionView[];
  relatedNotes: NoteView[];
}

// ---------------------------------------------------------------------------
// Notes, insights, notifications
// ---------------------------------------------------------------------------

export interface NoteView {
  id: string;
  type: NoteType;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InsightView {
  id: string;
  type: 'PATTERN' | 'GAP' | 'STRENGTH' | 'OPPORTUNITY' | 'INTERVIEW' | 'PROGRESS';
  title: string;
  message: string;
  evidence: string[];
  suggestedAction: { label: string; type: AgentActionType; payload: Record<string, unknown> } | null;
  status: 'ACTIVE' | 'DISMISSED' | 'ACTED';
  createdAt: string;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  scheduledAt: string;
  readAt: string | null;
  status: 'SCHEDULED' | 'DELIVERED' | 'READ' | 'DISMISSED';
  createdAt: string;
}

export interface NotificationList {
  items: NotificationView[];
  unread: number;
  scheduled: NotificationView[];
}

// ---------------------------------------------------------------------------
// Progress & Mission Control
// ---------------------------------------------------------------------------

export interface TimelineItem {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string | null;
  xp: number;
}

export interface ProgressSummary {
  readiness: ReadinessResult | null;
  history: { date: string; score: number; breakdown: Record<ReadinessCategory, number> }[];
  level: OrbitLevel;
  streak: { current: number; longest: number; activeToday: boolean };
  stats: {
    skillsAcquired: number;
    experiences: number;
    questsCompleted: number;
    applications: number;
    interviews: number;
    offers: number;
    knowledgeCompleted: number;
  };
  skillsAcquired: { name: string; level: number; acquiredAt: string; source: string }[];
  completedQuests: { id: string; title: string; xp: number; completedAt: string }[];
  applicationFunnel: { status: ApplicationStatus; count: number }[];
  milestones: { id: string; title: string; progress: number }[];
  timeline: TimelineItem[];
}

export interface UpcomingItem {
  id: string;
  kind: 'EVENT' | 'APPLICATION_DEADLINE' | 'QUEST_DEADLINE' | 'REMINDER';
  title: string;
  subtitle: string;
  date: string;
  url: string;
}

export interface MissionControlData {
  firstName: string;
  primaryGoal: CareerGoalView | null;
  readiness: ReadinessResult | null;
  currentQuest: QuestView | null;
  nextBestAction: NextBestAction | null;
  insight: InsightView | null;
  opportunities: { highMatchCount: number; top: JobMatchView[] };
  upcoming: UpcomingItem[];
  level: OrbitLevel;
  streak: number;
  hasJourney: boolean;
}

export interface GoalComparison {
  goals: {
    goal: CareerGoalView;
    readiness: number;
    skillGaps: number;
    topGaps: string[];
    experienceGap: string;
    estimatedPreparationWeeks: number;
    opportunityCount: number;
    preferenceAlignment: number;
  }[];
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentPageContext {
  page: 'mission-control' | 'universe' | 'journey' | 'discover' | 'progress' | 'profile' | 'application' | 'settings' | 'other';
  entityType?: string;
  entityId?: string;
  label?: string;
}

export interface AgentActionView {
  id: string;
  type: AgentActionType;
  tool: AgentToolName | 'ui';
  level: AgentActionLevel;
  title: string;
  description: string;
  status: AgentActionStatus;
  confirmationRequired: boolean;
  payload: Record<string, unknown>;
  resultSummary: string | null;
  createdAt: string;
}

export interface ToolCallView {
  tool: AgentToolName;
  summary: string;
  durationMs: number;
}

export interface AgentMessageView {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  engine: AgentEngine | null;
  toolCalls: ToolCallView[];
  actions: AgentActionView[];
  createdAt: string;
}

export interface AgentChatInput {
  message: string;
  conversationId?: string;
  pageContext?: AgentPageContext;
  /** Language the agent should answer in (defaults to the X-Orbit-Locale header, then English). */
  locale?: AppLocale;
}

export interface AgentChatResponse {
  conversationId: string;
  message: AgentMessageView;
  engine: AgentEngine;
  notice: string | null;
}

export interface AgentConversationView {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface AgentStatus {
  activeEngine: AgentEngine;
  langflow: {
    configured: boolean;
    reachable: boolean;
    flowId: string | null;
    /** model provider the flow runs on */
    modelProvider: string;
    /** why Orbit is not routing chats through Langflow right now (null when it is) */
    skippedReason: string | null;
  };
  ai: {
    provider: string;
    model: string;
    reachable: boolean;
    /** measured local throughput (tokens/second), null for hosted providers */
    throughput: { promptTps: number; evalTps: number } | null;
    /** fast enough to answer agent questions within the time budget */
    interactive: boolean;
  };
  embeddings: { provider: string; model: string };
}

export interface ConfirmActionResult {
  action: AgentActionView;
  message: string;
  navigateTo: string | null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  type: 'NODE' | 'JOB' | 'QUEST' | 'BOOK' | 'PAPER' | 'EVENT' | 'RESOURCE' | 'PERSON' | 'PAGE' | 'NOTE';
  title: string;
  subtitle: string;
  url: string;
}
