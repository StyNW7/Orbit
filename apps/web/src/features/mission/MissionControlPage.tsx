import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Flame,
  Lightbulb,
  Plus,
  Route,
  Sparkles,
  Telescope,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type { MissionControlData, NextBestAction, QuestView, UpcomingItem } from '@orbit/shared';
import { ReadinessRing } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardEyebrow, Progress } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/overlays';
import { CardSkeleton, EmptyState, ErrorState, FadeIn } from '@/components/common/states';
import { MatchChip } from '@/components/common/MatchChip';
import { Checkbox as CheckboxControl } from '@/components/ui/form-controls';
import { useAddSkillToJourney, useBuildJourney, useInsightMutations, useMissionControl, useQuestTask } from '@/hooks/queries';
import { usePageContext, useUiStore } from '@/stores/ui';
import { cn, daysUntil, friendlyDate, greeting, round1 } from '@/lib/utils';


export default function MissionControlPage() {
  usePageContext({ page: 'mission-control' });
  const { data, isLoading, error, refetch } = useMissionControl();
  const openAgent = useUiStore((s) => s.openAgent);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <MissionSkeleton />;

  const delta = data.readiness?.previousScore != null ? round1(data.readiness.score - data.readiness.previousScore) : null;

  return (
    <div className="space-y-5">
      <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">{friendlyDate(new Date().toISOString())}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight sm:text-[36px]">
            {greeting()}, {data.firstName}
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {data.primaryGoal ? (
              <>
                Here’s what matters for your <span className="font-semibold text-foreground">{data.primaryGoal.role.title}</span> orbit today.
              </>
            ) : (
              'Set a target role to start your orbit.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content="Days in a row with career progress">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold">
              <Flame className="size-4 text-orange" /> {data.streak}-day streak
            </span>
          </Tooltip>
          <Tooltip content={`${data.level.xp} XP total`}>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold">
              <Zap className="size-4 text-green" /> Level {data.level.level}
            </span>
          </Tooltip>
          <Button variant="secondary" onClick={() => openAgent('What should I focus on this week?')}>
            <Sparkles className="text-green" /> Plan my week
          </Button>
        </div>
      </FadeIn>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Readiness */}
        <FadeIn delay={0.05} className="lg:col-span-7">
          <Card className="relative h-full overflow-hidden">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(10,180,106,0.14),transparent_65%)]" aria-hidden />
            <div className="relative grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <ReadinessRing score={data.readiness?.score ?? 0} size={176} />
              <div className="min-w-0">
                <CardEyebrow>Career readiness</CardEyebrow>
                <h2 className="mt-1 text-[24px] font-bold leading-tight">{data.primaryGoal?.role.title ?? 'No target role yet'}</h2>
                {delta !== null && delta !== 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-green-strong dark:text-green">
                    <TrendingUp className="size-4" /> {delta > 0 ? '+' : ''}
                    {delta} since last update
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
                  {data.readiness?.breakdown.map((b) => (
                    <div key={b.category}>
                      <div className="flex justify-between text-[12px]">
                        <span className="truncate text-muted-foreground">{b.label}</span>
                        <span className="font-semibold tabular">{b.score}</span>
                      </div>
                      <Progress value={b.score} className="mt-1 h-1.5" tone={b.score < 55 ? 'orange' : 'green'} label={b.label} />
                    </div>
                  ))}
                </div>
                <Link to="/app/progress" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-green-strong hover:underline dark:text-green">
                  See readiness history <ArrowRight className="size-3.5" />
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

function NextBestActionCard({ action }: { action: NextBestAction | null }) {
  const navigate = useNavigate();
  const addSkill = useAddSkillToJourney();
  const build = useBuildJourney();
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
      <div className="relative flex h-full flex-col">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
          <Sparkles className="size-3.5 text-[#FB9002]" /> Next best action
        </p>
        {action ? (
          <>
            <h3 className="mt-3 font-display text-[22px] font-bold leading-snug text-white">{action.title}</h3>
            <p className="mt-2 text-[14px] text-white/70">{action.reason}</p>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] text-white/80">
              <span className="font-semibold text-[#5fe0a0]">Impact · </span>
              {action.expectedImpact}
            </div>
            <div className="mt-auto pt-5">
              <Button variant="gradient" onClick={run} loading={addSkill.isPending || build.isPending}>
                {action.actionLabel} <ArrowRight />
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-3 text-white/70">You are all caught up. Ask Orbit to plan your next step.</p>
        )}
      </div>
    </div>
  );
}

