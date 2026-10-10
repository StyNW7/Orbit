import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import type { NodeHoverDrawingFunction, NodeLabelDrawingFunction } from 'sigma/rendering';
import type { GraphNodeView, NodeType, UniverseGraph as UniverseData } from '@orbit/shared';
import { UNIVERSE_FILTERS, type UniverseFilterId } from '@orbit/shared';
import { nodeColor } from '@/lib/icons';
import { useT } from '@/lib/i18n';

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

/** Nodes the user dragged keep their place across refetches and theme switches. */
const draggedPositions = new Map<string, { x: number; y: number }>();

/**
 * Orbital layout: you at the centre, then three rings —
 *   inner:  career roles and goals (where you are heading)
 *   middle: skills you have, then the gaps ahead
 *   outer:  quests, experience, opportunities, knowledge and people
 * Each family keeps its own sector, so the picture stays readable as the Universe grows.
 */
const RINGS: { types: NodeType[]; radius: number; start: number }[] = [
  { types: ['CAREER_ROLE', 'GOAL'], radius: 3.2, start: -90 },
  { types: ['SKILL', 'GAP'], radius: 6.4, start: -60 },
  {
    types: ['QUEST', 'EXPERIENCE', 'PROJECT', 'COMPETITION', 'CERTIFICATION', 'OPPORTUNITY', 'EVENT', 'COURSE', 'BOOK', 'PAPER', 'MENTOR', 'ROLE_MODEL'],
    radius: 10,
    start: -120,
  },
];
const MIN_SPACING = 1.35;
/** Rings are drawn as ellipses so the Universe fills a wide canvas. */
const ELLIPSE_X = 1.55;

