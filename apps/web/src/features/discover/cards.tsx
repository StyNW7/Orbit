import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  Bell,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  Plus,
  Quote,
  Route,
  Users,
} from 'lucide-react';
import {
  GROWTH_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  WORK_MODE_LABELS,
  type BookView,
  type GrowthItemView,
  type JobMatchView,
  type PaperView,
  type PersonView,
  type RecommendationWhy,
} from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/overlays';
import { MatchChip } from '@/components/common/MatchChip';
import {
  useAddCustomQuest,
  useAddSkillToJourney,
  useNotificationMutations,
  useSaveItem,
  useSaveJob,
  useSkillsCatalog,
  useUpdateSaved,
} from '@/hooks/queries';
import { cn, daysUntil, friendlyDate } from '@/lib/utils';

export function RelevanceBadge({ value }: { value: number }) {
  return (
    <Tooltip content="Deterministic relevance: gap overlap, career alignment and semantic similarity">
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold tabular',
          value >= 70 ? 'bg-muted-green text-green-strong dark:text-green' : value >= 45 ? 'bg-muted-orange text-orange-strong dark:text-orange' : 'bg-surface-2 text-muted-foreground',
        )}
      >
        {value}% relevant
      </span>
    </Tooltip>
  );
}

export function WhyBlock({ why }: { why: RecommendationWhy }) {
  return (
    <div className="mt-3 rounded-lg bg-surface-2/70 p-3 text-[12.5px]">
      <p className="text-foreground">
        <span className="font-semibold">Why Orbit recommends it · </span>
        <span className="text-muted-foreground">{why.whyItMatters}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {why.improvesSkill && <Badge tone="green">Improves {why.improvesSkill}</Badge>}
        {why.addressesGap && <Badge tone="orange">Closes gap: {why.addressesGap}</Badge>}
        {why.supportsGoal && <Badge tone="neutral">Supports {why.supportsGoal}</Badge>}
      </div>
    </div>
  );
}

function useSkillSlug() {
  const { data: skills = [] } = useSkillsCatalog();
  return (name: string | null | undefined) => (name ? skills.find((s) => s.name === name)?.slug ?? null : null);
}

