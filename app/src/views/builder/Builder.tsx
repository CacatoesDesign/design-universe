import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { sfx } from '../../lib/sound';
import { ReactFlow, ReactFlowProvider, Background, SelectionMode, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge } from '@xyflow/react';
import { GradientEdge, Preview } from '../explorer/FlowParts';
import { ZoomBar } from '../../components/ZoomBar';
import { useCameraNudge } from '../../lib/useCameraNudge';
import { nextPulse, useFocus } from '../../lib/useFocus';
import type { Library, Modes } from '../../lib/types';
import { libId } from '../../lib/library';
import { buildTree, hasLogic, snapshot, type BData, type BNode, type Pattern, type PTree } from './compose';
import { activeHandle, bpOf, BREAKPOINTS, isLogic, type Breakpoint, type Env, type StateVar } from './logic';
import { Simulator } from './Simulator';
import { BuilderCtx, Live } from './context';
import { nodeTypes } from './nodes';
import { Inspector } from './Inspector';
import { template, varId } from './templates';
import { loadPicks, savePicks, slotHandle, slotOfHandle, type SlotPicks } from '../../lib/slots';

const edgeTypes = { grad: GradientEdge };

const keyFor = (lib: Library) => `ds-graph-builder-v1:${libId(lib)}`;
const patternsKey = (lib: Library) => `ds-graph-patterns-v1:${libId(lib)}`;
const loadPatterns = (lib: Library): Record<string, Pattern> => { try { return JSON.parse(localStorage.getItem(patternsKey(lib)) ?? '{}'); } catch { return {}; } };
const load = (lib: Library): { nodes: BNode[]; edges: Edge[] } | null => { try { const s = localStorage.getItem(keyFor(lib)); return s ? JSON.parse(s) : null; } catch { return null; } };
const logicKey = (lib: Library) => `ds-graph-logic-v1:${libId(lib)}`;
interface LogicState { vars: StateVar[]; values: Record<string, string>; bp: Breakpoint }
const loadLogic = (lib: Library): LogicState => {
  try {
    const j = JSON.parse(localStorage.getItem(logicKey(lib)) ?? 'null') as Partial<LogicState> | null;
    return { vars: Array.isArray(j?.vars) ? j.vars : [], values: j?.values && typeof j.values === 'object' ? j.values : {}, bp: BREAKPOINTS.some(b => b.id === j?.bp) ? j!.bp! : 'desktop' };
  } catch { return { vars: [], values: {}, bp: 'desktop' }; }
};
const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 8);

