import { QueryClient, useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AddSkillToJourneyResult,
  AgentChatInput,
  AgentChatResponse,
  AgentConversationView,
  AgentMessageView,
  AgentStatus,
  AnalyzeProfileInput,
  AnalyzeProfileResult,
  ApplicationDetail,
  ApplicationStatus,
  ApplicationView,
  BookView,
  CareerGoalView,
  CareerIntelligence,
  CareerRoleView,
  ConfirmActionResult,
  CvUploadResult,
  DiscoverHighlights,
  EvidenceType,
  ExperienceType,
  GoalComparison,
  GrowthItemView,
  InsightView,
  InterviewSessionView,
  JobMatchView,
  JourneyDetail,
  MeResponse,
  MissionControlData,
  NodeDetail,
  NoteType,
  NoteView,
  NotificationList,
  NotificationView,
  OpportunityType,
  PaperView,
  PersonView,
  PrepChecklistItem,
  ProfileDetail,
  ProgressSummary,
  ProviderRefreshResult,
  QuestProgressResult,
  QuestView,
  SavedItemView,
  SavedKind,
  SavedStatus,
  SearchResult,
  SkillView,
  StoredFileView,
  UniverseGraph,
  UserSkillView,
  WorkMode,
} from '@orbit/shared';
import { api, errorMessage } from '@/lib/api';
import { round1 } from '@/lib/utils';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error: any) => count < 2 && (error?.retryable ?? true) && error?.status !== 401 && error?.status !== 404,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

const qs = (params: Record<string, string | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? `?${new URLSearchParams(p as [string, string][]).toString()}` : '';
};

/** Everything derived from career state — refreshed after meaningful changes. */
export function invalidateCareer(qc = queryClient) {
  for (const key of ['me', 'mission', 'intelligence', 'profile', 'journey', 'journeys', 'universe', 'node', 'progress', 'jobs', 'job', 'highlights', 'growth', 'books', 'papers', 'people', 'applications', 'application', 'notifications', 'goals', 'goals-compare', 'insights', 'saved', 'quest']) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

function readinessToast(before: number | null | undefined, after: number | null | undefined, extra?: string) {
  if (after == null) return;
  const delta = before == null ? null : round1(after - before);
  if (delta && delta > 0) toast.success(`Career Readiness +${delta}`, { description: extra ?? `Now ${round1(after)}% — Orbit recalculated your readiness.` });
  else if (extra) toast.success(extra);
}

// ---------------------------------------------------------------------------
// Session & profile
// ---------------------------------------------------------------------------
export const useMe = (enabled = true) => useQuery({ queryKey: ['me'], queryFn: () => api.get<MeResponse>('/auth/me'), enabled, staleTime: 60_000 });
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api.get<ProfileDetail>('/profile') });
export const useIntelligence = () => useQuery({ queryKey: ['intelligence'], queryFn: () => api.get<CareerIntelligence>('/profile/intelligence') });
export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => api.get<CareerRoleView[]>('/roles'), staleTime: 10 * 60_000 });
export const useSkillsCatalog = () => useQuery({ queryKey: ['skills-catalog'], queryFn: () => api.get<SkillView[]>('/skills/catalog'), staleTime: 10 * 60_000 });

export function useUploadCv() {
  return useMutation({
    mutationFn: (file: File) => api.upload<CvUploadResult>('/files/cv', file),
    onError: (e) => toast.error('CV upload failed', { description: errorMessage(e) }),
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: 'EVIDENCE' | 'CERTIFICATE' }) => api.upload<StoredFileView>(`/files?purpose=${purpose}`, file),
    onError: (e) => toast.error('Upload failed', { description: errorMessage(e) }),
  });
}

export function useAnalyzeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalyzeProfileInput) => api.post<AnalyzeProfileResult>('/profile/analyze', input as unknown as Record<string, unknown>),
    onSuccess: () => invalidateCareer(qc),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<ProfileDetail>('/profile', data),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data);
      invalidateCareer(qc);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error('Could not update profile', { description: errorMessage(e) }),
  });
}

