import { memo, useMemo } from 'react';
import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Flag, Lock, Route } from 'lucide-react';
import type { MilestoneView } from '@orbit/shared';
import { cn } from '@/lib/utils';

type MilestoneNodeData = { milestone: MilestoneView; selected: boolean; index: number; isNext: boolean };

const MilestoneNode = memo(function MilestoneNode({ data }: NodeProps<Node<MilestoneNodeData>>) {
  const m = data.milestone;
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
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
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
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">Milestone {data.index + 1}</p>
          <p className="truncate text-[14px] font-semibold leading-tight">{m.title}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {m.quests.length} {m.quests.length === 1 ? 'quest' : 'quests'}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-transparent" />
    </div>
  );
});

const GoalNode = memo(function GoalNode({ data }: NodeProps<Node<{ title: string; readiness: number | null }>>) {
  return (
    <div className="orbit-gradient flex w-[170px] items-center gap-3 rounded-2xl p-3.5 text-white shadow-[0_12px_32px_-12px_rgba(10,180,106,0.9)]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-transparent" />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Flag className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/75">Job ready</p>
        <p className="truncate text-[14px] font-bold leading-tight">{data.title}</p>
        {data.readiness !== null && <p className="text-[11.5px] text-white/85">{Math.round(data.readiness)}% today</p>}
      </div>
    </div>
  );
});

const StartNode = memo(function StartNode() {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-green bg-surface text-green shadow-card">
      <Route className="size-5" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-transparent" />
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
  const { nodes, edges } = useMemo(() => {
    const gap = 236;
    const n: Node[] = [{ id: 'start', type: 'start', position: { x: 0, y: 22 }, data: {}, draggable: false, selectable: false }];
    milestones.forEach((m, i) => {
      n.push({
        id: m.id,
        type: 'milestone',
        position: { x: 100 + i * gap, y: i % 2 === 0 ? 0 : 36 },
        data: { milestone: m, selected: m.id === selectedId, index: i, isNext: m.id === nextId },
        draggable: false,
      });
    });
    n.push({ id: 'goal', type: 'goal', position: { x: 100 + milestones.length * gap, y: 14 }, data: { title: roleTitle, readiness }, draggable: false, selectable: false });
    const ids = ['start', ...milestones.map((m) => m.id), 'goal'];
    const e: Edge[] = ids.slice(1).map((id, i) => {
      const prev = milestones[i - 1];
      const done = i === 0 ? true : prev?.status === 'COMPLETED';
      const current = milestones[i]?.id === nextId;
      return {
        id: `${ids[i]}-${id}`,
        source: ids[i],
        target: id,
        type: 'smoothstep',
        animated: current,
        style: { stroke: done ? '#0AB46A' : current ? '#FB9002' : 'var(--border-strong)', strokeWidth: 2.2, strokeDasharray: done ? undefined : '6 6' },
      };
    });
    return { nodes: n, edges: e };
  }, [milestones, selectedId, nextId, roleTitle, readiness]);

  return (
    <div className="h-[230px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => node.type === 'milestone' && onSelect(node.id)}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.4}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        aria-label="Journey roadmap"
      >
        <Background gap={22} size={1} color="var(--border-strong)" />
      </ReactFlow>
    </div>
  );
}
