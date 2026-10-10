import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  GraduationCap,
  Maximize2,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { UNIVERSE_FILTERS, type GraphNodeView, type NodeDetail, type UniverseFilterId } from '@orbit/shared';
import { Button } from '@/components/ui/button';
import { Badge, Progress, Skeleton } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/overlays';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states';
import { useAddSkillToJourney, useNodeDetail, useRebuildUniverse, useUniverse } from '@/hooks/queries';
import { usePageContext, useIsDark, useUiStore } from '@/stores/ui';
import { NODE_STYLE, nodeColor, onNodeColor } from '@/lib/icons';
import { cn, relative } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useLabels } from '@/lib/i18n/labels';
import { UniverseGraph, type UniverseGraphHandle } from './UniverseGraph';


export default function UniversePage() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useUniverse();
  const rebuild = useRebuildUniverse();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<UniverseFilterId>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('node'));
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const graphRef = useRef<UniverseGraphHandle>(null);
  const dark = useIsDark();
  const { t, tn } = useT();
  const labels = useLabels();

  const selected = data?.nodes.find((n) => n.id === selectedId) ?? null;
  usePageContext({ page: 'universe', entityType: selected ? 'node' : undefined, entityId: selected?.id, label: selected?.label });

  useEffect(() => {
    const fromUrl = params.get('node');
    if (fromUrl && data?.nodes.some((n) => n.id === fromUrl)) {
      setSelectedId(fromUrl);
      setTimeout(() => graphRef.current?.focus(fromUrl), 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of UNIVERSE_FILTERS) c[f.id] = f.types.length ? (data?.nodes.filter((n) => (f.types as string[]).includes(n.type)).length ?? 0) : (data?.nodes.length ?? 0);
    return c;
  }, [data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return [];
    // Exact, then prefix, then substring — so Enter opens "Product Analytics" before "Product Analytics Workshop".
    const rank = (label: string) => (label === q ? 0 : label.startsWith(q) ? 1 : 2);
    return data.nodes
      .filter((n) => n.label.toLowerCase().includes(q))
      .sort((a, b) => rank(a.label.toLowerCase()) - rank(b.label.toLowerCase()) || a.label.length - b.label.length)
      .slice(0, 8);
  }, [query, data]);

  const select = (id: string | null) => {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    if (id) next.set('node', id);
    else next.delete('node');
    setParams(next, { replace: true });
  };

  const focusNode = (n: GraphNodeView) => {
    setFilter('ALL');
    select(n.id);
    setQuery('');
    setSearchOpen(false);
    setTimeout(() => graphRef.current?.focus(n.id), 50);
  };

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const gapCount = data?.nodes.filter((n) => n.type === 'GAP').length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-green-strong dark:text-green">{t('universe.eyebrow')}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[32px]">{t('universe.title')}</h1>
          {data && (
            <p className="mt-1 text-[14px] text-muted-foreground">
              {t('universe.stats', { nodes: data.nodes.length, edges: data.edges.length, gaps: tn('universe.gaps', gapCount) })}
              {data.updatedAt ? t('universe.updated', { time: relative(new Date(Math.max(new Date(data.updatedAt).getTime(), dataUpdatedAt - 1000)).toISOString()) }) : ''}
            </p>
          )}
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) focusNode(matches[0]);
            }}
            placeholder={t('universe.search')}
            aria-label={t('universe.searchLabel')}
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm shadow-[0_1px_2px_rgba(16,23,20,0.04)] outline-none focus:border-green focus:ring-4 focus:ring-[var(--ring)]"
          />
          {searchOpen && matches.length > 0 && (
            <ul className="absolute inset-x-0 top-12 z-20 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-pop" role="listbox">
              {matches.map((n) => (
                <li key={n.id}>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => focusNode(n)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: nodeColor(n.type, dark) }} />
                    <span className="flex-1 truncate">{n.label}</span>
                    <span className="text-xs text-subtle-foreground">{labels.nodeType(n.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin" role="tablist" aria-label={t('universe.filterLabel')}>
        {UNIVERSE_FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition',
              filter === f.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            {labels.filter(f.id, f.label)}
            <span className={cn('tabular text-[11.5px]', filter === f.id ? 'text-background/70' : 'text-subtle-foreground')}>{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="card relative h-[calc(100dvh-300px)] min-h-[460px] overflow-hidden lg:h-[calc(100dvh-268px)]">
        <div className="absolute inset-0 grid-dots opacity-60" aria-hidden />
        {isLoading || !data ? (
          <LoadingState label={t('universe.loading')} className="absolute inset-0" />
        ) : data.nodes.length <= 1 ? (
          <EmptyState
            icon={Network}
            title={t('universe.emptyTitle')}
            description={t('universe.emptyDesc')}
            action={
              <Button asChild>
                <Link to="/onboarding">{t('universe.startOnboarding')}</Link>
              </Button>
            }
          />
        ) : (
          <UniverseGraph ref={graphRef} data={data} filter={filter} selectedId={selectedId} onSelect={select} dark={dark} />
        )}

        {/* Controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-card backdrop-blur">
          <Tooltip content={t('universe.zoomIn')} side="right">
            <Button variant="ghost" size="icon-sm" onClick={() => graphRef.current?.zoomIn()} aria-label={t('universe.zoomIn')}>
              <Plus />
            </Button>
          </Tooltip>
          <Tooltip content={t('universe.zoomOut')} side="right">
            <Button variant="ghost" size="icon-sm" onClick={() => graphRef.current?.zoomOut()} aria-label={t('universe.zoomOut')}>
              <Minus />
            </Button>
          </Tooltip>
          <Tooltip content={t('universe.reset')} side="right">
            <Button variant="ghost" size="icon-sm" onClick={() => graphRef.current?.reset()} aria-label={t('universe.reset')}>
              <Maximize2 />
            </Button>
          </Tooltip>
          <Tooltip content={t('universe.refresh')} side="right">
            <Button variant="ghost" size="icon-sm" onClick={() => rebuild.mutate()} aria-label={t('universe.refreshLabel')} disabled={rebuild.isPending}>
              <RefreshCw className={cn(rebuild.isPending && 'animate-spin')} />
            </Button>
          </Tooltip>
        </div>

        {/* Interaction hint */}
        {data && data.nodes.length > 1 && !selectedId && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full border border-border bg-surface/90 px-3.5 py-1.5 text-[11.5px] text-muted-foreground shadow-card backdrop-blur md:block">
            {t('universe.hint')}
          </p>
        )}

        {/* Legend — hidden while the details drawer occupies the right side */}
        <div
          className={cn(
            'absolute right-4 top-4 hidden max-w-[220px] rounded-xl border border-border bg-surface/95 p-3 text-[11.5px] shadow-card backdrop-blur',
            selectedId ? 'md:hidden' : 'md:block',
          )}
        >
          <p className="mb-2 font-semibold text-muted-foreground">{t('universe.legend')}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {(['USER', 'CAREER_ROLE', 'SKILL', 'GAP', 'GOAL', 'QUEST', 'EXPERIENCE', 'OPPORTUNITY', 'EVENT', 'COURSE', 'BOOK', 'ROLE_MODEL'] as const).map((type) => (
              <span key={type} className="flex items-center gap-1.5 truncate">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: nodeColor(type, dark) }} />
                {labels.nodeType(type)}
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence>{selectedId && <NodePanel key={selectedId} nodeId={selectedId} onClose={() => select(null)} onFocus={focusNode} />}</AnimatePresence>
      </div>
    </div>
  );
}

function NodePanel({ nodeId, onClose, onFocus }: { nodeId: string; onClose: () => void; onFocus: (n: GraphNodeView) => void }) {
  const { data, isLoading, error } = useNodeDetail(nodeId);
  const { t } = useT();
  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-2 bottom-2 z-10 max-h-[72%] overflow-y-auto rounded-2xl border border-border bg-surface shadow-pop scrollbar-thin md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[380px]"
      aria-label={t('universe.nodeDetails')}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3 backdrop-blur">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('universe.details')}</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('universe.closeDetails')}>
          <X />
        </Button>
      </div>
      {error ? (
        <ErrorState error={error} />
      ) : isLoading || !data ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <NodeDetailBody detail={data} onFocus={onFocus} />
      )}
    </motion.aside>
  );
}

function NodeDetailBody({ detail, onFocus }: { detail: NodeDetail; onFocus: (n: GraphNodeView) => void }) {
  const { node, skill } = detail;
  const navigate = useNavigate();
  const openAgent = useUiStore((s) => s.openAgent);
  const addSkill = useAddSkillToJourney();
  const dark = useIsDark();
  const { t, tn } = useT();
  const labels = useLabels();
  const color = nodeColor(node.type, dark);
  const Icon = NODE_STYLE[node.type].icon;
  const grouped = useMemo(() => {
    const g = new Map<string, GraphNodeView[]>();
    for (const c of detail.connections) {
      const k = labels.relation(c.relationship);
      g.set(k, [...(g.get(k) ?? []), c.node]);
    }
    return [...g.entries()];
  }, [detail.connections, labels]);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: color, color: onNodeColor(color) }}>
          <Icon className="size-4" />
        </span>
        <Badge tone={node.type === 'GAP' ? 'orange' : node.type === 'SKILL' ? 'green' : 'neutral'}>{labels.nodeType(node.type)}</Badge>
        {node.source !== 'SYSTEM' && <Badge tone="outline">{node.source === 'AGENT' ? t('universe.addedByOrbit') : t('universe.addedByYou')}</Badge>}
      </div>
      <h2 className="mt-3 text-[22px] font-bold leading-tight">{node.label}</h2>
      {node.description && <p className="mt-1 text-[13.5px] text-muted-foreground">{node.description}</p>}

      {skill && (
        <div className="mt-5 space-y-4">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t('universe.currentLevel')}</dt>
              <dd className="mt-1 font-semibold">{labels.skillLevel(skill.currentLevel)}</dd>
              <dd className="text-[12px] tabular text-muted-foreground">{skill.currentLevel} / 100</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t('universe.requiredLevel')}</dt>
              <dd className="mt-1 font-semibold">{skill.requiredLevel != null ? labels.skillLevel(skill.requiredLevel) : '—'}</dd>
              <dd className="text-[12px] tabular text-muted-foreground">{skill.requiredLevel ?? '—'} / 100</dd>
            </div>
          </dl>
          {skill.requiredLevel && <Progress value={(skill.currentLevel / skill.requiredLevel) * 100} tone={skill.isGap ? 'orange' : 'green'} label={t('universe.progressToRequired')} />}
          <dl className="space-y-2.5 text-[13.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('universe.relatedCareer')}</dt>
              <dd className="font-medium">{skill.relatedCareer ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('universe.requiredBy')}</dt>
              <dd className="font-medium">
                {tn('universe.matchingJobs', skill.requiredByJobs)}
              </dd>
            </div>
          </dl>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t('universe.resources')}</p>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              {(
                [
                  { icon: GraduationCap, n: skill.resources.courses, l: 'universe.res.courses', tab: 'growth' },
                  { icon: BookOpen, n: skill.resources.books, l: 'universe.res.books', tab: 'knowledge' },
                  { icon: FileText, n: skill.resources.papers, l: 'universe.res.papers', tab: 'knowledge&kind=papers' },
                  { icon: CalendarDays, n: skill.resources.events, l: 'universe.res.events', tab: 'growth' },
                ] as const
              ).map((r) => (
                <Link key={r.l} to={`/app/discover?tab=${r.tab}`} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 hover:border-green">
                  <r.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="tabular font-semibold">{r.n}</span> <span className="truncate">{t(r.l)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {detail.recommendedAction && (
        <div className="mt-5 rounded-xl border border-green/30 bg-muted-green/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-green-strong dark:text-green">{t('universe.recommended')}</p>
          <p className="mt-1 font-semibold">{detail.recommendedAction.title}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{detail.recommendedAction.reason}</p>
          <p className="mt-1 text-[12.5px] font-medium text-green-strong dark:text-green">{detail.recommendedAction.expectedImpact}</p>
          <Button
            className="mt-3 w-full"
            loading={addSkill.isPending}
            onClick={() => {
              const a = detail.recommendedAction!;
              if (a.action?.type === 'ADD_SKILL_TO_JOURNEY') addSkill.mutate(String(a.action.payload.skillSlug));
              else navigate(a.actionUrl);
            }}
          >
            {detail.recommendedAction.actionLabel} <ArrowRight />
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {detail.link && (
          <Button variant="secondary" size="sm" onClick={() => navigate(detail.link!.url)}>
            {node.type === 'OPPORTUNITY' ? <BriefcaseBusiness /> : <ArrowRight />} {detail.link.label}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => openAgent(t('agent.prompt.whyNode', { label: node.label }))}>
          <BrainCircuit /> {t('common.askOrbit')}
        </Button>
      </div>

      {grouped.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{t('universe.connections', { count: detail.connections.length })}</p>
          <div className="space-y-3">
            {grouped.map(([rel, nodes]) => (
              <div key={rel}>
                <p className="mb-1 text-[12px] text-subtle-foreground">{rel}</p>
                <div className="flex flex-wrap gap-1.5">
                  {nodes.slice(0, 10).map((n) => (
                    <button key={n.id} onClick={() => onFocus(n)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] hover:border-green">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: nodeColor(n.type, dark) }} />
                      <span className="truncate">{n.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
