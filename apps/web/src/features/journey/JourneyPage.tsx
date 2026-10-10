import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BookMarked, Check, Map, Orbit as OrbitIcon, Plus, Route, Sparkles, Wand2 } from 'lucide-react';
import type { JourneyDetail, MilestoneView } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card, Input, Label, Progress, Textarea } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/form-controls';
import { CardSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/common/states';
import { useAddCustomQuest, useBuildJourney, usePrimaryJourney } from '@/hooks/queries';
import { usePageContext } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { JourneyFlow } from './JourneyFlow';
import { QuestCard } from './QuestCard';
import { JournalView } from './JournalView';
import { OrbitsView } from './OrbitsView';

type View = 'roadmap' | 'journal' | 'orbits';

export default function JourneyPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'roadmap';
  const { t } = useT();
  usePageContext({ page: 'journey', label: view === 'journal' ? t('journey.ctx.journal') : view === 'orbits' ? t('journey.ctx.orbits') : undefined });
  const setView = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('view', v);
    next.delete('quest');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow={t('journey.eyebrow')} title={t('journey.title')} description={t('journey.desc')} />
      <Tabs value={view} onValueChange={setView} className="mb-5">
        <TabsList>
          <TabsTrigger value="roadmap">
            <Map /> {t('journey.tab.roadmap')}
          </TabsTrigger>
          <TabsTrigger value="journal">
            <BookMarked /> {t('journey.tab.journal')}
          </TabsTrigger>
          <TabsTrigger value="orbits">
            <OrbitIcon /> {t('journey.tab.orbits')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'journal' ? <JournalView /> : view === 'orbits' ? <OrbitsView /> : <Roadmap questParam={params.get('quest')} milestoneParam={params.get('milestone')} />}
    </div>
  );
}

function Roadmap({ questParam, milestoneParam }: { questParam: string | null; milestoneParam: string | null }) {
  const { data: journey, isLoading, error, refetch } = usePrimaryJourney();
  const build = useBuildJourney();
  const { t } = useT();

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading) return <CardSkeleton lines={6} />;
  if (!journey) {
    return (
      <Card>
        <EmptyState
          icon={Route}
          title={t('journey.emptyTitle')}
          description={t('journey.emptyDesc')}
          action={
            <Button size="lg" variant="gradient" onClick={() => build.mutate(undefined)} loading={build.isPending}>
              <Wand2 /> {t('journey.generate')}
            </Button>
          }
        />
      </Card>
    );
  }
  return <JourneyBody journey={journey} questParam={questParam} milestoneParam={milestoneParam} />;
}