/** Stable 0..1 pseudo-random from a key, for a little organic jitter that never reshuffles. */
function hash01(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function rankWithinRing(n: GraphNodeView): number {
  const m = n.metadata as Record<string, number | boolean | undefined>;
  if (n.type === 'CAREER_ROLE') return m.primary ? -1 : 0;
  if (n.type === 'SKILL') return -Number(m.level ?? 0);
  if (n.type === 'GAP') return -Number(m.importance ?? 0);
  if (n.type === 'OPPORTUNITY') return -Number(m.match ?? 0);
  return 0;
}

function orbitalLayout(nodes: GraphNodeView[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const ring of RINGS) {
    const members = nodes
      .filter((n) => ring.types.includes(n.type))
      .sort((a, b) => ring.types.indexOf(a.type) - ring.types.indexOf(b.type) || rankWithinRing(a) - rankWithinRing(b) || a.label.localeCompare(b.label));
    if (!members.length) continue;
    // Crowded rings stagger into two lanes instead of overlapping.
    const capacity = Math.floor((2 * Math.PI * ring.radius) / MIN_SPACING);
    const staggered = members.length > capacity;
    members.forEach((n, i) => {
      const angle = ((ring.start + (360 * i) / members.length) * Math.PI) / 180;
      const lane = staggered && i % 2 === 1 ? 1.5 : 0;
      const r = ring.radius + lane + (hash01(n.key) - 0.5) * 0.6;
      // Sigma's y axis points up: negate so rings start at the top and run clockwise.
      out.set(n.id, { x: Math.cos(angle) * r * ELLIPSE_X, y: -Math.sin(angle) * r });
    });
  }
  for (const n of nodes) if (!out.has(n.id)) out.set(n.id, { x: 0, y: 0 });
  return out;
}

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

/** Theme-aware canvas labels: a halo keeps text legible over edges; hover draws a pill in the surface colour. */
function labelRenderers(dark: boolean): { drawLabel: NodeLabelDrawingFunction; drawHover: NodeHoverDrawingFunction } {
  const text = dark ? '#e8efeb' : '#15201b';
  const halo = dark ? 'rgba(16,23,20,0.88)' : 'rgba(255,255,255,0.92)';
  const surface = dark ? '#1b2621' : '#ffffff';
  const border = dark ? '#31403a' : '#e3e9e6';
  const shadow = dark ? 'rgba(0,0,0,0.55)' : 'rgba(16,23,20,0.18)';

  const drawLabel: NodeLabelDrawingFunction = (ctx, data, settings) => {
    if (!data.label) return;
    const size = settings.labelSize;
    ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    const x = data.x + data.size + 4;
    const y = data.y + size / 3;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = halo;
    ctx.strokeText(data.label, x, y);
    ctx.fillStyle = text;
    ctx.fillText(data.label, x, y);
  };

  const drawHover: NodeHoverDrawingFunction = (ctx, data, settings) => {
    const size = settings.labelSize;
    ctx.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
    const label = data.label ?? '';
    const pad = 4;
    const r = data.size + pad;
    const h = Math.max(r * 2, size + 12);
    const width = label ? r + data.size + 8 + ctx.measureText(label).width + 10 : h;
    ctx.beginPath();
    ctx.roundRect(data.x - r, data.y - h / 2, width, h, h / 2);
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    ctx.stroke();
    if (label) {
      ctx.fillStyle = text;
      ctx.fillText(label, data.x + data.size + 6, data.y + size / 3);
    }
  };

  return { drawLabel, drawHover };
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
  const enteredRef = useRef(false);
  const { t } = useT();
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
    const layout = orbitalLayout(data.nodes);
    data.nodes.forEach((n) => {
      const pos = draggedPositions.get(n.key) ?? layout.get(n.id)!;
      graph.addNode(n.id, {
        x: pos.x,
        y: pos.y,
        size: nodeSize(n),
        color: nodeColor(n.type, dark),
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
        size: 0.4 + e.weight * 0.8,
        color: toGap ? (dark ? '#4a3a1f' : '#fbe6c8') : dark ? '#24302a' : '#dde5e1',
        relationship: e.relationship,
      });
    }
    // Run the force layout synchronously; fewer iterations when most nodes kept their place.
    const labelColor = dark ? '#e8efeb' : '#15201b';
    const { drawLabel, drawHover } = labelRenderers(dark);
    const fadedNode = dark ? '#24302a' : '#e6ece9';
    const fadedEdge = dark ? '#1c2621' : '#eef2f0';
    const sigma = new Sigma(graph, container, {
      renderEdgeLabels: false,
      labelFont: 'Inter Variable, Inter, sans-serif',
      labelSize: 12,
      labelWeight: '600',
      labelColor: { color: labelColor },
      defaultDrawNodeLabel: drawLabel,
      defaultDrawNodeHover: drawHover,
      labelRenderedSizeThreshold: 8,
      labelDensity: 0.55,
      labelGridCellSize: 120,
      defaultEdgeColor: dark ? '#24302a' : '#dde5e1',
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

    // Faint orbit paths behind the edges — the Universe literally orbits you.
    // `beforeLayer` is honoured at runtime (Sigma#createLayer) but missing from this method's typings.
    sigma.createCanvasContext('orbits', { beforeLayer: 'edges' } as Parameters<Sigma['createCanvasContext']>[1]);
    sigma.resize(true);
    const orbitCtx = sigma.getCanvases().orbits.getContext('2d');
    const drawOrbits = () => {
      if (!orbitCtx) return;
      const { width, height } = sigma.getDimensions();
      orbitCtx.clearRect(0, 0, width, height);
      const c = sigma.graphToViewport({ x: 0, y: 0 });
      orbitCtx.lineWidth = 1;
      orbitCtx.setLineDash([3, 7]);
      orbitCtx.strokeStyle = dark ? 'rgba(232,239,235,0.16)' : 'rgba(21,32,27,0.14)';
      for (const ring of RINGS) {
        const rx = sigma.graphToViewport({ x: ring.radius * ELLIPSE_X, y: 0 });
        const ry = sigma.graphToViewport({ x: 0, y: ring.radius });
        orbitCtx.beginPath();
        orbitCtx.ellipse(c.x, c.y, Math.hypot(rx.x - c.x, rx.y - c.y), Math.hypot(ry.x - c.x, ry.y - c.y), sigma.getCamera().angle, 0, Math.PI * 2);
        orbitCtx.stroke();
      }
      orbitCtx.setLineDash([]);
    };
    sigma.on('afterRender', drawOrbits);

    // A gentle settle-in on first view; refetches and theme switches keep the camera still.
    if (!enteredRef.current) {
      enteredRef.current = true;
      sigma.getCamera().setState({ ratio: 1.35, angle: -0.12 });
      void sigma.getCamera().animate({ ratio: 1, angle: 0 }, { duration: 900, easing: 'cubicOut' });
    }
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
      draggedPositions.set(graph.getNodeAttribute(dragging, 'key') as string, pos);
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

  return <div ref={containerRef} className="absolute inset-0" role="img" aria-label={t('universe.graphLabel')} />;
});