function Canvas({ lib, modes, setModes }: { lib: Library; modes: Modes; setModes: (f: (m: Modes) => Modes) => void }) {
  const init = useMemo(() => load(lib) ?? template(lib, 'nav'), [lib]);
  const [nodes, setNodes, onNodesChange] = useNodesState<BNode>(init.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(init.edges);
  const [patterns, setPatterns] = useState<Record<string, Pattern>>(() => loadPatterns(lib));
  const [ioMsg, setIoMsg] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);
  const cam = useCameraNudge();
  const [logic, setLogic] = useState<LogicState>(() => loadLogic(lib));
  const [slotPicks, setPicks] = useState<SlotPicks>(() => loadPicks(lib));
  useEffect(() => savePicks(lib, slotPicks), [slotPicks, lib]);
  const setSlotPicks = useCallback((key: string, ids: string[]) => setPicks(p => ({ ...p, [key]: ids })), []);

  useEffect(() => { try { localStorage.setItem(keyFor(lib), JSON.stringify({ nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })), edges })); } catch { /* stockage indisponible */ } }, [nodes, edges, lib]);
  useEffect(() => { try { localStorage.setItem(logicKey(lib), JSON.stringify(logic)); } catch { /* stockage indisponible */ } }, [logic, lib]);
  useEffect(() => { try { localStorage.setItem(patternsKey(lib), JSON.stringify(patterns)); } catch { /* stockage indisponible */ } }, [patterns, lib]);

  const update = useCallback((id: string, patch: Partial<BData>) => setNodes(ns => ns.map(n => (n.id === id ? { ...n, data: { ...n.data, ...patch } as BData } : n))), [setNodes]);
  const remove = useCallback((id: string) => { setNodes(ns => ns.filter(n => n.id !== id)); setEdges(es => es.filter(e => e.source !== id && e.target !== id)); }, [setNodes, setEdges]);
  // Une sortie n'a qu'un parent ; une poignée de node logique (then, else, un cas…) n'a qu'une entrée.
  const onConnect = useCallback((c: Connection) => {
    const t = nodes.find(n => n.id === c.target);
    // Un slot accepte plusieurs éléments ; un composant n'accepte des liens que sur ses slots.
    if (t?.data.kind === 'component' && slotOfHandle(c.targetHandle) === null) return;
    const one = !!t && isLogic(t.data);
    sfx('link');
    setEdges(es => addEdge({ ...c, type: 'grad' }, es.filter(e => e.source !== c.source && !(one && e.target === c.target && (e.targetHandle ?? null) === (c.targetHandle ?? null)))));
  }, [setEdges, nodes]);
  // Ajoute un composant (variante par défaut) relié au slot, à gauche du node, sous ceux déjà reliés à ce slot.
  const fillSlot = useCallback((nodeId: string, slot: string, compId: string) => {
    const host = nodes.find(n => n.id === nodeId); const c = lib.components[compId];
    if (!host || !c?.variants.length) return;
    const h = slotHandle(slot);
    const siblings = edges.filter(e => e.target === nodeId && e.targetHandle === h).map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as BNode[];
    const y = siblings.length ? Math.max(...siblings.map(n => n.position.y + (n.measured?.height ?? 160))) + 24 : host.position.y;
    const id = uid('component');
    setNodes(ns => [...ns, { id, type: 'component', position: { x: host.position.x - 320, y }, data: { kind: 'component', compId, vprops: c.variants[0].props, texts: {} } }]);
    sfx('link');
    setEdges(es => [...es, { id: `${id}>${nodeId}:${slot}`, source: id, target: nodeId, targetHandle: h, type: 'grad' }]);
  }, [nodes, edges, lib, setNodes, setEdges]);
  const dropEdges = useCallback((target: string, handle: string) => setEdges(es => es.filter(e => !(e.target === target && e.targetHandle === handle))), [setEdges]);

  // Enregistre le Stack et tout ce qui y est relié comme pattern. Même nom = mise à jour : toutes les instances suivent.
  const savePattern = useCallback((stackId: string, name: string) => {
    const t = buildTree(nodes, edges, stackId, patterns);
    const root = t && snapshot(t);
    if (t && hasLogic(t)) return 'Patterns can\'t contain If / Router / Show nodes yet: put the condition above the pattern instead.';
    if (!root || root.kind !== 'stack') return null;
    if (!root.children.length) return 'Connect components to this Stack first.';
    const existing = Object.values(patterns).find(p => p.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? uid('pattern');
    setPatterns(ps => ({ ...ps, [id]: { id, name, root, updatedAt: new Date().toISOString() } }));
    sfx('save');
    return existing ? `Pattern "${name}" updated: its instances follow.` : `Pattern "${name}" added to the palette.`;
  }, [nodes, edges, patterns]);

  // Remplace une instance de pattern par ses Stacks et composants (avec ses overrides), pour l'éditer.
  const detach = useCallback((nodeId: string) => {
    const n = nodes.find(x => x.id === nodeId); if (!n || n.data.kind !== 'pattern') return;
    const t = buildTree(nodes, edges, nodeId, patterns); if (!t || t.kind !== 'pattern') return;
    const root = snapshot(t.child)!;
    const newNodes: BNode[] = [], newEdges: Edge[] = [];
    let row = 0;
    const place = (pt: PTree, depth: number): string => {
      const id = uid(pt.kind);
      if (pt.kind === 'component') {
        newNodes.push({ id, type: 'component', position: { x: n.position.x - depth * 300, y: n.position.y + row++ * 200 }, data: pt.data });
        for (const [slot, list] of Object.entries(pt.fill ?? {})) list.forEach(c => { const k = place(c, depth + 1); newEdges.push({ id: `${k}>${id}:${slot}`, source: k, target: id, targetHandle: slotHandle(slot), type: 'grad' }); });
        return id;
      }
      const kids = pt.children.map(c => place(c, depth + 1));
      newNodes.push({ id, type: 'stack', position: { x: n.position.x - depth * 300, y: n.position.y + Math.max(0, row - 1) * 100 }, data: pt.data });
      kids.forEach(k => newEdges.push({ id: `${k}>${id}`, source: k, target: id, type: 'grad' }));
      return id;
    };
    const rootId = place(root, 0);
    setNodes(ns => [...ns.filter(x => x.id !== nodeId), ...newNodes.map(x => (x.id === rootId ? { ...x, selected: true } : x))]);
    setEdges(es => [...es.filter(e => e.target !== nodeId).map(e => (e.source === nodeId ? { ...e, id: `${rootId}>${e.target}`, source: rootId } : e)), ...newEdges]);
  }, [nodes, edges, patterns, setNodes, setEdges]);

  const add = (data: BData, pos?: { x: number; y: number }) => {
    const id = uid(data.kind);
    // Sans position de dépôt : à droite de tout le contenu, pour ne recouvrir aucun node.
    const right = nodes.reduce((m, n) => Math.max(m, n.position.x + (n.measured?.width ?? 260)), -Infinity);
    const top = nodes.reduce((m, n) => Math.min(m, n.position.y), Infinity);
    const p = pos ?? (nodes.length ? { x: right + 80, y: top } : rf.screenToFlowPosition({ x: (wrap.current?.getBoundingClientRect().left ?? 0) + 200, y: (wrap.current?.getBoundingClientRect().top ?? 0) + 160 }));
    setNodes(ns => [...ns.map(n => ({ ...n, selected: false })), { id, type: data.kind, position: p, data, selected: true }]);
    sfx('drop');
    cam.forget();
    if (!pos) setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 30);
  };
  const addComp = (compId: string, pos?: { x: number; y: number }) => { const c = lib.components[compId]; add({ kind: 'component', compId, vprops: c.variants[0].props, texts: {} }, pos); };
  const addPattern = (patternId: string, pos?: { x: number; y: number }) => add({ kind: 'pattern', patternId, overrides: {} }, pos);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pid = e.dataTransfer.getData('application/x-ds-pattern'); if (pid) return addPattern(pid, pos);
    const id = e.dataTransfer.getData('application/x-ds-comp'); if (id) addComp(id, pos);
  };
  const loadTpl = (k: 'nav' | 'form' | 'dash') => { cam.forget(); const t = template(lib, k); setNodes(t.nodes); setEdges(t.edges); setTimeout(() => rf.fitView({ padding: 0.15 }), 50); };

  const exportPatterns = () => {
    const blob = new Blob([JSON.stringify({ schema: 1, fileKey: libId(lib), library: lib.file.name, patterns: Object.values(patterns) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'patterns.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const importPatterns = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as { schema: number; fileKey: string; patterns: Pattern[] };
      if (j.schema !== 1 || !Array.isArray(j.patterns)) throw new Error('unexpected format');
      if (j.fileKey !== libId(lib)) throw new Error('these patterns come from another Figma library');
      const valid = j.patterns.filter(p => p && p.id && p.name && p.root?.kind === 'stack');
      setPatterns(ps => ({ ...ps, ...Object.fromEntries(valid.map(p => [p.id, p])) }));
      setIoMsg(`${valid.length} pattern(s) imported.`);
    } catch (e) { setIoMsg(`Import failed: ${(e as Error).message}`); }
  };
  const deletePattern = (id: string) => { if (confirm(`Delete pattern "${patterns[id]?.name}"? Its instances on the canvas will show "Pattern deleted".`)) setPatterns(ps => { const n = { ...ps }; delete n[id]; return n; }); };

  const selected = nodes.filter(n => n.selected);
  const current = selected.length === 1 ? selected[0] : null;
  // Désélection partagée (Clear, Échap, fermeture de l'inspecteur) : nodes et liens.
  const deselect = useCallback(() => {
    setNodes(ns => (ns.some(n => n.selected) ? ns.map(n => (n.selected ? { ...n, selected: false } : n)) : ns));
    setEdges(es => (es.some(e => e.selected) ? es.map(e => (e.selected ? { ...e, selected: false } : e)) : es));
  }, [setNodes, setEdges]);
  // Supprime les nodes sélectionnés et leurs liens (même effet que Suppr / ⌫ sur le canvas).
  const removeSelected = () => {
    const ids = new Set(selected.map(n => n.id));
    setNodes(ns => ns.filter(n => !ids.has(n.id)));
    setEdges(es => es.filter(e => !ids.has(e.source) && !ids.has(e.target)));
  };
  // Échap : désélectionne (hors champs de saisie).
  const hasAnySel = selected.length > 0 || edges.some(e => e.selected);
  useEffect(() => {
    if (!hasAnySel) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== 'Escape' || t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      deselect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasAnySel, deselect]);
  // Caméra : léger rapprochement au premier clic sur un node, retour en douceur à la désélection.
  const hasSel = selected.length > 0;
  useEffect(() => { if (!hasSel) cam.release(); }, [hasSel, cam]);
  // Attendre que l'inspecteur ait réduit le canvas pour viser son nouveau centre.
  const onNodeClick = (_: unknown, n: BNode) => { window.setTimeout(() => cam.nudge(n.id), 60); };
  // Liens : immobiles au repos ; une impulsion au survol ou à la sélection. Au survol, le reste s'estompe
  // (pas à la sélection, pour ne pas gêner l'édition).
  const hover = useFocus();
  const fid = hover.focus ?? current?.id ?? null;
  const linked = (e: Edge) => !!fid && (e.source === fid || e.target === fid);
  const near = hover.focus ? new Set([hover.focus, ...edges.filter(linked).flatMap(e => [e.source, e.target])]) : null;
  // Clés d'impulsion distinctes : une par survol, une par changement réel de sélection (la fin d'un survol ne rejoue rien).
  const [selPulse, setSelPulse] = useState({ id: current?.id ?? null, n: 0 });
  if (selPulse.id !== (current?.id ?? null)) setSelPulse({ id: current?.id ?? null, n: nextPulse() });
  const pulseKey = hover.focus ? `h${hover.pulse}` : current ? `s${selPulse.n}` : 0;
  const vNodes = near ? nodes.map(n => ({ ...n, className: n.id === hover.focus ? 'focus' : near.has(n.id) ? '' : 'dim' })) : nodes;
  const screenNode = nodes.find(n => n.data.kind === 'screen');
  // Simulation : le breakpoint suit la largeur de l'Écran (une seule source de vérité) ; sans Écran, il est libre.
  const bp = screenNode && screenNode.data.kind === 'screen' ? bpOf(screenNode.data.width) : logic.bp;
  const env: Env = useMemo(() => ({ lib, vars: logic.vars, values: logic.values, bp, modes }), [lib, logic.vars, logic.values, bp, modes]);
  const setBp = (b: Breakpoint) => { if (screenNode) update(screenNode.id, { width: BREAKPOINTS.find(x => x.id === b)!.width }); setLogic(l => ({ ...l, bp: b })); };
  const usage = (varId: string) => nodes.filter(n => { const s = n.data.kind === 'if' || n.data.kind === 'show' ? n.data.cond.subject : n.data.kind === 'switch' ? n.data.subject : undefined; return s?.src === 'var' && s.id === varId; }).length;
  // Branches non retenues par la simulation : leurs liens s'estompent.
  const idle = (e: Edge) => { const t = nodes.find(n => n.id === e.target); return !!t && isLogic(t.data) && activeHandle(env, t.data) !== e.targetHandle; };
  const vEdges = edges.map(e => {
    const on = !!fid && linked(e), off = idle(e);
    return fid || off ? { ...e, data: { ...e.data, hot: on, dim: off || (!!near && !on), pulse: on ? pulseKey : 0 } } : e;
  });
  const renderable = Object.values(lib.components).filter(c => c.variants.length);

  return (
    <BuilderCtx.Provider value={{ lib, modes, patterns, update, remove, savePattern, detach, env, dropEdges, slotPicks, setSlotPicks, fillSlot }}>
      <div className="builder" data-inspector={!!current}>
        <nav className="sidebar">
          <span className="side-title">Templates</span>
          <div className="tpl-row">
            <button className="pill-btn" onClick={() => loadTpl('nav')}>Navbar · home</button>
            <button className="pill-btn" onClick={() => loadTpl('form')}>Form · submit</button>
            <button className="pill-btn" onClick={() => loadTpl('dash')}>Dashboard · actions</button>
          </div>
          <span className="side-title">Layout</span>
          <div className="tpl-row">
            <button className="pill-btn" onClick={() => add({ kind: 'stack', name: 'Stack', dir: 'H', justify: 'start', align: 'center', gap: varId(lib, 'Space/300', 'Gap/sm') })}>+ Stack</button>
            {!screenNode && <button className="pill-btn" onClick={() => add({ kind: 'screen', name: 'Screen', width: 1280, bg: varId(lib, 'Background/Default/Default', 'Background/page'), pad: varId(lib, 'Space/800', 'Padding/xl') })}>+ Screen</button>}
            <details className="more-menu">
              <summary className="pill-btn" aria-label="More actions" title="More actions">⋯</summary>
              <div className="more-pop">
                <button onClick={e => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; if (confirm('Clear the canvas? Nodes and links will be removed (saved patterns are kept).')) { cam.forget(); setNodes([]); setEdges([]); } }}>Clear canvas…</button>
              </div>
            </details>
          </div>
          <span className="side-title">Logic</span>
          <div className="tpl-row">
            <button className="pill-btn" title="Two inputs: shows one when the condition is true, the other when false" onClick={() => add({ kind: 'if', name: 'If', cond: { op: 'eq', value: '' } })}>+ If</button>
            <button className="pill-btn" title="One input per value, plus a default" onClick={() => add({ kind: 'switch', name: 'Router', cases: [{ id: uid('case'), value: '' }] })}>+ Router</button>
            <button className="pill-btn" title="One input, shown only when the condition is true" onClick={() => add({ kind: 'show', name: 'Show', cond: { op: 'eq', value: '' } })}>+ Show / Hide</button>
          </div>
          <span className="side-title">Patterns · {Object.keys(patterns).length}</span>
          {Object.values(patterns).length === 0 && <span className="note" style={{ padding: '0 4px', fontSize: 12 }}>Connect components to a Stack, select it, then click "Save" in its properties.</span>}
          {Object.values(patterns).map(p => {
            const t = buildTree([{ id: 'pv-' + p.id, type: 'pattern', position: { x: 0, y: 0 }, data: { kind: 'pattern', patternId: p.id, overrides: {} } }], [], 'pv-' + p.id, patterns);
            return (
              <div key={p.id} className="palette-item pattern" draggable onDragStart={e => { sfx('grab'); e.dataTransfer.setData('application/x-ds-pattern', p.id); e.dataTransfer.effectAllowed = 'move'; }} onDoubleClick={() => addPattern(p.id)} title="Drag onto the canvas, or double-click">
                <div className="pv" style={{ justifyContent: 'flex-start', padding: 8 }}><div style={{ zoom: 0.45 }}>{t && <Live t={t} />}</div></div>
                <span className="nm"><span>◇ {p.name}</span><button className="link-btn" onClick={() => deletePattern(p.id)} aria-label={`Delete pattern ${p.name}`}>Delete</button></span>
              </div>
            );
          })}
          <div className="tpl-row">
            <button className="pill-btn" onClick={exportPatterns} disabled={!Object.keys(patterns).length}>Export</button>
            <button className="pill-btn" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept="application/json" hidden onChange={e => { if (e.target.files?.[0]) void importPatterns(e.target.files[0]); e.target.value = ''; }} />
          </div>
          {ioMsg && <span className="note" style={{ fontSize: 12 }}>{ioMsg}</span>}
          <span className="side-title">Components · drag onto the canvas</span>
          {renderable.map(c => (
            <div key={c.id} className="palette-item" draggable onDragStart={e => { sfx('grab'); e.dataTransfer.setData('application/x-ds-comp', c.id); e.dataTransfer.effectAllowed = 'move'; }} onDoubleClick={() => addComp(c.id)} title="Drag onto the canvas, or double-click">
              <div className="pv"><Preview lib={lib} tree={c.variants[0].tree} w={214} h={64} /></div>
              <span className="nm"><span>{c.name}</span><span className="mono" style={{ color: 'var(--mute)', fontWeight: 500 }}>{c.variants.length} var.</span></span>
            </div>
          ))}
        </nav>
        <div ref={wrap} className="stage" onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
          <ReactFlow nodes={vNodes} edges={vEdges} onNodeMouseEnter={(_, n) => hover.enter(n.id)} onNodeMouseLeave={hover.leave} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStart={() => sfx('grab')} onNodeDragStop={() => sfx('drop')} onNodeClick={onNodeClick} onMove={e => { if (e) cam.forget(); }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.1} maxZoom={3} zoomOnScroll={false} panOnScroll zoomOnPinch zoomOnDoubleClick={false} deleteKeyCode={['Backspace', 'Delete']}
            selectionOnDrag panOnDrag={[1]} panActivationKeyCode="Space" selectionMode={SelectionMode.Partial} multiSelectionKeyCode={['Shift', 'Meta', 'Control']} proOptions={{ hideAttribution: true }}>
            <Background gap={22} size={1} color="var(--line)" />
            <ZoomBar />
          </ReactFlow>
          <Simulator env={env} usage={usage} hasLogic={nodes.some(n => isLogic(n.data))} setVars={f => setLogic(l => ({ ...l, vars: f(l.vars) }))} setValue={(id, x) => setLogic(l => ({ ...l, values: { ...l.values, [id]: x } }))}
            setBp={setBp} setMode={(c, m) => setModes(ms => ({ ...ms, [c]: m }))} />
          {selected.length > 1
            ? <div className="sel-bar" role="toolbar" aria-label="Selection">
                <span><strong>{selected.length}</strong> nodes selected</span>
                <button className="pill-btn" onClick={removeSelected} title="Delete the selected nodes and their links (Delete / ⌫)">Delete</button>
                <button className="link-btn" onClick={deselect} title="Clear selection (Esc)">Clear</button>
              </div>
            : <div className="hint"><span><span className="dot v" />{current ? 'Properties on the right · Delete to remove the node' : 'Drag to select · Space + drag or two fingers to pan · pinch or ⌘/Ctrl + scroll to zoom'}</span></div>}
        </div>
        {current && <Inspector node={current} nodes={nodes} edges={edges} onClose={deselect} />}
      </div>
    </BuilderCtx.Provider>
  );
}

export function Builder({ lib, modes, setModes }: { lib: Library; modes: Modes; setModes: (f: (m: Modes) => Modes) => void }) {
  return <ReactFlowProvider key={libId(lib)}><Canvas lib={lib} modes={modes} setModes={setModes} /></ReactFlowProvider>;
}