function CurrentQuestCard({ quest, hasJourney }: { quest: QuestView | null; hasJourney: boolean }) {
  const toggle = useQuestTask();
  const build = useBuildJourney();
  const navigate = useNavigate();
  if (!quest) {
    return (
      <Card className="h-full">
        <EmptyState
          compact
          icon={Route}
          title={hasJourney ? 'Every quest is complete' : 'Your next career path starts here.'}
          description={hasJourney ? 'Expand your journey to unlock new quests.' : 'Generate a journey to turn your gaps into milestones and quests.'}
          action={
            <Button onClick={() => build.mutate(undefined, { onSuccess: () => navigate('/app/journey') })} loading={build.isPending}>
              <Plus /> {hasJourney ? 'Expand journey' : 'Generate my journey'}
            </Button>
          }
        />
      </Card>
    );
  }
  const open = quest.tasks.filter((t) => !t.completed);
  const shown = [...quest.tasks.filter((t) => t.completed).slice(-1), ...open.slice(0, 3)];
  return (
    <Card className="h-full p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardEyebrow>Current quest</CardEyebrow>
          <h3 className="mt-1 text-[19px] font-semibold leading-snug">{quest.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {quest.relatedSkill ? `${quest.relatedSkill.name} · ` : ''}
            {quest.estimatedEffort} · {quest.xp} XP
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[26px] font-bold leading-none tabular">{quest.progress}%</p>
          <p className="text-[12px] text-muted-foreground">complete</p>
        </div>
      </div>
      <Progress value={quest.progress} tone="gradient" className="mt-4" label="Quest progress" />
      <ul className="mt-4 space-y-1">
        {shown.map((t) => (
          <li key={t.id}>
            <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[14px] transition hover:bg-surface-2', t.completed && 'text-muted-foreground line-through')}>
              <CheckboxControl
                checked={t.completed}
                onCheckedChange={(v) => toggle.mutate({ questId: quest.id, taskId: t.id, completed: Boolean(v) })}
                aria-label={t.title}
              />
              {t.title}
              {!t.completed && t.id === open[0]?.id && (
                <Badge tone="orange" className="ml-auto">
                  Next
                </Badge>
              )}
            </label>
          </li>
        ))}
      </ul>
      <Link to={`/app/journey?quest=${quest.id}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-green-strong hover:underline dark:text-green">
        Open quest <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

function InsightCard({ data }: { data: MissionControlData }) {
  const { apply, dismiss } = useInsightMutations();
  const openAgent = useUiStore((s) => s.openAgent);
  const insight = data.insight;
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <CardEyebrow className="flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-orange" /> Orbit insight
        </CardEyebrow>
        {insight && insight.type !== 'GAP' && (
          <button onClick={() => dismiss.mutate(insight.id)} className="rounded-md p-1 text-subtle-foreground hover:bg-surface-2 hover:text-foreground" aria-label="Dismiss insight">
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
            <Button size="sm" variant="ghost" onClick={() => openAgent(`Tell me more about this insight: ${insight.message}`)}>
              <BrainCircuit /> Ask why
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Orbit will surface patterns from your progress, notes and interviews here.</p>
      )}
    </Card>
  );
}

function OpportunitiesCard({ data }: { data: MissionControlData }) {
  const { highMatchCount, top } = data.opportunities;
  return (
    <Card className="h-full p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardEyebrow>New opportunities</CardEyebrow>
          <h3 className="mt-1 text-[19px] font-semibold">
            {highMatchCount} high-match {highMatchCount === 1 ? 'opportunity' : 'opportunities'}
          </h3>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/discover">
            Discover <ArrowUpRight />
          </Link>
        </Button>
      </div>
      {top.length === 0 ? (
        <EmptyState compact icon={Telescope} title="We’re still mapping opportunities that match your Orbit." />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {top.map((j) => {
            const days = daysUntil(j.opportunity.deadline);
            return (
              <li key={j.opportunity.id}>
                <Link to={`/app/discover/jobs/${j.opportunity.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-surface-2">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted-orange text-orange-strong dark:text-orange">
                    <BriefcaseBusiness className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{j.opportunity.title}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {j.opportunity.company} · {j.opportunity.location}
                      {days !== null && days >= 0 ? ` · closes in ${days}d` : ''}
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
  return (
    <Card className="h-full p-6">
      <CardEyebrow>Upcoming</CardEyebrow>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No upcoming deadlines or events. Save an event in Discover to see it here.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => {
            const Icon = UPCOMING_ICON[i.kind];
            const d = new Date(i.date);
            return (
              <li key={`${i.kind}-${i.id}`}>
                <Link to={i.url} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-surface py-1">
                    <span className="text-[10px] font-semibold uppercase text-orange">{d.toLocaleDateString('en', { month: 'short' })}</span>
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
    </Card>
  );
}

function MissionSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <motion.div className="space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-9 w-72" />
      </motion.div>
      <div className="grid gap-5 lg:grid-cols-12">
        <CardSkeleton className="h-[240px] lg:col-span-7" lines={5} />
        <CardSkeleton className="h-[240px] lg:col-span-5" lines={4} />
        <CardSkeleton className="h-[220px] lg:col-span-7" />
        <CardSkeleton className="h-[220px] lg:col-span-5" />
      </div>
    </div>
  );
}
