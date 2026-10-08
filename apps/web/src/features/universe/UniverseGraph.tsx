import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import type { GraphNodeView, NodeType, UniverseGraph as UniverseData } from '@orbit/shared';
import { NODE_TYPE_META, UNIVERSE_FILTERS, type UniverseFilterId } from '@orbit/shared';
import { NODE_STYLE } from '@/lib/icons';

export interface UniverseGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (nodeId: string) => void;
}

interface Props {
  data: UniverseData;
  filter: UniverseFilterId;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dark: boolean;
}

/** Positions survive re-renders and refetches so the Universe evolves instead of reshuffling. */
const positionCache = new Map<string, { x: number; y: number }>();

const GROUP_ANGLE: Record<string, number> = { CAREER: -90, SKILLS: -20, EXPERIENCE: 60, OPPORTUNITY: 140, KNOWLEDGE: 200, PEOPLE: 250 };

function nodeSize(n: GraphNodeView): number {
  const m = n.metadata as Record<string, number | boolean | undefined>;
  switch (n.type) {
    case 'USER':
      return 20;
    case 'CAREER_ROLE':
      return m.primary ? 14 : 10;
    case 'GAP':
      return 7 + Math.min(6, Number(m.importance ?? 3) * 1.2);
    case 'SKILL':
      return 5 + Math.min(5, Number(m.level ?? 40) / 18);
    case 'GOAL':
      return 8;
    case 'OPPORTUNITY':
      return 6 + Math.min(4, Number(m.match ?? 50) / 25);
    default:
      return 5.5;
  }
}

function seedPosition(n: GraphNodeView, index: number): { x: number; y: number } {
  if (n.type === 'USER') return { x: 0, y: 0 };
  const group = NODE_TYPE_META[n.type].group;
  const base = ((GROUP_ANGLE[group] ?? 0) * Math.PI) / 180;
  const spread = ((index % 9) - 4) * 0.11;
  const radius = n.type === 'CAREER_ROLE' ? 3 : n.type === 'GAP' || n.type === 'SKILL' ? 6 + (index % 3) : 9 + (index % 4);
  return { x: Math.cos(base + spread) * radius, y: Math.sin(base + spread) * radius };
}