function JourneyBody({ journey, questParam, milestoneParam }: { journey: JourneyDetail; questParam: string | null; milestoneParam: string | null }) {
  const build = useBuildJourney();
  const { t } = useT();
  const labels = useLabels();
  const [customOpen, setCustomOpen] = useState(false);
  const initial = useMemo(() => {
    if (questParam) return journey.milestones.find((m) => m.quests.some((q) => q.id === questParam))?.id;
    if (milestoneParam) return journey.milestones.find((m) => m.id === milestoneParam)?.id;
    return (journey.milestones.find((m) => m.status === 'IN_PROGRESS') ?? journey.milestones.find((m) => m.status !== 'COMPLETED') ?? journey.milestones[0])?.id;
  }, [journey.milestones, questParam, milestoneParam]);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial);
  useEffect(() => setSelectedId(initial), [initial]);
  useEffect(() => {
    if (questParam) setTimeout(() => document.getElementById(`quest-${questParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [questParam]);
  const selected: MilestoneView | undefined = journey.milestones.find((m) => m.id === selectedId) ?? journey.milestones[0];
  const questCount = journey.milestones.reduce((s, m) => s + m.quests.length, 0);
  const completed = journey.milestones.reduce((s, m) => s + m.quests.filter((q) => q.status === 'COMPLETED').length, 0);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-bold">{journey.title}</h2>
              <Badge tone="green">{t('journey.primary')}</Badge>
            </div>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {t('journey.summary', { done: completed, total: questCount, earned: journey.earnedXp, xp: journey.totalXp })}
              {journey.goal.readiness !== null ? t('journey.readyPct', { score: Math.round(journey.goal.readiness) }) : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-40">
              <div className="mb-1 flex justify-between text-[12px] text-muted-foreground">
                <span>{t('journey.progress')}</span>
                <span className="font-semibold tabular text-foreground">{journey.progress}%</span>
              </div>
              <Progress value={journey.progress} tone="gradient" label={t('journey.progress')} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setCustomOpen(true)}>
              <Plus /> {t('journey.addQuest')}
            </Button>
          </div>
        </div>
        {journey.canExpand && (
          <div className="flex flex-col gap-3 border-b border-border bg-muted-green/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[13.5px]">
              <Sparkles className="size-4 shrink-0 text-green" /> {t('journey.canExpand')}
            </p>
            <Button size="sm" onClick={() => build.mutate(undefined)} loading={build.isPending}>
              {t('journey.generateFull')}
            </Button>
          </div>
        )}
        <div className="hidden bg-surface-2/40 md:block">
          <JourneyFlow milestones={journey.milestones} selectedId={selected?.id ?? null} onSelect={setSelectedId} roleTitle={journey.goal.role.title} readiness={journey.goal.readiness} />
        </div>
        {/* Mobile milestone stepper */}
        <ol className="space-y-1 p-3 md:hidden">
          {journey.milestones.map((m, i) => (
            <li key={m.id}>
              <button
                onClick={() => setSelectedId(m.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', selected?.id === m.id ? 'bg-muted-green' : 'hover:bg-surface-2')}
              >
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', m.status === 'COMPLETED' ? 'bg-green text-white' : 'border border-border bg-surface')}>
                  {m.status === 'COMPLETED' ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{m.title}</span>
                  <Progress value={m.progress} className="mt-1 h-1" />
                </span>
                <span className="text-[12px] font-semibold tabular text-muted-foreground">{m.progress}%</span>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {selected && (
        <section aria-label={t('journey.quests', { title: selected.title })}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('journey.milestone')}</p>
              <h3 className="text-[20px] font-bold">{selected.title}</h3>
              {selected.description && <p className="text-[14px] text-muted-foreground">{selected.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {selected.impact && <Badge tone="neutral">{t('journey.improves', { category: labels.readiness(selected.impact) })}</Badge>}
              <Badge tone={selected.status === 'COMPLETED' ? 'green' : selected.status === 'IN_PROGRESS' ? 'orange' : 'outline'}>
                {t(`journey.status.${selected.status}` as MessageKey)} · {selected.progress}%
              </Badge>
            </div>
          </div>
          <div className="space-y-3">
            {selected.quests.map((q) => (
              <QuestCard key={q.id} quest={q} defaultOpen={q.id === questParam || (selected.quests.length === 1 && q.status !== 'COMPLETED')} />
            ))}
          </div>
        </section>
      )}

      <CustomQuestDialog open={customOpen} onOpenChange={setCustomOpen} />
    </div>
  );
}

function CustomQuestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const add = useAddCustomQuest();
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState('');
  const list = tasks
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('journey.custom.title')} description={t('journey.custom.desc')}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cq-title">{t('journey.custom.titleLabel')}</Label>
            <Input id="cq-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('journey.custom.titlePlaceholder')} maxLength={140} />
          </div>
          <div>
            <Label htmlFor="cq-desc">{t('journey.custom.why')}</Label>
            <Textarea id="cq-desc" className="mt-1.5" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cq-tasks">{t('journey.custom.tasks')}</Label>
            <Textarea id="cq-tasks" className="mt-1.5" rows={4} value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder={t('journey.custom.tasksPlaceholder')} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={title.trim().length < 3 || list.length === 0}
            loading={add.isPending}
            onClick={() =>
              add.mutate(
                { title: title.trim(), description: description.trim() || title.trim(), tasks: list.slice(0, 12) },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    setTitle('');
                    setDescription('');
                    setTasks('');
                  },
                },
              )
            }
          >
            {t('journey.custom.add')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