export function useExperienceMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => () => {
    invalidateCareer(qc);
    toast.success(msg);
  };
  const fail = (e: unknown) => toast.error('Something went wrong', { description: errorMessage(e) });
  return {
    add: useMutation({
      mutationFn: (data: { type: ExperienceType; title: string; organization: string; description?: string; startDate?: string; endDate?: string; current?: boolean }) =>
        api.post('/experiences', data),
      onSuccess: done('Experience added — your Universe and readiness were updated'),
      onError: fail,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/experiences/${id}`), onSuccess: done('Experience removed'), onError: fail }),
    upsertSkill: useMutation({
      mutationFn: (data: { skillSlug: string; level: number }) => api.post<UserSkillView[]>('/skills', data),
      onSuccess: done('Skill saved'),
      onError: fail,
    }),
    removeSkill: useMutation({ mutationFn: (id: string) => api.del(`/skills/${id}`), onSuccess: done('Skill removed'), onError: fail }),
    addAchievement: useMutation({
      mutationFn: (data: { type: 'AWARD' | 'CERTIFICATION' | 'PUBLICATION'; title: string; issuer?: string; date?: string }) => api.post('/achievements', data),
      onSuccess: done('Achievement added'),
      onError: fail,
    }),
    removeAchievement: useMutation({ mutationFn: (id: string) => api.del(`/achievements/${id}`), onSuccess: done('Achievement removed'), onError: fail }),
  };
}

// ---------------------------------------------------------------------------
// Goals (My Orbits)
// ---------------------------------------------------------------------------
export const useGoals = () => useQuery({ queryKey: ['goals'], queryFn: () => api.get<CareerGoalView[]>('/goals') });
export const useGoalComparison = (enabled = true) => useQuery({ queryKey: ['goals-compare'], queryFn: () => api.get<GoalComparison>('/goals/compare'), enabled });

export function useGoalMutations() {
  const qc = useQueryClient();
  const fail = (e: unknown) => toast.error('Could not update your orbits', { description: errorMessage(e) });
  return {
    add: useMutation({
      mutationFn: (roleSlug: string) => api.post<CareerGoalView[]>('/goals', { roleSlug }),
      onSuccess: () => {
        invalidateCareer(qc);
        toast.success('New orbit added', { description: 'Compare it with your primary path anytime.' });
      },
      onError: fail,
    }),
    setPrimary: useMutation({
      mutationFn: (goalId: string) => api.post<CareerGoalView[]>(`/goals/${goalId}/primary`),
      onSuccess: (goals) => {
        invalidateCareer(qc);
        toast.success(`${goals.find((g) => g.isPrimary)?.role.title ?? 'Goal'} is now your primary orbit`);
      },
      onError: fail,
    }),
    archive: useMutation({
      mutationFn: (goalId: string) => api.del<CareerGoalView[]>(`/goals/${goalId}`),
      onSuccess: () => {
        invalidateCareer(qc);
        toast.success('Orbit archived');
      },
      onError: fail,
    }),
  };
}

// ---------------------------------------------------------------------------
// Mission Control & progress
// ---------------------------------------------------------------------------
export const useMissionControl = () => useQuery({ queryKey: ['mission'], queryFn: () => api.get<MissionControlData>('/mission-control') });
export const useProgress = () => useQuery({ queryKey: ['progress'], queryFn: () => api.get<ProgressSummary>('/progress') });
export const useInsights = () => useQuery({ queryKey: ['insights'], queryFn: () => api.get<InsightView[]>('/insights') });

export function useInsightMutations() {
  const qc = useQueryClient();
  return {
    apply: useMutation({
      mutationFn: (id: string) => api.post<ConfirmActionResult>(`/insights/${id}/apply`),
      onSuccess: (r) => {
        invalidateCareer(qc);
        toast.success(r.message);
      },
      onError: (e) => toast.error('Could not apply this suggestion', { description: errorMessage(e) }),
    }),
    dismiss: useMutation({
      mutationFn: (id: string) => api.post(`/insights/${id}/dismiss`),
      onSuccess: () => invalidateCareer(qc),
    }),
  };
}

// ---------------------------------------------------------------------------
// Universe
// ---------------------------------------------------------------------------
export const useUniverse = () => useQuery({ queryKey: ['universe'], queryFn: () => api.get<UniverseGraph>('/universe'), staleTime: 15_000 });
export const useNodeDetail = (id: string | null) =>
  useQuery({ queryKey: ['node', id], queryFn: () => api.get<NodeDetail>(`/universe/nodes/${id}`), enabled: Boolean(id) });

export function useRebuildUniverse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<UniverseGraph>('/universe/rebuild'),
    onSuccess: (graph) => {
      qc.setQueryData(['universe'], graph);
      toast.success('Career Universe refreshed', { description: `${graph.nodes.length} nodes · ${graph.edges.length} connections` });
    },
    onError: (e) => toast.error('Could not refresh your Universe', { description: errorMessage(e) }),
  });
}

export function useAddUniverseNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string; label: string; description?: string }) => api.post('/universe/nodes', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['universe'] });
      toast.success('Added to your Career Universe');
    },
    onError: (e) => toast.error('Could not add node', { description: errorMessage(e) }),
  });
}

// ---------------------------------------------------------------------------
// Journey & quests
// ---------------------------------------------------------------------------
export const usePrimaryJourney = () => useQuery({ queryKey: ['journey', 'primary'], queryFn: () => api.get<JourneyDetail | null>('/journeys/primary') });
export const useJourneys = () => useQuery({ queryKey: ['journeys'], queryFn: () => api.get<JourneyDetail[]>('/journeys') });

export function useBuildJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId?: string) => api.post<JourneyDetail>('/journeys', goalId ? { goalId } : {}),
    onSuccess: (j) => {
      invalidateCareer(qc);
      toast.success(`${j.title} is ready`, { description: `${j.milestones.length} milestones · ${j.milestones.reduce((s, m) => s + m.quests.length, 0)} quests` });
    },
    onError: (e) => toast.error('Could not build your journey', { description: errorMessage(e) }),
  });
}

export function useAddSkillToJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skillSlug: string) => api.post<AddSkillToJourneyResult>('/journeys/skills', { skillSlug }),
    onSuccess: (r) => {
      invalidateCareer(qc);
      if (r.created) toast.success('Added to your Journey', { description: r.message });
      else toast(r.message);
    },
    onError: (e) => toast.error('Could not add to journey', { description: errorMessage(e) }),
  });
}

export function useAddCustomQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description: string; tasks: string[]; skillSlug?: string; category?: string }) => api.post<JourneyDetail>('/journeys/quests', data),
    onSuccess: () => {
      invalidateCareer(qc);
      toast.success('Quest added to your journey');
    },
    onError: (e) => toast.error('Could not add quest', { description: errorMessage(e) }),
  });
}

export function useQuestTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, taskId, completed }: { questId: string; taskId: string; completed: boolean }) =>
      api.post<QuestProgressResult>(`/quests/${questId}/progress`, { taskId, completed }),
    onMutate: async ({ questId, taskId, completed }) => {
      await qc.cancelQueries({ queryKey: ['journey', 'primary'] });
      const prev = qc.getQueryData<JourneyDetail | null>(['journey', 'primary']);
      if (prev) {
        qc.setQueryData<JourneyDetail>(['journey', 'primary'], {
          ...prev,
          milestones: prev.milestones.map((m) => ({
            ...m,
            quests: m.quests.map((q) => {
              if (q.id !== questId) return q;
              const tasks = q.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t));
              return { ...q, tasks, progress: Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100) };
            }),
          })),
        });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['journey', 'primary'], ctx.prev);
      toast.error('Could not update the task', { description: errorMessage(e) });
    },
    onSuccess: (r, v) => {
      invalidateCareer(qc);
      if (v.completed) {
        readinessToast(r.readiness?.previousScore, r.readiness?.score, `+${r.xpGained} XP · ${r.quest.title} ${r.quest.progress}%`);
        if (r.leveledUp) toast.success(`Orbit Level ${r.level.level} reached`);
      }
    },
  });
}

export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, completeRemainingTasks }: { questId: string; completeRemainingTasks?: boolean }) =>
      api.post<QuestProgressResult>(`/quests/${questId}/complete`, { completeRemainingTasks: completeRemainingTasks ?? false }),
    onSuccess: (r) => {
      invalidateCareer(qc);
      toast.success(`Quest completed · +${r.xpGained} XP`, { description: r.milestoneCompleted ? 'Milestone reached — nice momentum.' : r.quest.title });
      readinessToast(r.readiness?.previousScore, r.readiness?.score);
    },
    onError: (e) => toast.error('Could not complete the quest', { description: errorMessage(e) }),
  });
}

export function useSubmitEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, ...body }: { questId: string; type: EvidenceType; url?: string; text?: string; fileId?: string }) =>
      api.post<QuestView>(`/quests/${questId}/evidence`, body),
    onSuccess: (q) => {
      invalidateCareer(qc);
      toast.success('Evidence saved', { description: q.evidence[0]?.aiReview ? 'Orbit reviewed it — see the note on the quest.' : 'You can complete the quest when you are ready.' });
    },
    onError: (e) => toast.error('Could not save evidence', { description: errorMessage(e) }),
  });
}

export function useUpdateQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, deadline }: { questId: string; deadline: string | null }) => api.patch<QuestView>(`/quests/${questId}`, { deadline }),
    onSuccess: () => {
      invalidateCareer(qc);
      toast.success('Quest deadline updated');
    },
  });
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------
export const useHighlights = () => useQuery({ queryKey: ['highlights'], queryFn: () => api.get<DiscoverHighlights>('/discover/highlights') });
export const useJobs = (f: { type?: OpportunityType; workMode?: WorkMode; q?: string }) =>
  useQuery({ queryKey: ['jobs', f], queryFn: () => api.get<JobMatchView[]>(`/discover/jobs${qs(f)}`), placeholderData: keepPreviousData });
export const useJob = (id: string | undefined) =>
  useQuery({ queryKey: ['job', id], queryFn: () => api.get<JobMatchView & { explanation: string; explainedBy: 'AI' | 'TEMPLATE' }>(`/discover/jobs/${id}`), enabled: Boolean(id) });
export const useGrowth = (type?: string) => useQuery({ queryKey: ['growth', type], queryFn: () => api.get<GrowthItemView[]>(`/discover/growth${qs({ type })}`), placeholderData: keepPreviousData });
export const useBooks = (q?: string) => useQuery({ queryKey: ['books', q], queryFn: () => api.get<BookView[]>(`/discover/books${qs({ q })}`), placeholderData: keepPreviousData });
export const usePapers = (q?: string) => useQuery({ queryKey: ['papers', q], queryFn: () => api.get<PaperView[]>(`/discover/papers${qs({ q })}`), placeholderData: keepPreviousData });
export const usePeople = (kind?: string) => useQuery({ queryKey: ['people', kind], queryFn: () => api.get<PersonView[]>(`/discover/people${qs({ kind })}`) });
export const useSaved = () => useQuery({ queryKey: ['saved'], queryFn: () => api.get<SavedItemView[]>('/discover/saved') });

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { kind: SavedKind; itemId: string }) => api.post<SavedItemView>('/discover/saved', data),
    onSuccess: (s) => {
      invalidateCareer(qc);
      toast.success('Saved', { description: `“${s.title}” is now connected to your Orbit.` });
    },
    onError: (e) => toast.error('Could not save', { description: errorMessage(e) }),
  });
}

export function useUpdateSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SavedStatus }) => api.patch<SavedItemView>(`/discover/saved/${id}`, { status }),
    onSuccess: (s) => {
      invalidateCareer(qc);
      toast.success(s.status === 'COMPLETED' ? `Completed “${s.title}” · +40 XP` : 'Updated');
    },
    onError: (e) => toast.error('Could not update', { description: errorMessage(e) }),
  });
}

export function useUnsave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/discover/saved/${id}`),
    onSuccess: () => invalidateCareer(qc),
  });
}

