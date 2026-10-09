import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { GradientEdge, In, Out, Preview, RouterIcon, Thumb } from './FlowParts';
import { ZoomBar } from '../../components/ZoomBar';
import { CameraBridge } from '../../components/CameraBridge';
import { AmbientBridge } from '../../components/AmbientBridge';
import { releaseAmbientTarget, setAmbientTarget } from '../../lib/ambient';
import { hintSeen, markHint } from '../../lib/hints';
import { useFocus } from '../../lib/useFocus';
import { NAV_DELAY, reducedMotion } from '../../lib/camera';
import type { CameraApi } from '../../lib/useCameraNudge';
import { usageContexts, type Indexes, type UsageCtx } from '../../lib/library';
import type { Component, Library, Screen } from '../../lib/types';

type Ctx = UsageCtx;

interface D extends Record<string, unknown> { lib: Library; comp?: Component; ctx?: Ctx; i?: number; me?: string; compact?: boolean; more?: number; onOpen?: (el?: Element | null) => void }

function CompNode({ data }: NodeProps<Node<D>>) {
  const { lib, comp } = data;
  const tree = comp!.variants[0]?.tree;
  return (
    <div className="fnode current" style={{ width: 320 }}>
      <div className="hd"><span className="nm">❖ {comp!.name}</span><span className="badge">{comp!.kind === 'set' ? 'Component set' : 'Component'}</span></div>
      {tree ? <Preview lib={lib} tree={tree} w={294} h={140} max={1.6} /> : <Thumb id={comp!.id} w={294} h={140} fallback={<div className="preview" style={{ height: 140 }}><span className="note">Tree not scanned</span></div>} />}
      <div className="uses-list">{Object.entries(comp!.props).filter(([, t]) => Array.isArray(t)).map(([k, t]) => <span key={k}>{k}={(t as string[]).join('|')}</span>)}</div>
      <Out />
    </div>
  );
}

function RouterNode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div className="fnode router" style={{ display: 'flex' }}><RouterIcon /><In /><Out /></div>
      <span style={{ font: '600 13px/1.2 var(--display)' }}>Router</span>
      <span style={{ font: '500 11px/1 var(--ui)', color: 'var(--mute)' }}>usage contexts</span>
    </div>
  );
}

function CtxNode({ data }: NodeProps<Node<D>>) {
  const { lib, ctx, i, me } = data;
  if (!ctx) return null;
  if (data.compact) {
    return (
      <div className="fnode compact" style={{ width: 432 }}>
        <In />
        <div className="hd"><span className="ix">{String(i).padStart(2, '0')}</span><span className="nm">{ctx.kind === 'pattern' ? ctx.comp.name : ctx.screen.name}</span><span className={'badge' + (ctx.kind === 'screen' ? ' coral' : '')}>{ctx.kind === 'pattern' ? 'Pattern' : 'Screen'}</span></div>
      </div>
    );
  }
  if (ctx.kind === 'pattern') {
    const t = ctx.comp.variants[0]?.tree;
    return (
      <div className="fnode" style={{ width: 432, cursor: 'zoom-in' }}>
        <In />
        <div className="hd"><span className="ix">{String(i).padStart(2, '0')}</span><span className="nm">{ctx.comp.name}</span><span className="badge">Pattern · {ctx.comp.page}</span></div>
        {t && <Preview lib={lib} tree={t} w={406} h={110} />}
      </div>
    );
  }
  const s = ctx.screen;
  const shown = s.uses.filter(u => lib.components[u.id]?.variants.length).slice(0, 3);
  return (
    <div className="fnode" style={{ width: 432, cursor: 'pointer' }}>
      <In />
      <div className="hd"><span className="ix">{String(i).padStart(2, '0')}</span><span className="nm">{s.name}</span><span className="badge coral">{s.page}</span></div>
      <Thumb id={s.id} w={406} h={180} fallback={
      <div className="preview" style={{ height: 96, gap: 12, padding: '0 12px', justifyContent: 'flex-start', overflow: 'hidden' }}>
        {shown.map(u => { const t = lib.components[u.id].variants[0].tree; const k = Math.min(1, 70 / t.h, 150 / t.w); return <div key={u.id} style={{ flex: 'none', width: t.w * k, height: t.h * k, position: 'relative', opacity: u.id === me ? 1 : 0.45 }}><div style={{ transform: `scale(${k})`, transformOrigin: 'top left', position: 'absolute' }}><Preview lib={lib} tree={t} w={t.w + 16} h={t.h + 16} /></div></div>; })}
        {shown.length === 0 && <span className="note">Composition: elements not renderable in the scan</span>}
      </div>
      } />
      <div className="uses-list names">
        {s.uses.map(u => <span key={u.id} className={u.id === me ? 'me' : ''}>{u.name} ×{u.count}</span>)}
        {ctx.via && <span>via {ctx.via}</span>}
        <span className="val">{s.w}×{s.h}</span>
      </div>
    </div>
  );
}

function MoreNode({ data }: NodeProps<Node<D>>) {
  return <div className="fnode compact more" style={{ width: 432 }}><In /><div className="hd"><span className="nm">+ {data.more} more context{(data.more ?? 0) > 1 ? 's' : ''}</span><span className="badge">show ↓</span></div></div>;
}

