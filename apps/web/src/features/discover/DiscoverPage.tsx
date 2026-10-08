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
import {
  OPPORTUNITY_TYPE_LABELS,
  WORK_MODE_LABELS,
  type DiscoverTab,
  type OpportunityType,
  type WorkMode,
} from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Card, Input } from '@/components/ui/primitives';
import { Select, Tabs, TabsList, TabsTrigger } from '@/components/ui/form-controls';
import { CardSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/common/states';
import { useApplications, useBooks, useGrowth, useHighlights, useJobs, usePapers, usePeople, useRefreshJobs } from '@/hooks/queries';
import { usePageContext } from '@/stores/ui';
import { cn, friendlyDate } from '@/lib/utils';
import { BookCard, GrowthCard, HighlightTile, JobCard, PaperCard, PersonCard } from './cards';

const TABS: { id: DiscoverTab; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { id: 'growth', label: 'Growth', icon: GraduationCap },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'people', label: 'People', icon: Users },
];

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as DiscoverTab) || 'jobs';
  const focus = params.get('focus');
  usePageContext({ page: 'discover', label: TABS.find((t) => t.id === tab)?.label });
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
        eyebrow="Opportunity Intelligence"
        title="Discover what fits"
        description="Every recommendation is ranked against your goal and gaps — and Orbit explains why."
        actions={
          <Button variant="secondary" asChild>
            <Link to="/app/discover/applications">
              <FolderKanban /> My applications
              {apps.length > 0 && <span className="rounded-md bg-surface-2 px-1.5 text-xs tabular">{apps.length}</span>}
            </Link>
          </Button>
        }
      />
      <Highlights />
      <Tabs value={tab} onValueChange={setTab} className="mb-5 mt-7">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              <t.icon /> {t.label}
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
  if (!data) return null;
  const tiles = [
    data.internship && { icon: BriefcaseBusiness, label: 'Internship', title: data.internship.opportunity.title, subtitle: `${data.internship.opportunity.company} · ${data.internship.match.overall}% match`, to: `/app/discover/jobs/${data.internship.opportunity.id}`, tone: 'orange' as const },
    data.event && { icon: CalendarDays, label: 'Event', title: data.event.title, subtitle: `${friendlyDate(data.event.startsAt, true)} · ${data.event.provider}`, to: `/app/discover?tab=growth&focus=${data.event.id}`, tone: 'orange' as const },
    data.book && { icon: BookOpen, label: 'Book', title: data.book.title, subtitle: data.book.authors.join(', '), to: `/app/discover?tab=knowledge&focus=${data.book.id}`, tone: 'green' as const },
    data.paper && { icon: FileText, label: 'Paper', title: data.paper.title, subtitle: `${data.paper.authors[0] ?? ''}${data.paper.year ? ` · ${data.paper.year}` : ''}`, to: `/app/discover?tab=knowledge&focus=${data.paper.id}&kind=papers`, tone: 'neutral' as const },
    data.person && { icon: Users, label: 'Role model', title: data.person.name, subtitle: data.person.headline, to: `/app/discover?tab=people&focus=${data.person.id}`, tone: 'neutral' as const },
  ].filter(Boolean) as Parameters<typeof HighlightTile>[0][];
  if (!tiles.length) return null;
  return (
    <section aria-label="Top picks">
      <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
        <Sparkles className="size-4 text-orange" /> Top picks{data.focusGap ? ` for your ${data.focusGap} gap` : ' for you'}
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
        {tiles.map((t) => (
          <HighlightTile key={t.label} {...t} />
        ))}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
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
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'INTERNSHIP', 'FULL_TIME', 'GRADUATE_PROGRAM', 'PART_TIME'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn('h-9 rounded-full border px-3.5 text-[13px] font-medium transition', type === t ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground')}
            >
              {t === 'ALL' ? 'All' : OPPORTUNITY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <div className="relative min-w-0 flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles or companies" className="pl-9" aria-label="Search jobs" />
          </div>
          <Select
            className="w-[140px]"
            value={workMode}
            onValueChange={(v) => setWorkMode(v as WorkMode | 'ALL')}
            label="Work mode"
            options={[{ value: 'ALL', label: 'Any mode' }, ...(['ONSITE', 'HYBRID', 'REMOTE'] as const).map((m) => ({ value: m, label: WORK_MODE_LABELS[m] }))]}
          />
          <Button variant="secondary" size="icon" onClick={() => refresh.mutate()} disabled={refresh.isPending} aria-label="Refresh opportunities from providers" title="Fetch new jobs from public providers">
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
          <EmptyState icon={Telescope} title="We’re still mapping opportunities that match your Orbit." description="Try another filter or refresh opportunities from public providers." />
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

const GROWTH_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'COURSE', label: 'Courses' },
  { value: 'CERTIFICATION', label: 'Certifications' },
  { value: 'WORKSHOP', label: 'Workshops' },
  { value: 'SEMINAR', label: 'Seminars' },
  { value: 'HACKATHON', label: 'Hackathons' },
  { value: 'COMPETITION', label: 'Competitions' },
  { value: 'BOOTCAMP', label: 'Bootcamps' },
  { value: 'CAREER_EVENT', label: 'Career events' },
];

function GrowthTab({ focus }: { focus: string | null }) {
  const [type, setType] = useState('ALL');
  const { data, isLoading, error, refetch } = useGrowth(type === 'ALL' ? undefined : type);
  return (
    <div>
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {GROWTH_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setType(f.value)}
            className={cn('h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition', type === f.value ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground')}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={GraduationCap} title="Nothing scheduled in this category yet." description="Orbit keeps mapping courses and events to your gaps." />
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
              {k === 'books' ? 'Books' : 'Research papers'}
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'books' ? 'Search Google Books & Open Library' : 'Search OpenAlex & Semantic Scholar'} className="pl-9" aria-label={`Search ${kind}`} />
          </div>
          <Button type="submit" variant="secondary" loading={active.isFetching && Boolean(submitted)}>
            Search
          </Button>
        </form>
      </div>
      {submitted && <p className="mb-3 text-[13px] text-muted-foreground">Results for “{submitted}”, ranked by relevance to your career.</p>}
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
            <EmptyState icon={BookOpen} title="No books found" description="Try a skill name such as “product analytics” or “SQL”." />
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
          <EmptyState icon={FileText} title="No papers connected to your path yet" description="Orbit only recommends papers that connect to your target career, gaps or interests." />
        </Card>
      )}
    </div>
  );
}

function PeopleTab({ focus }: { focus: string | null }) {
  const [kind, setKind] = useState<'ALL' | 'ROLE_MODEL' | 'MENTOR'>('ALL');
  const { data, isLoading, error, refetch } = usePeople(kind === 'ALL' ? undefined : kind);
  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {(['ALL', 'ROLE_MODEL', 'MENTOR'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn('h-9 rounded-full border px-3.5 text-[13px] font-medium transition', kind === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground')}
          >
            {k === 'ALL' ? 'All' : k === 'ROLE_MODEL' ? 'Role models' : 'Mentors'}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Loading />
      ) : (
        <Grid>
          {data?.map((p) => (
            <PersonCard key={p.id} person={p} highlight={p.id === focus} />
          ))}
        </Grid>
      )}
    </div>
  );
}