export function useRefreshJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ProviderRefreshResult[]>('/discover/jobs/refresh'),
    onSuccess: (r) => {
      invalidateCareer(qc);
      const imported = r.reduce((s, x) => s + x.imported, 0);
      const failed = r.filter((x) => x.status === 'failed').map((x) => x.provider);
      toast.success(`Opportunities refreshed · ${imported} new`, { description: failed.length ? `Unavailable right now: ${failed.join(', ')}` : 'All providers responded.' });
    },
    onError: (e) => toast.error('Refresh failed', { description: errorMessage(e) }),
  });
}

// ---------------------------------------------------------------------------
// Applications & interviews
// ---------------------------------------------------------------------------
export const useApplications = () => useQuery({ queryKey: ['applications'], queryFn: () => api.get<ApplicationView[]>('/applications') });
export const useApplication = (id: string | undefined) =>
  useQuery({ queryKey: ['application', id], queryFn: () => api.get<ApplicationDetail>(`/applications/${id}`), enabled: Boolean(id) });

export function useSaveJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId: string) => api.post<ApplicationView & { reminderScheduledAt: string | null }>('/applications', { opportunityId }),
    onSuccess: (a) => {
      invalidateCareer(qc);
      toast.success(`Saved ${a.opportunity.title}`, {
        description: a.reminderScheduledAt ? 'Deadline detected — Orbit scheduled a reminder for you.' : 'Track it in your applications.',
      });
    },
    onError: (e) => toast.error('Could not save this job', { description: errorMessage(e) }),
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: ApplicationStatus; notes?: string | null; deadline?: string | null; prepChecklist?: PrepChecklistItem[] }) =>
      api.patch<ApplicationView>(`/applications/${id}`, data),
    onSuccess: () => invalidateCareer(qc),
    onError: (e) => toast.error('Could not update the application', { description: errorMessage(e) }),
  });
}