const nodeTypes = { comp: CompNode, router: RouterNode, ctx: CtxNode, more: MoreNode };
const FULL = 4, COMPACT_MAX = 8; // 4 cartes complètes, puis des lignes compactes ; au-delà, « + N autres »
const edgeTypes = { grad: GradientEdge };

export function UsageLevel({ lib, idx, comp, onPattern, onScreen, screenOpen = false, active = true }: { lib: Library; idx: Indexes; comp: Component; onPattern: (id: string, el?: Element | null) => void; onScreen: (s: Screen) => void; screenOpen?: boolean; active?: boolean }) {
  const { focus, pulse, enter, leave } = useFocus();
  // Caméra : léger rapprochement au clic sur un contexte ; recul en douceur à la fermeture de l'écran.
  const [cam, setCam] = useState<CameraApi | null>(null);
  useEffect(() => { if (!screenOpen) cam?.release(); }, [screenOpen, cam]);
  const all = useMemo(() => usageContexts(lib, idx, comp.id), [lib, idx, comp]);
  const [expanded, setExpanded] = useState(false);
  const [hintDone] = useState(() => hintSeen('usage'));
  useEffect(() => { if (active) markHint('usage'); }, [active]); // seulement une fois réellement affichée
  const ctxs = expanded ? all : all.slice(0, FULL + COMPACT_MAX);
  const hidden = all.length - ctxs.length;

  const total = (idx.screens[comp.id]?.length ?? 0);
  // Hauteurs : cartes complètes puis lignes compactes, centrées verticalement sur le routeur.
  const hOf = (i: number) => (i < FULL ? 300 : 64);
  const ys: number[] = []; let acc = 0;
  for (let i = 0; i < ctxs.length + (hidden ? 1 : 0); i++) { ys.push(acc); acc += hOf(i); }
  const span = Math.min(acc, FULL * 300);
  const top = -span / 2 + 70;
  const nodes: Node<D>[] = [
    { id: 'c', type: 'comp', position: { x: 0, y: -130 }, data: { lib, comp } },
    { id: 'r', type: 'router', position: { x: 440, y: -46 }, data: { lib } },
    ...(hidden ? [{ id: 'more', type: 'more', className: 'nopan', position: { x: 640, y: top + ys[ctxs.length] - 80 }, data: { lib, more: hidden, onOpen: () => setExpanded(true) } }] : []),
    ...ctxs.map((ctx, i) => ({ id: 'x' + i, type: 'ctx', className: 'nopan', position: { x: 640, y: top + ys[i] - 80 }, data: {
      lib, ctx, i: i + 1, me: comp.id, compact: i >= FULL,
      onOpen: (el?: Element | null) => {
        cam?.nudge('x' + i);
        if (ctx.kind === 'pattern') window.setTimeout(() => onPattern(ctx.comp.id, el), reducedMotion() ? 0 : NAV_DELAY);
        else onScreen(ctx.screen);
      },
    } })),
  ];
  // Focus + contexte : le node survolé, le composant et l'aiguillage restent nets ; le reste s'estompe.
  const leaf = focus && focus !== 'c' && focus !== 'r' ? focus : null;
  const related = (id: string) => !leaf || id === 'c' || id === 'r' || id === leaf;
  for (const n of nodes) n.className = [n.className, !related(n.id) && 'dim', n.id === focus && 'focus'].filter(Boolean).join(' ');
  const edges: Edge[] = [
    { id: 'e-c', source: 'c', target: 'r', type: 'grad', data: { delay: 420, hot: !!focus, pulse: focus ? pulse : 0 } },
    ...(hidden ? [{ id: 'e-more', source: 'r', target: 'more', type: 'grad', data: { delay: 530, dim: !related('more'), hot: leaf === 'more', pulse: leaf === 'more' ? pulse : 0, pulseDelay: 0.45 } }] : []),
    ...ctxs.map((_, i) => {
      const t = 'x' + i, on = leaf ? leaf === t : !!focus;
      return { id: 'e' + i, source: 'r', target: t, type: 'grad', data: { delay: 530 + i * 110, hot: leaf === t, dim: !related(t), pulse: on ? pulse : 0, pulseDelay: 0.45 } };
    }),
  ];

  return (
    <div className="flow-wrap">
      <div className="hint" style={{ opacity: hintDone ? 0 : 1 }}><span><span className="dot v" />{all.length ? `${comp.name}: ${all.length} usage context(s) · ${total} direct screen(s)` : `${comp.name} is not instantiated in any scanned screen or pattern`}</span></div>
      <ReactFlowProvider>
        <ReactFlow onNodeMouseEnter={(e, n) => { enter(n.id); const r = (e.target as HTMLElement).closest('.react-flow__node')?.getBoundingClientRect(); if (r) setAmbientTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }} onNodeMouseLeave={() => { leave(); releaseAmbientTarget(); }} key={comp.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.12, minZoom: 0.6, nodes: [{ id: 'c' }, { id: 'r' }, ...ctxs.slice(0, 3).map((_, i) => ({ id: 'x' + i }))] }} onNodeClick={(e, n) => n.data.onOpen?.((e.target as Element).closest('.react-flow__node'))} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} minZoom={0.1} maxZoom={3} zoomOnScroll={false} panOnScroll proOptions={{ hideAttribution: true }}>
          <ZoomBar position="bottom-right" />
          <CameraBridge onReady={setCam} />
          <AmbientBridge />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