export const UniverseGraph = forwardRef<UniverseGraphHandle, Props>(function UniverseGraph({ data, filter, selectedId, onSelect, dark }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const state = useRef<{ hovered: string | null; selected: string | null; filterTypes: Set<NodeType> | null; dragging: string | null }>({
    hovered: null,
    selected: null,
    filterTypes: null,
    dragging: null,
  });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const filterTypes = useMemo(() => {
    const f = UNIVERSE_FILTERS.find((x) => x.id === filter);
    return f && f.types.length ? new Set<NodeType>(f.types) : null;
  }, [filter]);

  // Build graph + renderer whenever the data or theme changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const graph = new Graph({ type: 'directed', multi: false, allowSelfLoops: false });
    let fresh = 0;
    data.nodes.forEach((n, i) => {
      const cached = positionCache.get(n.key);
      if (!cached) fresh++;
      const pos = cached ?? seedPosition(n, i);
      graph.addNode(n.id, {
        x: pos.x,
        y: pos.y,
        size: nodeSize(n),
        color: NODE_STYLE[n.type].color,
        label: n.label,
        nodeType: n.type,
        key: n.key,
        fixed: n.type === 'USER',
      });
    });
    for (const e of data.edges) {
      if (!graph.hasNode(e.source) || !graph.hasNode(e.target) || graph.hasEdge(e.source, e.target)) continue;
      const toGap = graph.getNodeAttribute(e.target, 'nodeType') === 'GAP';
      graph.addEdge(e.source, e.target, {
        size: 0.6 + e.weight * 1.1,
        color: toGap ? (dark ? 'rgba(251,144,2,0.35)' : 'rgba(251,144,2,0.40)') : dark ? '#2c3a33' : '#d4ddd8',
        relationship: e.relationship,
      });
    }
    // Run the force layout synchronously; fewer iterations when most nodes kept their place.
    const iterations = fresh > data.nodes.length * 0.4 ? 260 : 80;
    if (graph.order > 1) {
      forceAtlas2.assign(graph, {
        iterations,
        settings: { ...forceAtlas2.inferSettings(graph), gravity: 1.2, scalingRatio: 9, slowDown: 6, strongGravityMode: false, barnesHutOptimize: graph.order > 150 },
      });
    }
    graph.forEachNode((_id, attr) => positionCache.set(attr.key as string, { x: attr.x as number, y: attr.y as number }));

    const labelColor = dark ? '#e8efeb' : '#15201b';
    const fadedNode = dark ? '#24302a' : '#e6ece9';
    const fadedEdge = dark ? '#1c2621' : '#eef2f0';
    const sigma = new Sigma(graph, container, {
      renderEdgeLabels: false,
      labelFont: 'Inter Variable, Inter, sans-serif',
      labelSize: 12,
      labelWeight: '600',
      labelColor: { color: labelColor },
      labelRenderedSizeThreshold: 7,
      defaultEdgeColor: dark ? '#2c3a33' : '#d4ddd8',
      zIndex: true,
      minCameraRatio: 0.15,
      maxCameraRatio: 4,
      nodeReducer: (node, attrs) => {
        const s = state.current;
        const res: Record<string, unknown> = { ...attrs };
        const type = attrs.nodeType as NodeType;
        if (s.filterTypes && type !== 'USER' && !s.filterTypes.has(type)) {
          res.hidden = true;
          return res;
        }
        const focus = s.hovered ?? s.selected;
        if (focus) {
          if (node === focus) {
            res.highlighted = true;
            res.forceLabel = true;
            res.zIndex = 2;
          } else if (graph.areNeighbors(node, focus)) {
            res.forceLabel = true;
            res.zIndex = 1;
          } else {
            res.color = fadedNode;
            res.label = '';
            res.zIndex = 0;
          }
        }
        if (type === 'USER' || type === 'CAREER_ROLE') res.forceLabel = true;
        return res;
      },
      edgeReducer: (edge, attrs) => {
        const s = state.current;
        const res: Record<string, unknown> = { ...attrs };
        const [src, tgt] = graph.extremities(edge);
        if (s.filterTypes) {
          const st = graph.getNodeAttribute(src, 'nodeType') as NodeType;
          const tt = graph.getNodeAttribute(tgt, 'nodeType') as NodeType;
          if ((st !== 'USER' && !s.filterTypes.has(st)) || (tt !== 'USER' && !s.filterTypes.has(tt))) {
            res.hidden = true;
            return res;
          }
        }
        const focus = s.hovered ?? s.selected;
        if (focus) {
          if (src === focus || tgt === focus) {
            res.color = '#0AB46A';
            res.size = (attrs.size as number) + 0.8;
            res.zIndex = 1;
          } else res.color = fadedEdge;
        }
        return res;
      },
    });
    sigmaRef.current = sigma;
    graphRef.current = graph;
    state.current.filterTypes = filterTypes;
    state.current.selected = selectedId;

    sigma.on('enterNode', ({ node }) => {
      state.current.hovered = node;
      container.style.cursor = 'pointer';
      sigma.refresh({ skipIndexation: true });
    });
    sigma.on('leaveNode', () => {
      state.current.hovered = null;
      container.style.cursor = 'grab';
      sigma.refresh({ skipIndexation: true });
    });
    sigma.on('clickNode', ({ node }) => onSelectRef.current(node));
    sigma.on('clickStage', () => onSelectRef.current(null));

    // Drag nodes
    sigma.on('downNode', ({ node }) => {
      state.current.dragging = node;
      graph.setNodeAttribute(node, 'highlighted', true);
      sigma.getCamera().disable();
    });
    const captor = sigma.getMouseCaptor();
    captor.on('mousemovebody', (e) => {
      const dragging = state.current.dragging;
      if (!dragging) return;
      const pos = sigma.viewportToGraph(e);
      graph.setNodeAttribute(dragging, 'x', pos.x);
      graph.setNodeAttribute(dragging, 'y', pos.y);
      positionCache.set(graph.getNodeAttribute(dragging, 'key') as string, pos);
      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();
    });
    captor.on('mouseup', () => {
      if (state.current.dragging) graph.removeNodeAttribute(state.current.dragging, 'highlighted');
      state.current.dragging = null;
      sigma.getCamera().enable();
    });
    container.style.cursor = 'grab';

    return () => {
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dark]);

  // Filter & selection updates without rebuilding.
  useEffect(() => {
    state.current.filterTypes = filterTypes;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [filterTypes]);

  useEffect(() => {
    state.current.selected = selectedId;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selectedId]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => void sigmaRef.current?.getCamera().animatedZoom({ duration: 300 }),
    zoomOut: () => void sigmaRef.current?.getCamera().animatedUnzoom({ duration: 300 }),
    reset: () => void sigmaRef.current?.getCamera().animatedReset({ duration: 400 }),
    focus: (nodeId: string) => {
      const sigma = sigmaRef.current;
      if (!sigma || !graphRef.current?.hasNode(nodeId)) return;
      const display = sigma.getNodeDisplayData(nodeId);
      if (display) void sigma.getCamera().animate({ x: display.x, y: display.y, ratio: 0.45 }, { duration: 500 });
    },
  }));

  return <div ref={containerRef} className="absolute inset-0" role="img" aria-label="Career Universe graph. Use the search box or the list in the details panel to explore nodes with a keyboard." />;
});
