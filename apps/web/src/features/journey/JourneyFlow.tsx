import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Flag, Lock, Route } from 'lucide-react';
import type { MilestoneView } from '@orbit/shared';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

const HANDLE = '!size-2 !border-0 !bg-transparent';
const SIDES = [
  ['l', Position.Left],
  ['r', Position.Right],
  ['t', Position.Top],
  ['b', Position.Bottom],
] as const;

/** Every node can connect on any side, so the roadmap can snake across rows. */
function Handles() {
  return (
    <>
      {SIDES.map(([id, pos]) => (
        <Handle key={`s-${id}`} id={`s-${id}`} type="source" position={pos} className={HANDLE} />
      ))}
      {SIDES.map(([id, pos]) => (
        <Handle key={`t-${id}`} id={`t-${id}`} type="target" position={pos} className={HANDLE} />
      ))}
    </>
  );
}

const COL_GAP = 236;
const ROW_GAP = 132;

/** Serpentine grid: row 0 runs left→right, row 1 right→left, and so on. */
function cell(index: number, cols: number): { col: number; row: number } {
  const row = Math.floor(index / cols);
  const pos = index % cols;
  return { row, col: row % 2 === 0 ? pos : cols - 1 - pos };
}

type MilestoneNodeData = { milestone: MilestoneView; selected: boolean; index: number; isNext: boolean };

const MilestoneNode = memo(function MilestoneNode({ data }: NodeProps<Node<MilestoneNodeData>>) {
  const m = data.milestone;
  const { t, tn } = useT();
  const done = m.status === 'COMPLETED';
  const active = m.status === 'IN_PROGRESS' || data.isNext;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn(
        'w-[188px] cursor-pointer rounded-2xl border bg-surface p-3.5 text-left shadow-card transition',
        data.selected ? 'border-green shadow-[0_0_0_4px_var(--ring)]' : 'border-border hover:border-border-strong',
      )}
    >
      <Handles />
      <div className="flex items-center gap-3">
        <div className="relative size-11 shrink-0">
          <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
            <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
            <circle cx="22" cy="22" r={r} fill="none" stroke={done ? '#0AB46A' : active ? '#FB9002' : 'var(--border-strong)'} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (m.progress / 100) * c} />
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center', done ? 'text-green' : active ? 'text-orange' : 'text-subtle-foreground')}>
            {done ? <Check className="size-4" strokeWidth={3} /> : m.quests.length === 0 ? <Lock className="size-3.5" /> : <span className="text-[11px] font-bold tabular">{m.progress}%</span>}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">{t('journey.milestoneN', { n: data.index + 1 })}</p>
          <p className="truncate text-[14px] font-semibold leading-tight">{m.title}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {tn('journey.questCount', m.quests.length)}
          </p>
        </div>
      </div>
    </div>
  );
});

const GoalNode = memo(function GoalNode({ data }: NodeProps<Node<{ title: string; readiness: number | null }>>) {
  const { t } = useT();
  return (
    <div className="orbit-gradient flex w-[170px] items-center gap-3 rounded-2xl p-3.5 text-white shadow-[0_12px_32px_-12px_rgba(10,180,106,0.9)]">
      <Handles />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Flag className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/75">{t('journey.jobReady')}</p>
        <p className="truncate text-[14px] font-bold leading-tight">{data.title}</p>
        {data.readiness !== null && <p className="text-[11.5px] text-white/85">{t('journey.todayPct', { score: Math.round(data.readiness) })}</p>}
      </div>
    </div>
  );
});

const StartNode = memo(function StartNode() {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-green bg-surface text-green shadow-card">
      <Route className="size-5" />
      <Handles />
    </div>
  );
});

const nodeTypes = { milestone: MilestoneNode, goal: GoalNode, start: StartNode };

export function JourneyFlow({
  milestones,
  selectedId,
  onSelect,
  roleTitle,
  readiness,
}: {
  milestones: MilestoneView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  roleTitle: string;
  readiness: number | null;
}) {
  const nextId = milestones.find((m) => m.status !== 'COMPLETED')?.id;
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = milestones.length + 2; // start + milestones + goal
  const cols = Math.max(2, Math.min(total, Math.floor((width || 1200) / COL_GAP)));
  const rows = Math.ceil(total / cols);

  const { nodes, edges } = useMemo(() => {
    const at = (i: number) => {
      const { col, row } = cell(i, cols);
      return { x: col * COL_GAP, y: row * ROW_GAP };
    };
    const n: Node[] = [{ id: 'start', type: 'start', position: at(0), data: {}, draggable: false, selectable: false }];
    milestones.forEach((m, i) => {
      n.push({
        id: m.id,
        type: 'milestone',
        position: at(i + 1),
        data: { milestone: m, selected: m.id === selectedId, index: i, isNext: m.id === nextId },
        draggable: false,
      });
    });
    n.push({ id: 'goal', type: 'goal', position: at(total - 1), data: { title: roleTitle, readiness }, draggable: false, selectable: false });
    const ids = ['start', ...milestones.map((m) => m.id), 'goal'];
    const e: Edge[] = ids.slice(1).map((id, i) => {
      const prev = milestones[i - 1];
      const done = i === 0 ? true : prev?.status === 'COMPLETED';
      const current = milestones[i]?.id === nextId;
      const from = cell(i, cols);
      const to = cell(i + 1, cols);
      const [sourceHandle, targetHandle] = from.row !== to.row ? ['s-b', 't-t'] : to.col > from.col ? ['s-r', 't-l'] : ['s-l', 't-r'];
      return {
        id: `${ids[i]}-${id}`,
        source: ids[i],
        target: id,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: current,
        style: { stroke: done ? '#0AB46A' : current ? '#FB9002' : 'var(--border-strong)', strokeWidth: 2.2, strokeDasharray: done ? undefined : '6 6' },
      };
    });
    return { nodes: n, edges: e };
  }, [milestones, selectedId, nextId, roleTitle, readiness, cols, total]);

  return (
    <div ref={wrapRef} className="w-full" style={{ height: rows * ROW_GAP + 48 }}>
      <ReactFlow
        key={cols}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => node.type === 'milestone' && onSelect(node.id)}
        fitView
        nodeOrigin={[0.5, 0.5]}
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.4}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        aria-label={t('journey.roadmapLabel')}
      >
        <Background gap={22} size={1} color="var(--border-strong)" />
      </ReactFlow>
    </div>
  );
}
