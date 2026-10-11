import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  Dna,
  Flame,
  Lightbulb,
  ListChecks,
  Plus,
  Route,
  Sparkles,
  Telescope,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MissionControlData, NextBestAction, QuestView, UpcomingItem } from '@orbit/shared';
import { ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardEyebrow, Progress } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/overlays';
import { CardSkeleton, EmptyState, ErrorState, FadeIn } from '@/components/common/states';
import { MatchChip } from '@/components/common/MatchChip';
import { Checkbox as CheckboxControl } from '@/components/ui/form-controls';
import {
  useAddSkillToJourney,
  useApplications,
  useBuildJourney,
  useConversations,
  useInsightMutations,
  useMissionControl,
  useNotes,
  useQuestTask,
} from '@/hooks/queries';
import { usePageContext, useUiStore } from '@/stores/ui';
import { useSessionStore } from '@/stores/session';
import { useT, type MessageKey } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { cn, daysUntil, formatDate, friendlyDate, greeting, localeDate, round1 } from '@/lib/utils';

export default function MissionControlPage() {
  usePageContext({ page: 'mission-control' });
  const { data, isLoading, error, refetch } = useMissionControl();
  const openAgent = useUiStore((s) => s.openAgent);
  const { t, tr } = useT();
  const labels = useLabels();

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <MissionSkeleton />;

  const delta = data.readiness?.previousScore != null ? round1(data.readiness.score - data.readiness.previousScore) : null;

  return (
    <div className="space-y-5">
      <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{formatDate(new Date(), 'EEEE, d MMMM yyyy')}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight sm:text-[36px]">
            {greeting()}, {data.firstName}
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {data.primaryGoal ? tr('mission.orbitToday', { role: <span className="font-semibold text-foreground">{data.primaryGoal.role.title}</span> }) : t('mission.noRole')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={t('mission.streakTip')}>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold">
              <Flame className="size-4 text-orange" /> {t('mission.streak', { count: data.streak })}
            </span>
          </Tooltip>
          <Tooltip content={t('mission.xpTotal', { xp: data.level.xp })}>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold">
              <Zap className="size-4 text-green" /> {t('mission.level', { level: data.level.level })}
            </span>
          </Tooltip>
          <Button variant="secondary" onClick={() => openAgent(t('mission.planWeekPrompt'))}>
            <Sparkles className="text-green" /> {t('mission.planWeek')}
          </Button>
        </div>
      </FadeIn>

      <GettingStarted data={data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Readiness */}
        <FadeIn delay={0.05} className="lg:col-span-7">
          <Card className="relative h-full overflow-hidden">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(10,180,106,0.14),transparent_65%)]" aria-hidden />
            <div className="relative grid grid-cols-1 gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <ReadinessRing score={data.readiness?.score ?? 0} size={176} className="justify-self-center sm:justify-self-auto" />
              <div className="min-w-0">
                <CardEyebrow>{t('mission.readiness')}</CardEyebrow>
                <h2 className="mt-1 text-[24px] font-bold leading-tight">{data.primaryGoal?.role.title ?? t('mission.noTarget')}</h2>
                {delta !== null && delta !== 0 && (
                  <p className={cn('mt-1 inline-flex items-center gap-1 text-[13px] font-medium', delta > 0 ? 'text-green-strong dark:text-green' : 'text-orange-strong dark:text-orange')}>
                    <TrendingUp className={cn('size-4', delta < 0 && 'rotate-180')} /> {t('mission.delta', { delta: `${delta > 0 ? '+' : ''}${delta}` })}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
                  {data.readiness?.breakdown.map((b) => (
                    <div key={b.category}>
                      <div className="flex justify-between gap-2 text-[12px]">
                        <span className="truncate text-muted-foreground">{labels.readiness(b.category)}</span>
                        <span className="font-semibold tabular">{b.score}</span>
                      </div>
                      <Progress value={b.score} className="mt-1 h-1.5" tone={b.score < 55 ? 'orange' : 'green'} label={labels.readiness(b.category)} />
                    </div>
                  ))}
                </div>
                <Link to="/app/progress" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-green-strong hover:underline dark:text-green">
                  {t('mission.history')} <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </Card>
        </FadeIn>

        {/* Next best action */}
        <FadeIn delay={0.1} className="lg:col-span-5">
          <NextBestActionCard action={data.nextBestAction} />
        </FadeIn>

        {/* Current quest */}
        <FadeIn delay={0.15} className="lg:col-span-7">
          <CurrentQuestCard quest={data.currentQuest} hasJourney={data.hasJourney} />
        </FadeIn>

        {/* Insight */}
        <FadeIn delay={0.2} className="lg:col-span-5">
          <InsightCard data={data} />
        </FadeIn>

        {/* Opportunities */}
        <FadeIn delay={0.25} className="lg:col-span-7">
          <OpportunitiesCard data={data} />
        </FadeIn>

        {/* Upcoming */}
        <FadeIn delay={0.3} className="lg:col-span-5">
          <UpcomingCard items={data.upcoming} />
        </FadeIn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Getting started — a dismissible checklist that teaches new users the core loop.
// ---------------------------------------------------------------------------
interface Step {
  key: MessageKey;
  desc: MessageKey;
  icon: LucideIcon;
  done: boolean;
  run: () => void;
}

function readHidden(userId: string | undefined): boolean {
  try {
    return localStorage.getItem(`orbit.gs.hidden.${userId ?? 'anon'}`) === '1';
  } catch {
    return false;
  }
}

function GettingStarted({ data }: { data: MissionControlData }) {
  const { t } = useT();
  const navigate = useNavigate();
  const openAgent = useUiStore((s) => s.openAgent);
  const userId = useSessionStore((s) => s.user?.id);
  const [hidden, setHidden] = useState(() => readHidden(userId));
  const { data: apps } = useApplications();
  const { data: conversations } = useConversations(!hidden);
  const { data: notes } = useNotes();
  const build = useBuildJourney();

  const taskDone = Boolean(data.currentQuest?.tasks.some((task) => task.completed)) || data.level.xp >= 10 || (data.hasJourney && !data.currentQuest);
  const steps: Step[] = [
    { key: 'gs.s1', desc: 'gs.s1d', icon: Dna, done: Boolean(data.readiness), run: () => navigate('/app/profile') },
    {
      key: 'gs.s2',
      desc: 'gs.s2d',
      icon: Route,
      done: data.hasJourney,
      run: () => build.mutate(undefined, { onSuccess: () => navigate('/app/journey') }),
    },
    { key: 'gs.s3', desc: 'gs.s3d', icon: ListChecks, done: taskDone, run: () => navigate(data.currentQuest ? `/app/journey?quest=${data.currentQuest.id}` : '/app/journey') },
    { key: 'gs.s4', desc: 'gs.s4d', icon: BriefcaseBusiness, done: (apps?.length ?? 0) > 0, run: () => navigate('/app/discover?tab=jobs') },
    { key: 'gs.s5', desc: 'gs.s5d', icon: BrainCircuit, done: (conversations?.length ?? 0) > 0, run: () => openAgent(t('mission.planWeekPrompt')) },
    { key: 'gs.s6', desc: 'gs.s6d', icon: BookMarked, done: (notes?.length ?? 0) > 0, run: () => navigate('/app/journey?view=journal') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const loaded = apps !== undefined && notes !== undefined;
  if (hidden || !loaded || doneCount === steps.length) return null;

  const hide = () => {
    try {
      localStorage.setItem(`orbit.gs.hidden.${userId ?? 'anon'}`, '1');
    } catch {
      // storage unavailable — hide for this visit only
    }
    setHidden(true);
  };
  const nextStep = steps.find((s) => !s.done);

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="card relative overflow-hidden"
        aria-label={t('gs.title')}
      >
        <div className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(10,180,106,0.12),transparent_65%)]" aria-hidden />
        <div className="relative flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative size-12 shrink-0">
              <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--surface-2)" strokeWidth="5" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#0AB46A"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - doneCount / steps.length)}
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular">
                {doneCount}/{steps.length}
              </span>
            </div>
            <div>
              <h2 className="text-[17px] font-semibold">{t('gs.title')}</h2>
              <p className="text-[13px] text-muted-foreground">{t('gs.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextStep && (
              <Button size="sm" onClick={nextStep.run} loading={nextStep.key === 'gs.s2' && build.isPending}>
                {t(nextStep.key)} <ArrowRight />
              </Button>
            )}
            <Tooltip content={t('gs.hide')}>
              <Button size="icon-sm" variant="ghost" onClick={hide} aria-label={t('gs.hide')}>
                <X />
              </Button>
            </Tooltip>
          </div>
        </div>
        <ol className="relative grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.key} className="bg-surface">
              <button
                type="button"
                onClick={s.run}
                disabled={s.done}
                className={cn('group flex h-full w-full items-start gap-3 p-4 text-left transition', s.done ? 'cursor-default' : 'hover:bg-surface-2/70')}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg transition',
                    s.done ? 'bg-green text-white' : s === nextStep ? 'bg-muted-orange text-orange-strong dark:text-orange' : 'bg-surface-2 text-muted-foreground group-hover:text-green',
                  )}
                >
                  {s.done ? <Check className="size-4" strokeWidth={3} /> : <s.icon className="size-4" />}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[13.5px] font-semibold leading-snug', s.done && 'text-muted-foreground line-through decoration-green/60')}>
                    <span className="mr-1 text-subtle-foreground tabular">{i + 1}.</span>
                    {t(s.key)}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{t(s.desc)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </motion.section>
    </AnimatePresence>
  );
}