export function useRemoveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/applications/${id}`),
    onSuccess: () => {
      invalidateCareer(qc);
      toast.success('Application removed');
    },
  });
}

export function useInterviewMutations(applicationId?: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['application', applicationId] });
  return {
    start: useMutation({
      mutationFn: () => api.post<InterviewSessionView>('/interviews', applicationId ? { applicationId } : {}),
      onSuccess: refresh,
      onError: (e) => toast.error('Could not start practice', { description: errorMessage(e) }),
    }),
    answer: useMutation({
      mutationFn: ({ sessionId, questionId, answer }: { sessionId: string; questionId: string; answer: string }) =>
        api.post<InterviewSessionView>(`/interviews/${sessionId}/answers`, { questionId, answer }),
      onSuccess: refresh,
      onError: (e) => toast.error('Could not save your answer', { description: errorMessage(e) }),
    }),
    complete: useMutation({
      mutationFn: (sessionId: string) => api.post<InterviewSessionView>(`/interviews/${sessionId}/complete`),
      onSuccess: () => {
        invalidateCareer(qc);
        toast.success('Practice complete · +100 XP', { description: 'Your coaching indicators and insights were updated.' });
      },
      onError: (e) => toast.error('Could not finish the session', { description: errorMessage(e) }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Notes & notifications
// ---------------------------------------------------------------------------
export const useNotes = (q?: string) => useQuery({ queryKey: ['notes', q], queryFn: () => api.get<NoteView[]>(`/notes${qs({ q })}`), placeholderData: keepPreviousData });
export const usePatterns = () => useQuery({ queryKey: ['insights', 'patterns'], queryFn: () => api.get<InsightView[]>('/notes/patterns') });

export function useNoteMutations() {
  const qc = useQueryClient();
  const after = (r: { patterns: InsightView[] }, msg: string) => {
    void qc.invalidateQueries({ queryKey: ['notes'] });
    void qc.invalidateQueries({ queryKey: ['insights'] });
    void qc.invalidateQueries({ queryKey: ['mission'] });
    toast.success(msg, { description: r.patterns.length ? 'Orbit noticed a recurring pattern in your notes.' : undefined });
  };
  return {
    create: useMutation({
      mutationFn: (data: { type: NoteType; title: string; content: string; tags?: string[] }) => api.post<{ note: NoteView; patterns: InsightView[] }>('/notes', data),
      onSuccess: (r) => after(r, 'Note saved · +5 XP'),
      onError: (e) => toast.error('Could not save note', { description: errorMessage(e) }),
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: string; type?: NoteType; title?: string; content?: string }) => api.patch<{ note: NoteView; patterns: InsightView[] }>(`/notes/${id}`, data),
      onSuccess: (r) => after(r, 'Note updated'),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.del(`/notes/${id}`),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['notes'] });
        toast.success('Note deleted');
      },
    }),
  };
}

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationList>('/notifications'), refetchInterval: 30_000, refetchIntervalInBackground: false });

export function useNotificationMutations() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications'] });
  return {
    read: useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: refresh }),
    readAll: useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh }),
    dismiss: useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/dismiss`), onSuccess: refresh }),
    remind: useMutation({
      mutationFn: (data: { title: string; message?: string; scheduledAt: string; actionUrl?: string }) => api.post<NotificationView>('/notifications/reminders', data),
      onSuccess: (n) => {
        refresh();
        void qc.invalidateQueries({ queryKey: ['mission'] });
        toast.success('Reminder scheduled', { description: n.title });
      },
      onError: (e) => toast.error('Could not create reminder', { description: errorMessage(e) }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------
export const useAgentStatus = () => useQuery({ queryKey: ['agent-status'], queryFn: () => api.get<AgentStatus>('/agent/status'), staleTime: 60_000 });
export const useConversations = (enabled: boolean) => useQuery({ queryKey: ['conversations'], queryFn: () => api.get<AgentConversationView[]>('/agent/conversations'), enabled });

export function useAgentChat() {
  return useMutation({ mutationFn: (input: AgentChatInput) => api.post<AgentChatResponse>('/agent/chat', input as unknown as Record<string, unknown>) });
}

export function loadConversation(id: string) {
  return api.get<AgentMessageView[]>(`/agent/conversations/${id}/messages`);
}

export function useAgentAction() {
  const qc = useQueryClient();
  return {
    confirm: useMutation({
      mutationFn: (id: string) => api.post<ConfirmActionResult>(`/agent/actions/${id}/confirm`),
      onSuccess: (r) => {
        invalidateCareer(qc);
        toast.success(r.message);
      },
      onError: (e) => toast.error('Action failed', { description: errorMessage(e) }),
    }),
    reject: useMutation({ mutationFn: (id: string) => api.post(`/agent/actions/${id}/reject`) }),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export const useSearch = (q: string, enabled: boolean) =>
  useQuery({ queryKey: ['search', q], queryFn: () => api.get<SearchResult[]>(`/search${qs({ q })}`), enabled, placeholderData: keepPreviousData, staleTime: 10_000 });
