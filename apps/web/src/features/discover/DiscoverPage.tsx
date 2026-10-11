import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  FolderKanban,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles,
  Telescope,
  Users,
} from 'lucide-react';
import type { DiscoverTab, OpportunityType, WorkMode } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Card, Input } from '@/components/ui/primitives';
import { Select, Tabs, TabsList, TabsTrigger } from '@/components/ui/form-controls';
import { CardSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/common/states';
import { useApplications, useBooks, useGrowth, useHighlights, useJobs, usePapers, usePeople, useRefreshJobs } from '@/hooks/queries';
import { usePageContext } from '@/stores/ui';
import { cn, friendlyDate } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { BookCard, GrowthCard, HighlightTile, JobCard, PaperCard, PersonCard } from './cards';

const TABS: { id: DiscoverTab; label: MessageKey; icon: typeof BriefcaseBusiness }[] = [
  { id: 'jobs', label: 'discover.tab.jobs', icon: BriefcaseBusiness },
  { id: 'growth', label: 'discover.tab.growth', icon: GraduationCap },
  { id: 'knowledge', label: 'discover.tab.knowledge', icon: BookOpen },
  { id: 'people', label: 'discover.tab.people', icon: Users },
];

const pill = (active: boolean) =>
  cn('h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition', active ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground');

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as DiscoverTab) || 'jobs';
  const focus = params.get('focus');
  const { t } = useT();
  const tabDef = TABS.find((x) => x.id === tab);
  usePageContext({ page: 'discover', label: tabDef ? t(tabDef.label) : undefined });
  const { data: apps = [] } = useApplications();

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => document.getElementById(`item-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    return () => clearTimeout(t);
  }, [focus, tab]);

  const setTab = (t: string) => setParams({ tab: t }, { replace: true });

  return (
    <div>
      <PageHeader
        eyebrow={t('discover.eyebrow')}
        title={t('discover.title')}
        description={t('discover.desc')}
        actions={
          <Button variant="secondary" asChild>
            <Link to="/app/discover/applications">
              <FolderKanban /> {t('discover.myApps')}
              {apps.length > 0 && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular">{apps.length}</span>}
            </Link>
          </Button>
        }
      />
      <Highlights />
      <Tabs value={tab} onValueChange={setTab} className="mb-5 mt-7">
        <TabsList className="no-scrollbar w-full justify-start overflow-x-auto overflow-y-hidden sm:w-auto">
          {TABS.map((tb) => (
            <TabsTrigger key={tb.id} value={tb.id}>
              <tb.icon /> {t(tb.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === 'jobs' && <JobsTab focus={focus} />}
      {tab === 'growth' && <GrowthTab focus={focus} />}
      {tab === 'knowledge' && <KnowledgeTab focus={focus} />}
      {tab === 'people' && <PeopleTab focus={focus} />}
    </div>
  );
}

function Highlights() {
  const { data } = useHighlights();
  const { t } = useT();
  if (!data) return null;
  const tiles = [
    data.internship && { icon: BriefcaseBusiness, label: t('discover.hl.internship'), title: data.internship.opportunity.title, subtitle: `${data.internship.opportunity.company} · ${t('common.match', { value: data.internship.match.overall })}`, to: `/app/discover/jobs/${data.internship.opportunity.id}`, tone: 'orange' as const },
    data.event && { icon: CalendarDays, label: t('discover.hl.event'), title: data.event.title, subtitle: `${friendlyDate(data.event.startsAt, true)} · ${data.event.provider}`, to: `/app/discover?tab=growth&focus=${data.event.id}`, tone: 'orange' as const },
    data.book && { icon: BookOpen, label: t('discover.hl.book'), title: data.book.title, subtitle: data.book.authors.join(', '), to: `/app/discover?tab=knowledge&focus=${data.book.id}`, tone: 'green' as const },
    data.paper && { icon: FileText, label: t('discover.hl.paper'), title: data.paper.title, subtitle: `${data.paper.authors[0] ?? ''}${data.paper.year ? ` · ${data.paper.year}` : ''}`, to: `/app/discover?tab=knowledge&focus=${data.paper.id}&kind=papers`, tone: 'neutral' as const },
    data.person && { icon: Users, label: t('discover.hl.roleModel'), title: data.person.name, subtitle: data.person.headline, to: `/app/discover?tab=people&focus=${data.person.id}`, tone: 'neutral' as const },
  ].filter(Boolean) as Parameters<typeof HighlightTile>[0][];
  if (!tiles.length) return null;
  return (
    <section aria-label={t('discover.topPicksLabel')}>
      <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
        <Sparkles className="size-4 text-orange" /> {data.focusGap ? t('discover.topPicksGap', { gap: data.focusGap }) : t('discover.topPicks')}
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
        {tiles.map((tile) => (
          <HighlightTile key={tile.label} {...tile} />
        ))}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
}

function Loading() {
  return (
    <Grid>
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} lines={4} />
      ))}
    </Grid>
  );
}

function JobsTab({ focus }: { focus: string | null }) {
  const [type, setType] = useState<OpportunityType | 'ALL'>('ALL');
  const [workMode, setWorkMode] = useState<WorkMode | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isLoading, error, refetch, isFetching } = useJobs({ type: type === 'ALL' ? undefined : type, workMode: workMode === 'ALL' ? undefined : workMode, q: debounced || undefined });
  const refresh = useRefreshJobs();
  const { t } = useT();
  const labels = useLabels();
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'INTERNSHIP', 'FULL_TIME', 'GRADUATE_PROGRAM', 'PART_TIME'] as const).map((ot) => (
            <button key={ot} onClick={() => setType(ot)} className={pill(type === ot)} aria-pressed={type === ot}>
              {ot === 'ALL' ? t('common.all') : labels.oppType(ot)}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <div className="relative min-w-0 flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('discover.searchJobs')} className="pl-9" aria-label={t('discover.searchJobsLabel')} />
          </div>
          <Select
            className="w-[150px]"
            value={workMode}
            onValueChange={(v) => setWorkMode(v as WorkMode | 'ALL')}
            label={t('discover.workMode')}
            options={[{ value: 'ALL', label: t('discover.anyMode') }, ...(['ONSITE', 'HYBRID', 'REMOTE'] as const).map((m) => ({ value: m, label: labels.workMode(m) }))]}
          />
          <Button variant="secondary" size="icon" onClick={() => refresh.mutate()} disabled={refresh.isPending} aria-label={t('discover.refresh')} title={t('discover.refreshTitle')}>
            <RefreshCw className={cn(refresh.isPending && 'animate-spin')} />
          </Button>
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={Telescope} title={t('discover.jobsEmpty')} description={t('discover.jobsEmptyDesc')} />
        </Card>
      ) : (
        <div className={cn('transition-opacity', isFetching && 'opacity-70')}>
          <Grid>
            {data.map((j) => (
              <JobCard key={j.opportunity.id} job={j} highlight={j.opportunity.id === focus} />
            ))}
          </Grid>
        </div>
      )}
    </div>
  );
}

const GROWTH_FILTERS = ['ALL', 'COURSE', 'CERTIFICATION', 'WORKSHOP', 'SEMINAR', 'HACKATHON', 'COMPETITION', 'BOOTCAMP', 'CAREER_EVENT'] as const;

function GrowthTab({ focus }: { focus: string | null }) {
  const [type, setType] = useState('ALL');
  const { data, isLoading, error, refetch } = useGrowth(type === 'ALL' ? undefined : type);
  const { t } = useT();
  return (
    <div>
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {GROWTH_FILTERS.map((f) => (
          <button key={f} onClick={() => setType(f)} className={pill(type === f)} aria-pressed={type === f}>
            {f === 'ALL' ? t('common.all') : t(`discover.growth.${f}` as MessageKey)}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={GraduationCap} title={t('discover.growthEmpty')} description={t('discover.growthEmptyDesc')} />
        </Card>
      ) : (
        <Grid>
          {data.map((g) => (
            <GrowthCard key={`${g.kind}-${g.id}`} item={g} highlight={g.id === focus} />
          ))}
        </Grid>
      )}
    </div>
  );
}

function KnowledgeTab({ focus }: { focus: string | null }) {
  const [params] = useSearchParams();
  const [kind, setKind] = useState<'books' | 'papers'>(params.get('kind') === 'papers' ? 'papers' : 'books');
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState<string | undefined>();
  const books = useBooks(kind === 'books' ? submitted : undefined);
  const papers = usePapers(kind === 'papers' ? submitted : undefined);
  const active = kind === 'books' ? books : papers;
  const { t } = useT();
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
          {(['books', 'papers'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setSubmitted(undefined);
                setQ('');
              }}
              className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition', kind === k ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {k === 'books' ? <BookOpen className="size-4" /> : <FileText className="size-4" />}
              {k === 'books' ? t('discover.books') : t('discover.papers')}
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 gap-2 sm:justify-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim() || undefined);
          }}
        >
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'books' ? t('discover.searchBooks') : t('discover.searchPapers')} className="pl-9" aria-label={t('discover.searchKind', { kind: kind === 'books' ? t('discover.books') : t('discover.papers') })} maxLength={120} />
          </div>
          <Button type="submit" variant="secondary" loading={active.isFetching && Boolean(submitted)}>
            {t('common.search')}
          </Button>
        </form>
      </div>
      {submitted && <p className="mb-3 text-[13px] text-muted-foreground">{t('discover.results', { query: submitted })}</p>}
      {active.error ? (
        <ErrorState error={active.error} onRetry={() => void active.refetch()} />
      ) : active.isLoading ? (
        <Loading />
      ) : kind === 'books' ? (
        books.data?.length ? (
          <Grid>
            {books.data.map((b) => (
              <BookCard key={b.id} book={b} highlight={b.id === focus} />
            ))}
          </Grid>
        ) : (
          <Card>
            <EmptyState icon={BookOpen} title={t('discover.booksEmpty')} description={t('discover.booksEmptyDesc')} />
          </Card>
        )
      ) : papers.data?.length ? (
        <div className="space-y-4">
          {papers.data.map((p) => (
            <PaperCard key={p.id} paper={p} highlight={p.id === focus} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={FileText} title={t('discover.papersEmpty')} description={t('discover.papersEmptyDesc')} />
        </Card>
      )}
    </div>
  );
}

function PeopleTab({ focus }: { focus: string | null }) {
  const [kind, setKind] = useState<'ALL' | 'ROLE_MODEL' | 'MENTOR'>('ALL');
  const { data, isLoading, error, refetch } = usePeople(kind === 'ALL' ? undefined : kind);
  const { t } = useT();
  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {(['ALL', 'ROLE_MODEL', 'MENTOR'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={pill(kind === k)} aria-pressed={kind === k}>
            {k === 'ALL' ? t('common.all') : t(`discover.people.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={Users} title={t('discover.peopleEmpty')} description={t('discover.peopleEmptyDesc')} />
        </Card>
      ) : (
        <Grid>
          {data.map((p) => (
            <PersonCard key={p.id} person={p} highlight={p.id === focus} />
          ))}
        </Grid>
      )}
    </div>
  );
}
