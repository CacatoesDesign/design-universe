import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { GradientEdge, In, Out, Preview, Thumb } from './FlowParts';
import { ZoomBar } from '../../components/ZoomBar';
import { CameraBridge } from '../../components/CameraBridge';
import { AmbientBridge } from '../../components/AmbientBridge';
import { releaseAmbientTarget, setAmbientTarget } from '../../lib/ambient';
import { hintSeen, markHint } from '../../lib/hints';
import { useFocus } from '../../lib/useFocus';
import { NAV_DELAY, reducedMotion } from '../../lib/camera';
import type { CameraApi } from '../../lib/useCameraNudge';
import type { Indexes } from '../../lib/library';
import type { Component, Library } from '../../lib/types';

interface D extends Record<string, unknown> { lib: Library; comp: Component; vars: number; screens: number; active: boolean; onOpen: (e?: React.MouseEvent) => void }

function LibNode({ data }: NodeProps<Node<D>>) {
  const { lib, comp } = data;
  const t = comp.variants[0]?.tree;
  return (
    <div className={'fnode' + (data.active ? ' current' : '')} style={{ width: 280, cursor: 'zoom-in' }} onClick={data.onOpen}>
      <In />
      <div className="hd"><span className="nm">{comp.name}</span><span className="badge">{comp.page}</span></div>
      {t ? <Preview lib={lib} tree={t} w={254} h={96} /> : <Thumb id={comp.id} w={254} h={96} fallback={<div className="preview noscan" style={{ height: 96 }}><span>No render scanned</span><span className="note">relations and usages only</span></div>} />}
      <div className="uses-list">
        <span>{comp.variantCount} variant{comp.variantCount > 1 ? 's' : ''}</span>
        <span>{data.vars} tokens</span>
        <span>{data.screens} screen{data.screens > 1 ? 's' : ''}</span>
      </div>
      <Out />
    </div>
  );
}

const nodeTypes = { lib: LibNode, colhead: ColHead, grouphead: GroupHead };
const edgeTypes = { grad: GradientEdge };

const COL_W = 340, ROW_H = 230, PER_COL = 7;
const groupOf = (c: Component) => c.group || c.page;

/** Titre d'un groupe (famille) dans une colonne. */
function GroupHead({ data }: NodeProps<Node<{ label: string; count: number }>>) {
  return <div className="lib-grouphead"><span>{data.label}</span><span className="mono">{data.count}</span></div>;
}

/** En-tête de colonne : la couche (ou la profondeur) et son nombre de composants. */
function ColHead({ data }: NodeProps<Node<{ label: string; count: number }>>) {
  return <div className="lib-colhead"><span>{data.label}</span><span className="mono">{data.count}</span></div>;
}