function AddGapButton({ gap }: { gap: string | null }) {
  const slugOf = useSkillSlug();
  const add = useAddSkillToJourney();
  const slug = slugOf(gap);
  if (!slug) return null;
  return (
    <Button size="sm" variant="soft" onClick={() => add.mutate(slug)} loading={add.isPending}>
      <Route /> Add {gap} to Journey
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
export function JobCard({ job, highlight }: { job: JobMatchView; highlight?: boolean }) {
  const o = job.opportunity;
  const save = useSaveJob();
  const navigate = useNavigate();
  const days = daysUntil(o.deadline);
  return (
    <Card id={`item-${o.id}`} className={cn('flex flex-col p-5 transition hover:border-border-strong', highlight && 'border-green shadow-[0_0_0_4px_var(--ring)]')}>
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted-orange font-display text-[15px] font-bold text-orange-strong dark:text-orange">{o.company.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <Link to={`/app/discover/jobs/${o.id}`} className="block text-[16px] font-semibold leading-snug hover:text-green-strong dark:hover:text-green">
            {o.title}
          </Link>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{o.company}</p>
        </div>
        <MatchChip value={job.match.overall} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="neutral">{OPPORTUNITY_TYPE_LABELS[o.employmentType]}</Badge>
        <Badge tone="outline">
          <MapPin /> {o.location}
        </Badge>
        <Badge tone="outline">{WORK_MODE_LABELS[o.workMode]}</Badge>
        {days !== null && days >= 0 && (
          <Badge tone={days <= 7 ? 'orange' : 'outline'}>
            <Clock /> {days === 0 ? 'Closes today' : `Closes in ${days}d`}
          </Badge>
        )}
        {o.isDemo && <Badge tone="outline">Demo listing</Badge>}
      </div>
      {job.match.reasons.length > 0 && (
        <p className="mt-3 text-[13px]">
          <span className="font-semibold">Why you match: </span>
          <span className="text-muted-foreground">{job.match.reasons.slice(0, 3).join(' · ')}</span>
        </p>
      )}
      {job.match.missingSkills.length > 0 && (
        <p className="mt-1 text-[13px]">
          <span className="font-semibold">Missing: </span>
          <span className="text-muted-foreground">{job.match.missingSkills.slice(0, 3).map((m) => m.name).join(' · ')}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        {job.saved ? (
          <Button size="sm" variant="soft" onClick={() => navigate(job.applicationId ? `/app/discover/applications/${job.applicationId}` : '/app/discover/applications')}>
            <BookmarkCheck /> Tracking
          </Button>
        ) : (
          <Button size="sm" onClick={() => save.mutate(o.id)} loading={save.isPending}>
            <BookmarkPlus /> Save & track
          </Button>
        )}
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/app/discover/jobs/${o.id}`}>
            View match <ArrowRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------
export function GrowthCard({ item, highlight }: { item: GrowthItemView; highlight?: boolean }) {
  const save = useSaveItem();
  const update = useUpdateSaved();
  const { remind } = useNotificationMutations();
  const isEvent = item.kind === 'EVENT';
  const Icon = isEvent ? CalendarDays : GraduationCap;
  const remindAt = () => {
    if (isEvent && item.startsAt) return new Date(new Date(item.startsAt).getTime() - 60 * 60 * 1000);
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(19, 0, 0, 0);
    return d;
  };
  return (
    <Card id={`item-${item.id}`} className={cn('flex flex-col p-5', highlight && 'border-green shadow-[0_0_0_4px_var(--ring)]')}>
      <div className="flex items-start gap-3.5">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', isEvent ? 'bg-muted-orange text-orange-strong dark:text-orange' : 'bg-muted-green text-green-strong dark:text-green')}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={isEvent ? 'orange' : 'green'}>{GROWTH_TYPE_LABELS[item.type]}</Badge>
            {item.isDemo && <Badge tone="outline">Demo event</Badge>}
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold leading-snug">{item.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {item.provider}
            {item.startsAt ? ` · ${friendlyDate(item.startsAt, true)}` : ''}
            {item.durationHours ? ` · ${item.durationHours}h` : ''}
            {item.cost ? ` · ${item.cost}` : ''}
            {isEvent && item.location ? ` · ${item.isOnline ? 'Online' : item.location}` : ''}
          </p>
        </div>
        <RelevanceBadge value={item.relevance} />
      </div>
      <p className="mt-3 line-clamp-2 text-[13.5px] text-muted-foreground">{item.description}</p>
      <WhyBlock why={item.why} />
      {item.deadline && <p className="mt-2 text-[12.5px] font-medium text-orange-strong dark:text-orange">Register by {friendlyDate(item.deadline)}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {item.saved ? (
          item.saved.status === 'COMPLETED' ? (
            <Badge tone="green" className="h-8 px-3 text-[12.5px]">
              <CheckCircle2 /> Completed
            </Badge>
          ) : (
            <Button size="sm" variant="soft" onClick={() => update.mutate({ id: item.saved!.id, status: 'COMPLETED' })} loading={update.isPending}>
              <CheckCircle2 /> Mark {isEvent ? 'attended' : 'completed'}
            </Button>
          )
        ) : (
          <Button size="sm" onClick={() => save.mutate({ kind: item.kind === 'EVENT' ? 'EVENT' : 'RESOURCE', itemId: item.id })} loading={save.isPending}>
            <BookmarkPlus /> Save
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          loading={remind.isPending}
          onClick={() =>
            remind.mutate({
              title: isEvent ? `${item.title} starts soon` : `Continue ${item.title}`,
              message: `${item.provider}${item.startsAt ? ` · ${friendlyDate(item.startsAt, true)}` : ''}`,
              scheduledAt: remindAt().toISOString(),
              actionUrl: `/app/discover?tab=growth&focus=${item.id}`,
            })
          }
        >
          <Bell /> Remind me
        </Button>
        <AddGapButton gap={item.why.addressesGap} />
        {item.url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLink /> Open
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------
export function BookCard({ book, highlight }: { book: BookView; highlight?: boolean }) {
  const save = useSaveItem();
  const update = useUpdateSaved();
  return (
    <Card id={`item-${book.id}`} className={cn('flex gap-4 p-5', highlight && 'border-green shadow-[0_0_0_4px_var(--ring)]')}>
      <BookCover book={book} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold leading-snug">{book.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {book.authors.join(', ')}
              {book.publishedYear ? ` · ${book.publishedYear}` : ''}
            </p>
          </div>
          <RelevanceBadge value={book.relevance} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {book.level && <Badge tone="neutral">{book.level}</Badge>}
          {book.relatedCareer && <Badge tone="outline">{book.relatedCareer}</Badge>}
          {book.skills.slice(0, 2).map((s) => (
            <Badge key={s} tone="outline">
              {s}
            </Badge>
          ))}
        </div>
        <p className="mt-2 line-clamp-3 text-[13.5px] text-muted-foreground">{book.description}</p>
        <WhyBlock why={book.why} />
        <div className="mt-4 flex flex-wrap gap-2">
          {book.saved ? (
            book.saved.status === 'COMPLETED' ? (
              <Badge tone="green" className="h-8 px-3 text-[12.5px]">
                <CheckCircle2 /> Read
              </Badge>
            ) : (
              <Button size="sm" variant="soft" onClick={() => update.mutate({ id: book.saved!.id, status: 'COMPLETED' })} loading={update.isPending}>
                <CheckCircle2 /> Mark as read
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => save.mutate({ kind: 'BOOK', itemId: book.id })} loading={save.isPending}>
              <BookmarkPlus /> Save
            </Button>
          )}
          <AddGapButton gap={book.why.addressesGap} />
          {book.infoUrl && (
            <Button size="sm" variant="ghost" asChild>
              <a href={book.infoUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Details
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function BookCover({ book }: { book: BookView }) {
  const [failed, setFailed] = useState(false);
  if (book.coverUrl && !failed) {
    return <img src={book.coverUrl} alt="" onError={() => setFailed(true)} className="h-[120px] w-[82px] shrink-0 rounded-md object-cover shadow-card" loading="lazy" />;
  }
  const hue = [...book.title].reduce((s, c) => s + c.charCodeAt(0), 0) % 2;
  return (
    <div
      aria-hidden
      className={cn('flex h-[120px] w-[82px] shrink-0 flex-col justify-between rounded-md p-2.5 text-white shadow-card', hue ? 'bg-[linear-gradient(160deg,#0AB46A,#06784a)]' : 'bg-[linear-gradient(160deg,#FB9002,#c46f00)]')}
    >
      <BookOpen className="size-4 opacity-80" />
      <span className="line-clamp-4 text-[10px] font-bold leading-tight">{book.title}</span>
    </div>
  );
}

export function PaperCard({ paper, highlight }: { paper: PaperView; highlight?: boolean }) {
  const save = useSaveItem();
  const addQuest = useAddCustomQuest();
  const slugOf = useSkillSlug();
  const [expanded, setExpanded] = useState(false);
  return (
    <Card id={`item-${paper.id}`} className={cn('p-5', highlight && 'border-green shadow-[0_0_0_4px_var(--ring)]')}>
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[#3E7CB1]">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold leading-snug">{paper.title}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 ? ' et al.' : ''}
            {paper.year ? ` · ${paper.year}` : ''}
            {paper.venue ? ` · ${paper.venue}` : ''}
          </p>
        </div>
        <RelevanceBadge value={paper.relevance} />
      </div>
      <p className={cn('mt-3 text-[13.5px] text-muted-foreground', !expanded && 'line-clamp-3')}>{paper.abstract}</p>
      {paper.abstract.length > 220 && (
        <button className="mt-1 text-[12.5px] font-semibold text-green-strong dark:text-green" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Read summary'}
        </button>
      )}
      <WhyBlock why={paper.why} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="soft"
          loading={addQuest.isPending}
          onClick={() =>
            addQuest.mutate({
              title: `Read: ${paper.title.length > 70 ? `${paper.title.slice(0, 67)}…` : paper.title}`,
              description: paper.why.whyItMatters,
              category: 'KNOWLEDGE',
              skillSlug: slugOf(paper.why.improvesSkill) ?? undefined,
              tasks: ['Read the abstract and conclusion', 'Write down three takeaways in your journal', 'Connect one idea to your current quest'],
            })
          }
        >
          <Plus /> Add to Knowledge Journey
        </Button>
        {paper.saved ? (
          <Badge tone="green" className="h-8 px-3 text-[12.5px]">
            <BookmarkCheck /> Saved
          </Badge>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => save.mutate({ kind: 'PAPER', itemId: paper.id })} loading={save.isPending}>
            <BookmarkPlus /> Save
          </Button>
        )}
        {paper.url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={paper.url} target="_blank" rel="noreferrer">
              <ExternalLink /> Source
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
export function PersonCard({ person, highlight }: { person: PersonView; highlight?: boolean }) {
  const save = useSaveItem();
  const c = person.comparison;
  return (
    <Card id={`item-${person.id}`} className={cn('flex flex-col p-5', highlight && 'border-green shadow-[0_0_0_4px_var(--ring)]')}>
      <div className="flex items-start gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#efe9fb,#e2f7ec)] font-display text-[15px] font-bold text-[#6b4fc4] dark:bg-[linear-gradient(135deg,#2a2440,#173126)] dark:text-[#c3b1f2]">
          {person.name
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={person.kind === 'MENTOR' ? 'green' : 'neutral'}>
              <Users /> {person.kind === 'MENTOR' ? 'Mentor' : 'Role model'}
            </Badge>
            {person.isDemo && <Badge tone="outline">Demo profile</Badge>}
          </div>
          <h3 className="mt-1.5 text-[16px] font-semibold leading-snug">{person.name}</h3>
          <p className="text-[13px] text-muted-foreground">{person.headline}</p>
        </div>
        <RelevanceBadge value={person.relevance} />
      </div>
      <p className="mt-3 text-[13.5px] text-muted-foreground">{person.careerSummary}</p>
      {person.careerTransitions.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-l-2 border-border pl-3.5">
          {person.careerTransitions.map((t) => (
            <li key={`${t.period}-${t.title}`} className="relative text-[12.5px]">
              <span className="absolute -left-[19px] top-1.5 size-2 rounded-full bg-green" />
              <span className="font-semibold">{t.title}</span> <span className="text-muted-foreground">· {t.organization}</span>
              <span className="ml-1 text-subtle-foreground">({t.period})</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 grid gap-3 rounded-xl bg-surface-2/70 p-3.5 text-[12.5px] sm:grid-cols-2">
        <Compare title="Similarities" items={c.similarities} tone="green" />
        <Compare title="Differences" items={c.differences} tone="orange" />
        <div className="sm:col-span-2">
          <p className="flex gap-2 text-[13px] font-medium">
            <Quote className="size-4 shrink-0 text-green" /> {c.insight}
          </p>
          <p className="mt-1.5 text-muted-foreground">
            <span className="font-semibold text-foreground">Recommended action: </span>
            {c.recommendedAction}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {person.saved ? (
          <Badge tone="green" className="h-8 px-3 text-[12.5px]">
            <BookmarkCheck /> Following
          </Badge>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => save.mutate({ kind: 'ROLE_MODEL', itemId: person.id })} loading={save.isPending}>
            <BookmarkPlus /> {person.kind === 'MENTOR' ? 'Save mentor' : 'Follow path'}
          </Button>
        )}
        {person.publicSources.map((s) => (
          <Button key={s.url} size="sm" variant="ghost" asChild>
            <a href={s.url} target="_blank" rel="noreferrer">
              <ExternalLink /> {s.label}
            </a>
          </Button>
        ))}
        {person.availability && <span className="self-center text-[12px] text-muted-foreground">{person.availability}</span>}
      </div>
    </Card>
  );
}

function Compare({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'orange' }) {
  return (
    <div>
      <p className="mb-1.5 font-semibold">{title}</p>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn('size-1.5 rounded-full', tone === 'green' ? 'bg-green' : 'bg-orange')} />
              {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}

export function HighlightTile({ icon: Icon, label, title, subtitle, to, tone = 'green', children }: { icon: typeof BriefcaseBusiness; label: string; title: string; subtitle: string; to: string; tone?: 'green' | 'orange' | 'neutral'; children?: ReactNode }) {
  return (
    <Link to={to} className="card group flex min-w-[220px] flex-1 flex-col p-4 transition hover:-translate-y-0.5 hover:border-border-strong">
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span className={cn('flex size-6 items-center justify-center rounded-md', tone === 'green' ? 'bg-muted-green text-green' : tone === 'orange' ? 'bg-muted-orange text-orange' : 'bg-surface-2 text-muted-foreground')}>
          <Icon className="size-3.5" />
        </span>
        {label}
      </span>
      <span className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug group-hover:text-green-strong dark:group-hover:text-green">{title}</span>
      <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted-foreground">{subtitle}</span>
      {children}
    </Link>
  );
}
