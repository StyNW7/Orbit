import { useMemo } from 'react';
import { format } from 'date-fns';
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Flag,
  Flame,
  Gauge,
  GraduationCap,
  Medal,
  MessagesSquare,
  PenLine,
  Rocket,
  Route,
  Sparkles,
  Target,
  Trophy,
  UserRoundCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { APPLICATION_STATUS_LABELS, READINESS_CATEGORY_LABELS, type ProgressSummary, type ReadinessCategory } from '@orbit/shared';
import { AnimatedNumber } from '@/components/brand/brand';
import { Badge, Card, CardEyebrow, Progress } from '@/components/ui/primitives';
import { CardSkeleton, ErrorState, PageHeader, ScoreBar, StatTile } from '@/components/common/states';
import { useProgress } from '@/hooks/queries';
import { useIsDark, usePageContext } from '@/stores/ui';
import { round1 } from '@/lib/utils';

const TIMELINE_ICON: Record<string, LucideIcon> = {
  PROFILE_ANALYZED: Sparkles,
  GOAL_SET: Target,
  JOURNEY_STARTED: Route,
  QUEST_COMPLETED: CheckCircle2,
  MILESTONE_COMPLETED: Flag,
  SKILL_ACQUIRED: Zap,
  EXPERIENCE_ADDED: BriefcaseBusiness,
  EXPERIENCE: Rocket,
  APPLICATION_UPDATED: BriefcaseBusiness,
  INTERVIEW_PRACTICED: MessagesSquare,
  READINESS_MILESTONE: Gauge,
  RESOURCE_COMPLETED: BookOpen,
  NOTE_WRITTEN: PenLine,
};

export default function ProgressPage() {
  usePageContext({ page: 'progress' });
  const { data, isLoading, error, refetch } = useProgress();
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <CardSkeleton className="h-[320px] lg:col-span-2" lines={6} />
        <CardSkeleton className="h-[320px]" lines={6} />
      </div>
    );
  }
  return <ProgressBody data={data} />;
}