function NextBestActionCard({ action }: { action: NextBestAction | null }) {
  const navigate = useNavigate();
  const addSkill = useAddSkillToJourney();
  const build = useBuildJourney();
  const { t } = useT();
  const run = () => {
    if (!action) return;
    if (action.action?.type === 'ADD_SKILL_TO_JOURNEY') {
      addSkill.mutate(String(action.action.payload.skillSlug), { onSuccess: (r) => navigate(r.questId ? `/app/journey?quest=${r.questId}` : '/app/journey') });
    } else if (action.action?.type === 'BUILD_JOURNEY') {
      build.mutate(undefined, { onSuccess: () => navigate('/app/journey') });
    } else navigate(action.actionUrl);
  };
  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-[#0f1a15] p-6 text-white shadow-pop">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[#0AB46A]/35 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-[#FB9002]/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-0 opacity-[0.15] grid-dots [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="relative flex h-full flex-col">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
          <Sparkles className="size-3.5 text-[#FB9002]" /> {t('mission.nba')}
        </p>
        {action ? (
          <>
            <h3 className="mt-3 font-display text-[22px] font-bold leading-snug text-white">{action.title}</h3>
            <p className="mt-2 text-[14px] text-white/70">{action.reason}</p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] text-white/80">
              <span className="font-semibold text-[#5fe0a0]">{t('mission.impact')}</span>
              {action.expectedImpact}
            </div>
            <div className="mt-auto pt-5">
              <Button variant="gradient" onClick={run} loading={addSkill.isPending || build.isPending}>
                {action.actionLabel} <ArrowRight />
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-white/70">{t('mission.caughtUp')}</p>
        )}
      </div>
    </div>
  );
}