export function LibraryLevel({ lib, idx, current, onOpen }: { lib: Library; idx: Indexes; current: string; onOpen: (id: string, el?: Element | null) => void }) {
  const [cam, setCam] = useState<CameraApi | null>(null);
  // Filtre par groupe (section Figma, sinon page) : le composant courant reste toujours visible.
  const [filter, setFilter] = useState<string | null>(null);
  const groups = useMemo(() => {
    const n: Record<string, number> = {};
    Object.values(lib.components).forEach(c => { n[groupOf(c)] = (n[groupOf(c)] ?? 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [lib]);
  // Même condition pour les colonnes et pour la légende.
  const byLayers = !!lib.layers?.length && Object.values(lib.components).some(c => c.layer);
  const { nodes, edges } = useMemo(() => {
    const all = Object.values(lib.components);
    const comps = all.filter(c => !filter || groupOf(c) === filter || c.id === current);
    const shown = new Set(comps.map(c => c.id));
    // Colonnes : par couche si la lib en déclare (Primitives → Compositions…), sinon par profondeur d'imbrication.
    const cols: { label: string; list: Component[] }[] = [];
    if (byLayers) {
      for (const l of lib.layers ?? []) cols.push({ label: l, list: comps.filter(c => c.layer === l) });
      const rest = comps.filter(c => !c.layer || !lib.layers?.includes(c.layer));
      if (rest.length) cols.push({ label: 'Other', list: rest });
    } else {
      const depth: Record<string, number> = {};
      const d = (c: Component, stack: string[] = []): number => {
        if (depth[c.id] !== undefined) return depth[c.id];
        const kids = c.uses.map(u => lib.components[u.id]).filter(Boolean).filter(k => !stack.includes(k.id));
        return (depth[c.id] = kids.length ? 1 + Math.max(...kids.map(k => d(k, [...stack, c.id]))) : 0);
      };
      all.forEach(c => d(c));
      const max = Math.max(0, ...comps.map(c => depth[c.id]));
      for (let k = 0; k <= max; k++) cols.push({ label: k === 0 ? 'Base components' : `Contains level ${k - 1}`, list: comps.filter(c => depth[c.id] === k) });
    }
    const nodes: Node[] = [];
    // Dans une colonne : une sous-colonne par groupe (famille), titrée, 7 nodes max avant de continuer à côté.
    // Une colonne vide sépare les couches. La profondeur garde le tri par nombre de parents.
    let slot = 0;
    for (const col of cols.filter(c => c.list.length)) {
      const base = slot;
      const byGroup = new Map<string, Component[]>();
      col.list.sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || (idx.parents[b.id]?.length ?? 0) - (idx.parents[a.id]?.length ?? 0) || a.name.localeCompare(b.name));
      col.list.forEach(c => byGroup.set(groupOf(c), [...(byGroup.get(groupOf(c)) ?? []), c]));
      // Petits groupes empilés dans la même sous-colonne tant qu'elle a de la place (7 nodes de haut).
      const HEAD = 44, GAP = 40, MAX = HEAD + PER_COL * ROW_H;
      let y = 0;
      for (const [g, list] of byGroup) {
        if (y > 0 && y + GAP + HEAD + Math.min(list.length, PER_COL) * ROW_H > MAX) { slot++; y = 0; }
        if (y > 0) y += GAP;
        nodes.push({ id: `grp:${col.label}:${g}`, type: 'grouphead', position: { x: slot * COL_W, y }, data: { label: g, count: list.length }, selectable: false, draggable: false });
        y += HEAD;
        list.forEach((c, i) => {
          if (i > 0 && i % PER_COL === 0) { slot++; y = HEAD; }
          nodes.push({ id: c.id, type: 'lib', position: { x: slot * COL_W, y },
            data: { lib, comp: c, vars: idx.componentVars[c.id]?.size ?? 0, screens: idx.screens[c.id]?.length ?? 0, active: c.id === current, onOpen: (e?: React.MouseEvent) => { const el = e?.currentTarget ?? null; cam?.nudge(c.id); window.setTimeout(() => onOpen(c.id, el), reducedMotion() ? 0 : NAV_DELAY); } } });
          y += ROW_H;
        });
      }
      nodes.push({ id: 'col:' + col.label, type: 'colhead', position: { x: base * COL_W, y: -120 }, data: { label: col.label, count: col.list.length }, selectable: false, draggable: false });
      slot += 2;
    }
    // Tous les liens visibles ; l'affichage (repos / survol) est choisi plus bas.
    const edges: Edge[] = [];
    comps.forEach(c => c.uses.forEach(u => {
      if (!shown.has(u.id)) return;
      const rel = c.id === current || u.id === current;
      edges.push({ id: `${u.id}>${c.id}`, source: u.id, target: c.id, type: 'grad', data: { hot: rel } });
    }));
    return { nodes, edges };
  }, [lib, idx, current, onOpen, cam, filter, byLayers]);

  // Focus + contexte au survol : le node et ses voisins directs restent nets, une impulsion parcourt leurs liens.
  const { focus, pulse, enter, leave } = useFocus();
  const near = useMemo(() => focus ? new Set([focus, ...edges.filter(e => e.source === focus || e.target === focus).flatMap(e => [e.source, e.target])]) : null, [focus, edges]);
  const vNodes = near ? nodes.map(n => (n.type !== 'lib' ? n : { ...n, className: n.id === focus ? 'focus' : near.has(n.id) ? '' : 'dim' })) : nodes;
  // Au repos : seuls les liens du composant courant. Au survol : ceux du node survolé (avec une impulsion).
  const vEdges = near
    ? edges.filter(e => e.source === focus || e.target === focus).map(e => ({ ...e, data: { ...e.data, hot: true, pulse } }))
    : edges.filter(e => e.source === current || e.target === current);

  // Ouverture lisible : centrée sur le composant courant (ses liens partent vers les voisins), entre 60 et 80 %.
  const [hintDone] = useState(() => hintSeen('library'));
  useEffect(() => markHint('library'), []);

  return (
    <div className="flow-wrap">
      <div className="hint" style={{ opacity: hintDone ? 0 : 1 }}><span><span className="dot v" />{lib.file.name} · {Object.keys(lib.components).length} components · {lib.iconsPage.components} icons · {Object.keys(lib.variables).length} variables</span></div>
      {groups.length > 1 && (
        <div className="lib-filter" role="toolbar" aria-label="Filter by group">
          <button aria-pressed={!filter} onClick={() => setFilter(null)}>All <span className="mono">{Object.keys(lib.components).length}</span></button>
          {groups.map(([g, n]) => <button key={g} aria-pressed={filter === g} onClick={() => setFilter(f => (f === g ? null : g))}>{g} <span className="mono">{n}</span></button>)}
        </div>
      )}
      <ReactFlowProvider>
        <ReactFlow onNodeMouseEnter={(e, n) => { if (n.type !== 'lib') return; enter(n.id); const r = (e.target as HTMLElement).closest('.react-flow__node')?.getBoundingClientRect(); if (r) setAmbientTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }} onNodeMouseLeave={(_, n) => { if (n.type !== 'lib') return; leave(); releaseAmbientTarget(); }} key={filter ?? 'all'} nodes={vNodes} edges={vEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ minZoom: 0.6, maxZoom: 0.8, nodes: [{ id: current }] }} nodesConnectable={false} elementsSelectable={false} minZoom={0.1} maxZoom={3} zoomOnScroll={false} panOnScroll proOptions={{ hideAttribution: true }}>
          <ZoomBar position="bottom-right" />
          <CameraBridge onReady={setCam} />
          <AmbientBridge />
        </ReactFlow>
      </ReactFlowProvider>
      <div className="legend"><span><i style={{ background: 'var(--g0)' }} />child component</span><span><i style={{ background: 'var(--g2)' }} />pattern that instantiates it</span><span>{byLayers ? 'columns = system layers' : 'columns = nesting depth'}</span></div>
    </div>
  );
}