function ProgressBody({ data }: { data: ProgressSummary }) {
  const dark = useIsDark();
  const first = data.history[0]?.score;
  const current = data.readiness?.score ?? 0;
  const growth = first !== undefined ? round1(current - first) : null;
  const chart = useMemo(() => {
    const points = data.history.map((h) => ({ date: h.date, score: h.score }));
    if (data.readiness && (!points.length || points[points.length - 1].score !== data.readiness.score)) points.push({ date: data.readiness.computedAt, score: data.readiness.score });
    return points;
  }, [data]);
  const radar = data.readiness?.breakdown.map((b) => ({ category: READINESS_CATEGORY_LABELS[b.category as ReadinessCategory].replace(' Readiness', '').replace(' Match', ''), score: b.score })) ?? [];
  const grid = dark ? '#25322c' : '#e3e9e6';
  const axis = dark ? '#75837c' : '#8b9791';

  const grouped = useMemo(() => {
    const m = new Map<string, ProgressSummary['timeline']>();
    for (const t of data.timeline) {
      const key = format(new Date(t.date), 'MMMM yyyy');
      m.set(key, [...(m.get(key) ?? []), t]);
    }
    return [...m.entries()];
  }, [data.timeline]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Progress"
        title="How far you’ve come"
        description={data.readiness ? `${data.readiness.roleTitle} readiness, measured by Orbit’s deterministic engine and explained by the agent.` : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardEyebrow>Career readiness history</CardEyebrow>
              <p className="mt-1 font-display text-[34px] font-bold leading-none">
                <AnimatedNumber value={current} decimals={1} />
                <span className="text-[18px] text-muted-foreground">%</span>
              </p>
            </div>
            {growth !== null && growth > 0 && (
              <Badge tone="green" className="text-[12.5px]">
                +{growth} points since you started
              </Badge>
            )}
          </div>
          <div className="mt-4 h-[260px]">
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0AB46A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0AB46A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="readinessStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0AB46A" />
                      <stop offset="100%" stopColor="#FB9002" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} stroke={axis} fontSize={11.5} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={[(min: number) => Math.max(0, Math.floor(min / 10) * 10 - 10), 100]} stroke={axis} fontSize={11.5} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }}
                    labelFormatter={(d) => format(new Date(d as string), 'd MMMM yyyy')}
                    formatter={(v: number) => [`${round1(v)}%`, 'Readiness']}
                  />
                  <Area type="monotone" dataKey="score" stroke="url(#readinessStroke)" strokeWidth={3} fill="url(#readinessFill)" dot={{ r: 3, fill: '#0AB46A', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Your readiness history will grow as you make progress.</div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <CardEyebrow>Readiness by category</CardEyebrow>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke={grid} />
                <PolarAngleAxis dataKey="category" tick={{ fill: axis, fontSize: 11 }} />
                <Radar dataKey="score" stroke="#0AB46A" fill="#0AB46A" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            {data.readiness?.breakdown.map((b) => (
              <ScoreBar key={b.category} label={`${b.label} · ${Math.round(b.weight * 100)}%`} value={b.score} tone={b.score < 55 ? 'orange' : 'green'} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Zap} label="Skills acquired" value={data.stats.skillsAcquired} />
        <StatTile icon={BriefcaseBusiness} label="Experiences" value={data.stats.experiences} tone="neutral" />
        <StatTile icon={Trophy} label="Quests completed" value={data.stats.questsCompleted} />
        <StatTile icon={Rocket} label="Applications" value={data.stats.applications} tone="orange" />
        <StatTile icon={MessagesSquare} label="Interviews" value={data.stats.interviews} tone="orange" />
        <StatTile icon={Award} label="Offers" value={data.stats.offers} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6">
          <CardEyebrow>Orbit level</CardEyebrow>
          <div className="mt-3 flex items-center gap-4">
            <div className="orbit-gradient flex size-16 items-center justify-center rounded-2xl font-display text-[24px] font-bold text-white">{data.level.level}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold tabular">{data.level.xp} Career XP</p>
              <p className="text-[12.5px] text-muted-foreground">{data.level.nextLevelXp - data.level.xp} XP to level {data.level.level + 1}</p>
              <Progress value={data.level.progress} tone="gradient" className="mt-2" label="Level progress" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Flame className="size-3.5 text-orange" /> Current streak
              </p>
              <p className="mt-1 font-display text-[20px] font-bold">{data.streak.current} days</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Medal className="size-3.5 text-green" /> Longest streak
              </p>
              <p className="mt-1 font-display text-[20px] font-bold">{data.streak.longest} days</p>
            </div>
          </div>
          {data.milestones.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-[13px] font-semibold">Milestones</p>
              {data.milestones.map((m) => (
                <div key={m.id}>
                  <div className="mb-1 flex justify-between text-[12.5px]">
                    <span className="truncate">{m.title}</span>
                    <span className="font-semibold tabular">{m.progress}%</span>
                  </div>
                  <Progress value={m.progress} className="h-1.5" label={m.title} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardEyebrow>Application funnel</CardEyebrow>
          <div className="mt-4 space-y-2.5">
            {data.applicationFunnel.map((f, i) => {
              const max = Math.max(1, data.applicationFunnel[0]?.count ?? 1);
              return (
                <div key={f.status}>
                  <div className="mb-1 flex justify-between text-[12.5px]">
                    <span>{APPLICATION_STATUS_LABELS[f.status]}</span>
                    <span className="font-semibold tabular">{f.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, background: i < 3 ? '#0AB46A' : '#FB9002', opacity: 1 - i * 0.08 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[13px] font-semibold">Skills acquired</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.skillsAcquired.length === 0 && <span className="text-[13px] text-muted-foreground">Complete skill quests to grow this list.</span>}
            {data.skillsAcquired.map((s) => (
              <Badge key={s.name} tone={s.source === 'QUEST' ? 'green' : 'neutral'}>
                {s.source === 'QUEST' && <GraduationCap />} {s.name} · {s.level}
              </Badge>
            ))}
          </div>
          {data.completedQuests.length > 0 && (
            <>
              <p className="mt-5 text-[13px] font-semibold">Completed quests</p>
              <ul className="mt-2 space-y-1.5">
                {data.completedQuests.slice(0, 5).map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0 text-green" />
                      <span className="truncate">{q.title}</span>
                    </span>
                    <span className="shrink-0 text-subtle-foreground">+{q.xp} XP</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="p-6">
          <CardEyebrow className="flex items-center gap-1.5">
            <UserRoundCheck className="size-3.5" /> Orbit timeline
          </CardEyebrow>
          <div className="mt-4 max-h-[520px] space-y-5 overflow-y-auto pr-1 scrollbar-thin">
            {grouped.length === 0 && <p className="text-[13px] text-muted-foreground">Your story starts with your first quest.</p>}
            {grouped.map(([month, items]) => (
              <div key={month}>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-green-strong dark:text-green">{month}</p>
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {items.map((t) => {
                    const Icon = TIMELINE_ICON[t.type] ?? Sparkles;
                    return (
                      <li key={t.id} className="relative">
                        <span className="absolute -left-[31px] top-0 flex size-5 items-center justify-center rounded-full border border-border bg-surface">
                          <Icon className="size-3 text-green" />
                        </span>
                        <p className="text-[13.5px] font-medium leading-snug">{t.title}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {format(new Date(t.date), 'd MMM')}
                          {t.description ? ` · ${t.description}` : ''}
                          {t.xp > 0 ? ` · +${t.xp} XP` : ''}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