function CurrentQuestCard({ quest, hasJourney }: { quest: QuestView | null; hasJourney: boolean }) {
  const toggle = useQuestTask();
  const build = useBuildJourney();
  const navigate = useNavigate();
  const { t } = useT();
  if (!quest) {
    return (
      <Card className="h-full">
        <EmptyState
          compact
          icon={Route}
          title={hasJourney ? t('mission.questsDone') : t('mission.pathStarts')}
          description={hasJourney ? t('mission.expandDesc') : t('mission.generateDesc')}
          action={
            <Button onClick={() => build.mutate(undefined, { onSuccess: () => navigate('/app/journey') })} loading={build.isPending}>
              <Plus /> {hasJourney ? t('mission.expand') : t('mission.generate')}
            </Button>
          }
        />
      </Card>
    );
  }
  const open = quest.tasks.filter((task) => !task.completed);
  const shown = [...quest.tasks.filter((task) => task.completed).slice(-1), ...open.slice(0, 3)];
  return (
    <Card className="h-full p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardEyebrow>{t('mission.currentQuest')}</CardEyebrow>
          <h3 className="mt-1 text-[19px] font-semibold leading-snug">{quest.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {quest.relatedSkill ? `${quest.relatedSkill.name} · ` : ''}
            {quest.estimatedEffort} · {quest.xp} XP
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[26px] font-bold leading-none tabular">{quest.progress}%</p>
          <p className="text-[12px] text-muted-foreground">{t('mission.complete')}</p>
        </div>
      </div>
      <Progress value={quest.progress} tone="gradient" className="mt-4" label={t('mission.questProgress')} />
      <ul className="mt-4 space-y-1">
        {shown.map((task) => (
          <li key={task.id}>
            <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[14px] transition hover:bg-surface-2', task.completed && 'text-muted-foreground line-through')}>
              <CheckboxControl checked={task.completed} onCheckedChange={(v) => toggle.mutate({ questId: quest.id, taskId: task.id, completed: Boolean(v) })} aria-label={task.title} />
              <span className="min-w-0 flex-1">{task.title}</span>
              {!task.completed && task.id === open[0]?.id && (
                <Badge tone="orange" className="ml-auto">
                  {t('mission.next')}
                </Badge>
              )}
            </label>
          </li>
        ))}
      </ul>
      <Link to={`/app/journey?quest=${quest.id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-green-strong hover:underline dark:text-green">
        {t('mission.openQuest')} <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

function InsightCard({ data }: { data: MissionControlData }) {
  const { apply, dismiss } = useInsightMutations();
  const openAgent = useUiStore((s) => s.openAgent);
  const { t } = useT();
  const insight = data.insight;
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <CardEyebrow className="flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-orange" /> {t('mission.insight')}
        </CardEyebrow>
        {insight && insight.type !== 'GAP' && (
          <button onClick={() => dismiss.mutate(insight.id)} className="rounded-md p-1 text-subtle-foreground hover:bg-surface-2 hover:text-foreground" aria-label={t('mission.dismissInsight')}>
            <X className="size-4" />
          </button>
        )}
      </div>
      {insight ? (
        <>
          <p className="mt-3 font-display text-[19px] font-semibold leading-snug">{insight.message}</p>
          {insight.evidence.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {insight.evidence.slice(0, 3).map((e) => (
                <li key={e} className="flex gap-2 text-[13px] text-muted-foreground">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle-foreground" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            {insight.suggestedAction && (
              <Button size="sm" onClick={() => apply.mutate(insight.id)} loading={apply.isPending}>
                {insight.suggestedAction.label}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => openAgent(t('mission.askWhyPrompt', { message: insight.message }))}>
              <BrainCircuit /> {t('mission.askWhy')}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{t('mission.insightEmpty')}</p>
      )}
    </Card>
  );
}

function OpportunitiesCard({ data }: { data: MissionControlData }) {
  const { highMatchCount, top } = data.opportunities;
  const { t, tn } = useT();
  return (
    <Card className="h-full p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardEyebrow>{t('mission.newOpps')}</CardEyebrow>
          <h3 className="mt-1 text-[19px] font-semibold">{tn('mission.highMatch', highMatchCount)}</h3>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/discover">
            {t('nav.discover')} <ArrowUpRight />
          </Link>
        </Button>
      </div>
      {top.length === 0 ? (
        <EmptyState compact icon={Telescope} title={t('mission.mapping')} />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {top.map((j) => {
            const days = daysUntil(j.opportunity.deadline);
            return (
              <li key={j.opportunity.id}>
                <Link to={`/app/discover/jobs/${j.opportunity.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-surface-2">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted-orange font-display text-[13px] font-bold text-orange-strong dark:text-orange">
                    {j.opportunity.company.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{j.opportunity.title}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {j.opportunity.company} · {j.opportunity.location}
                      {days !== null && days >= 0 ? t('mission.closesIn', { days }) : ''}
                    </span>
                  </span>
                  <MatchChip value={j.match.overall} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const UPCOMING_ICON: Record<UpcomingItem['kind'], typeof CalendarDays> = {
  EVENT: CalendarDays,
  APPLICATION_DEADLINE: BriefcaseBusiness,
  QUEST_DEADLINE: Route,
  REMINDER: CalendarClock,
};

function UpcomingCard({ items }: { items: UpcomingItem[] }) {
  const { t } = useT();
  return (
    <Card className="flex h-full flex-col p-6">
      <CardEyebrow>{t('mission.upcoming')}</CardEyebrow>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('mission.upcomingEmpty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => {
            const Icon = UPCOMING_ICON[i.kind];
            const d = new Date(i.date);
            return (
              <li key={`${i.kind}-${i.id}`}>
                <Link to={i.url} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-surface py-1">
                    <span className="text-[10px] font-semibold uppercase text-orange">{localeDate(d, { month: 'short' })}</span>
                    <span className="font-display text-[17px] font-bold leading-none">{d.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{i.title}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {friendlyDate(i.date, true)} · {i.subtitle}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {items.length < 3 && (
        <div className="mt-auto pt-4">
          <Link
            to="/app/discover?tab=growth"
            className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-3.5 py-3 text-[13px] text-muted-foreground transition hover:border-green hover:bg-muted-green/50 hover:text-foreground"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted-orange text-orange-strong dark:text-orange">
              <CalendarDays className="size-4" />
            </span>
            <span className="min-w-0 flex-1">{t('mission.findEvents')}</span>
            <ArrowRight className="size-4 shrink-0" />
          </Link>
        </div>
      )}
    </Card>
  );
}

function MissionSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <div className="space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-9 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <CardSkeleton className="h-[240px] lg:col-span-7" lines={5} />
        <CardSkeleton className="h-[240px] lg:col-span-5" lines={4} />
        <CardSkeleton className="h-[220px] lg:col-span-7" />
        <CardSkeleton className="h-[220px] lg:col-span-5" />
      </div>
    </div>
  );
}
