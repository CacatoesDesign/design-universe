import { useMemo, useState } from 'react';
import { pickKey, slotHandle, slotNodes, suggestions } from '../../lib/slots';
import { slotPropId } from '../../lib/codegen';
import type { Edge } from '@xyflow/react';
import { FigmaRender } from '../../render/FigmaRender';
import { findVariant, formatValue, resolveVar, variantAxes, zonesOf } from '../../lib/library';
import { pascal } from '../../lib/codegen';
import { buildTree, compAttrs, generateScreen, slotsOf, textNodes, variantOf, type BNode, type CompData, type PatternData, type ScreenData, type StackData } from './compose';
import { Live, useBuilder, VarSelect } from './context';
import { PanelModeButton } from '../../components/PanelModeButton';
import { FilledPreview } from './nodes';
import { IfInspector, ShowInspector, SwitchInspector } from './LogicInspector';

type Code = ReturnType<typeof generateScreen>;

/** Inspecteur du node sélectionné : ses propriétés et les infos utiles (tokens, liens, code). */
export function Inspector({ node, nodes, edges, onClose }: { node: BNode; nodes: BNode[]; edges: Edge[]; onClose: () => void }) {
  const { lib, patterns, remove } = useBuilder();
  const d = node.data;
  const head = d.kind === 'component' ? { eyebrow: `Component · page ${lib.components[d.compId]?.page ?? '?'}`, title: lib.components[d.compId]?.name ?? 'Component not found' }
    : d.kind === 'stack' ? { eyebrow: 'Stack · layout', title: d.name }
    : d.kind === 'pattern' ? { eyebrow: 'Pattern · instance', title: patterns[d.patternId]?.name ?? 'Pattern deleted' }
    : d.kind === 'if' ? { eyebrow: 'Logic · if / else', title: d.name }
    : d.kind === 'switch' ? { eyebrow: 'Logic · router', title: d.name }
    : d.kind === 'show' ? { eyebrow: 'Logic · show / hide', title: d.name }
    : { eyebrow: 'Screen', title: d.name };
  const parents = edges.filter(e => e.source === node.id).map(e => nodes.find(n => n.id === e.target)).filter(Boolean) as BNode[];
  const label = (n: BNode) => n.data.kind === 'component' ? lib.components[n.data.compId]?.name : n.data.kind === 'pattern' ? patterns[n.data.patternId]?.name : n.data.name;

  return (
    <aside className="inspector" aria-label="Selected node properties">
      <div className="panel-head">
        <div className="t" key={node.id} style={{ animation: 'rowIn .3s ease-out both' }}><span className="eyebrow">{head.eyebrow}</span><span className="panel-title">{head.title}</span></div>
        <PanelModeButton />
        <button className="x-btn" onClick={onClose} aria-label="Close inspector">×</button>
      </div>
      <div className="panel-body" key={node.id}>
        {d.kind === 'component' && <CompInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind === 'stack' && <StackInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind === 'pattern' && <PatternInspector id={node.id} data={d} nodes={nodes} />}
        {d.kind === 'if' && <IfInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind === 'switch' && <SwitchInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind === 'show' && <ShowInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind === 'screen' && <ScreenInspector id={node.id} data={d} nodes={nodes} edges={edges} />}
        {d.kind !== 'screen' && (
          <div className="sec">
            <span className="sec-t">Connected to</span>
            {parents.length ? <div className="used-by">{parents.map(p => <span key={p.id} className="fig-var">{label(p)}</span>)}</div>
              : <span className="note">Nothing yet: connect its output (●) to the input of a Stack, the Screen or a logic node.</span>}
          </div>
        )}
        <div className="sec"><button className="pill-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { remove(node.id); onClose(); }}>Delete node</button></div>
      </div>
    </aside>
  );
}

function VariantFields({ data, onChange }: { data: CompData; onChange: (p: { vprops?: Record<string, string>; texts?: Record<string, string> }) => void }) {
  const { lib } = useBuilder();
  const c = lib.components[data.compId]; const v = variantOf(lib, data);
  if (!c || !v) return null;
  return (
    <>
      {Object.entries(variantAxes(c)).map(([ax, vals]) => (
        <label className="row" key={ax}>{ax}
          <select value={v.props[ax]} onChange={e => { const next = { ...v.props, [ax]: e.target.value }; onChange({ vprops: findVariant(c, next) ? next : c.variants.find(x => x.props[ax] === e.target.value)!.props }); }}>
            {vals.map(x => <option key={x}>{x}</option>)}
          </select>
        </label>
      ))}
      {textNodes(v.tree).map((t, i, all) => (
        <label className="row" key={t.path}>{all.length > 1 ? `Text ${i + 1}` : 'Text'}
          <input value={data.texts[t.path] ?? t.text} onChange={e => onChange({ texts: { ...data.texts, [t.path]: e.target.value } })} />
        </label>
      ))}
    </>
  );
}

function CompInspector({ id, data, nodes, edges }: { id: string; data: CompData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, modes, update } = useBuilder();
  const c = lib.components[data.compId]; const v = variantOf(lib, data);
  if (!c || !v) return <span className="note">This component doesn't exist in the loaded library.</span>;
  const k = Math.min(1.6, 360 / v.tree.w, 140 / v.tree.h);
  const tokens = zonesOf(v.tree).filter(z => z.varId);
  return (
    <>
      <div className="preview" style={{ height: Math.max(80, v.tree.h * k + 24) }}><div style={{ transform: `scale(${k})`, flex: 'none' }}>{edges.some(e => e.target === id && e.targetHandle?.startsWith('slot:')) ? <FilledPreview id={id} /> : <FigmaRender node={v.tree} opts={{ lib, texts: data.texts }} />}</div></div>
      <div className="sec bnode-form">
        <span className="sec-t">Properties</span>
        <VariantFields data={data} onChange={p => update(id, p)} />
      </div>
      <SlotsSection id={id} data={data} nodes={nodes} edges={edges} />
      <div className="sec">
        <span className="sec-t">Bound tokens · {tokens.length}</span>
        <div className="tok-list">
          {tokens.map(z => {
            const r = resolveVar(lib, z.varId!, modes); const color = typeof r.value === 'string' && r.value.startsWith('#') ? r.value : null;
            return <div key={z.key}><span>{z.label}</span><span className="fig-var">{color && <span className="sw" style={{ background: color }} />}{lib.variables[z.varId!]?.name ?? z.varId}</span><span className="mono">{formatValue(r.value, r.steps.at(-1)?.v.type)}</span></div>;
          })}
        </div>
      </div>
      <div className="sec">
        <span className="sec-t">Instance code</span>
        <div className="code">{`<${pascal(c.name)} ${[...compAttrs(lib, data), ...slotNodes(v.tree).filter(sl => edges.some(e => e.target === id && e.targetHandle === slotHandle(sl.name))).map(sl => `${slotPropId(c, sl.name)}={…}`)].join(' ')} />`}</div>
      </div>
      {c.description && <details className="sec"><summary className="sec-t" style={{ cursor: 'pointer' }}>Figma documentation</summary><div className="desc">{c.description}</div></details>}
    </>
  );
}

/**
 * Slots du composant. Contenu Figma par défaut : rien à faire (il s'affiche). Slot vide : on propose d'abord
 * les « preferred instances » de Figma, sinon les composants que l'utilisateur a choisis pour ce slot (mémorisés).
 */
function SlotsSection({ id, data, nodes, edges }: { id: string; data: CompData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, slotPicks, fillSlot } = useBuilder();
  const c = lib.components[data.compId]; const v = variantOf(lib, data);
  const list = v ? slotNodes(v.tree) : [];
  if (!c || !list.length) return null;
  return (
    <div className="sec">
      <span className="sec-t">Slots · {list.length}</span>
      {list.map(sl => {
        const linked = edges.filter(e => e.target === id && e.targetHandle === slotHandle(sl.name)).map(e => nodes.find(n => n.id === e.source)).filter(Boolean) as BNode[];
        const sug = suggestions(lib, c.id, sl.name, slotPicks);
        const desc = c.slots?.find(x => x.name === sl.name)?.desc;
        return (
          <div className="slot-card" key={sl.name}>
            <div className="slot-hd"><span>▢ {sl.name}</span><span className="note">{linked.length ? `${linked.length} item${linked.length > 1 ? 's' : ''} · replaces Figma content` : sl.empty ? 'Empty in Figma' : `Figma content · ${sl.layers} layer${sl.layers > 1 ? 's' : ''}`}</span></div>
            {desc && <span className="note">{desc}</span>}
            {linked.length > 0 && <div className="used-by">{linked.map(n => <span key={n.id} className="fig-var">{n.data.kind === 'component' ? lib.components[n.data.compId]?.name : 'name' in n.data ? String(n.data.name) : n.data.kind}</span>)}</div>}
            {sug.ids.length > 0 && (
              <>
                <span className="note">{sug.source === 'figma' ? 'Preferred instances (from Figma) · click to add' : 'Your components for this slot · click to add'}</span>
                <div className="slot-chips">{sug.ids.map(cid => <button type="button" key={cid} onClick={() => fillSlot(id, sl.name, cid)} title={`Add ${lib.components[cid].name} to ${sl.name}`}>+ {lib.components[cid].name}</button>)}</div>
              </>
            )}
            {sug.source === 'none' && sl.empty && !linked.length && <span className="note">Figma declares no preferred instances for this slot. Choose the components to offer here; the choice is remembered for this slot.</span>}
            {sug.source !== 'figma' && <SlotPicker compId={c.id} slot={sl.name} open={sug.source === 'none' && sl.empty && !linked.length} />}
            {sug.source === 'figma' && <span className="note">Other content: connect any node to the ▢ {sl.name} input on the canvas.</span>}
          </div>
        );
      })}
      <span className="note">Order inside a slot follows the canvas (top → bottom).</span>
    </div>
  );
}

/** Choix des composants proposés pour un slot, parmi ceux de la lib (le composant lui-même exclu). */
function SlotPicker({ compId, slot, open }: { compId: string; slot: string; open: boolean }) {
  const { lib, slotPicks, setSlotPicks } = useBuilder();
  const key = pickKey(compId, slot);
  const chosen = slotPicks[key] ?? [];
  const [q, setQ] = useState('');
  // Ouvert d'office quand il faut choisir ; reste ouvert pendant qu'on coche (l'état ne suit plus la prop ensuite).
  const [isOpen, setOpen] = useState(open);
  const all = useMemo(() => Object.values(lib.components).filter(x => x.variants.length && x.id !== compId).sort((a, b) => (a.group || a.page).localeCompare(b.group || b.page) || a.name.localeCompare(b.name)), [lib, compId]);
  const shown = all.filter(x => !q || `${x.name} ${x.group ?? ''} ${x.page}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setSlotPicks(key, chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id]);
  return (
    <details className="slot-picker" open={isOpen} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary className="link-btn" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>{chosen.length ? `Edit components (${chosen.length})…` : 'Choose components…'}</summary>
      <input type="search" aria-label={`Search components for slot ${slot}`} placeholder="Search components" value={q} onChange={e => setQ(e.target.value)} />
      <ul>
        {shown.map(x => (
          <li key={x.id}><label><input type="checkbox" checked={chosen.includes(x.id)} onChange={() => toggle(x.id)} />{x.name}<span className="grp">{x.group || x.page}</span></label></li>
        ))}
        {!shown.length && <li className="note">No component matches.</li>}
      </ul>
    </details>
  );
}

function StackInspector({ id, data, nodes, edges }: { id: string; data: StackData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, patterns, update, savePattern } = useBuilder();
  const u = (p: Partial<StackData>) => update(id, p);
  const [name, setName] = useState(data.name);
  const [msg, setMsg] = useState('');
  const tree = buildTree(nodes, edges, id, patterns);
  const kids = tree && tree.kind === 'stack' ? tree.children : [];
  return (
    <>
      <div className="sec bnode-form">
        <span className="sec-t">Layout</span>
        <label className="row">Name<input value={data.name} onChange={e => u({ name: e.target.value })} /></label>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          <button aria-pressed={data.dir === 'H'} onClick={() => u({ dir: 'H' })}>→ Horizontal</button>
          <button aria-pressed={data.dir === 'V'} onClick={() => u({ dir: 'V' })}>↓ Vertical</button>
        </div>
        <VarSelect label="Gap" prefix={/^(Gap|Space)\/(?!Negative)/} value={data.gap} onChange={gap => u({ gap })} />
        <VarSelect label="Padding" prefix={/^(Padding|Space)\/(?!Negative)/} value={data.pad} onChange={pad => u({ pad })} />
        <VarSelect label="Background" prefix={/^(Background|Surface)\//} value={data.bg} onChange={bg => u({ bg })} />
        <VarSelect label="Radius" prefix={/^Radius\//} value={data.radius} onChange={radius => u({ radius })} />
        <label className="row">Justify<select value={data.justify} onChange={e => u({ justify: e.target.value as StackData['justify'] })}>{['start', 'center', 'end', 'space-between'].map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="row">Align<select value={data.align} onChange={e => u({ align: e.target.value as StackData['align'] })}>{['start', 'center', 'end', 'stretch'].map(x => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="sec">
        <span className="sec-t">Content · {kids.length}</span>
        {kids.length ? <div className="preview" style={{ padding: 12, justifyContent: 'flex-start', overflow: 'hidden' }}><div style={{ zoom: 0.7 }}>{tree && <Live t={tree} />}</div></div>
          : <span className="note">Connect components to this Stack's input. Order follows their position on the canvas ({data.dir === 'H' ? 'left → right' : 'top → bottom'}).</span>}
      </div>
      <div className="sec bnode-form">
        <span className="sec-t">Pattern</span>
        <span className="note">Save this Stack and everything connected to it as a reusable block. An existing name updates the pattern, and all its instances follow.</span>
        <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); const n = name.trim(); if (n) setMsg(savePattern(id, n) ?? ''); }}>
          <input aria-label="Pattern name" value={name} onChange={e => setName(e.target.value)} placeholder="Pattern name" />
          <button className="pill-btn" type="submit" disabled={!kids.length}>◇ Save</button>
        </form>
        {msg && <span className="note" style={{ color: 'var(--violet-ink)' }}>{msg}</span>}
        {!!Object.keys(patterns).length && <span className="note">Patterns in library {lib.file.name.replace(/^\[LIB\]\s*/, '')}: {Object.values(patterns).map(p => p.name).join(', ')}</span>}
      </div>
    </>
  );
}

function PatternInspector({ id, data, nodes }: { id: string; data: PatternData; nodes: BNode[] }) {
  const { lib, patterns, update, detach } = useBuilder();
  const p = patterns[data.patternId];
  if (!p) return <span className="note">This pattern was deleted from the palette.</span>;
  const slots = slotsOf(lib, p);
  const tree = buildTree([{ id, type: 'pattern', position: { x: 0, y: 0 }, data }], [], id, patterns);
  const count = nodes.filter(n => n.data.kind === 'pattern' && n.data.patternId === p.id).length;
  return (
    <>
      <div className="preview" style={{ padding: 12, justifyContent: 'flex-start', overflow: 'hidden' }}><div style={{ zoom: 0.8 }}>{tree && <Live t={tree} />}</div></div>
      {slots.map(sl => {
        const c = lib.components[sl.data.compId]; if (!c) return null;
        const o = data.overrides[sl.index] ?? {};
        const cur: CompData = { ...sl.data, vprops: { ...sl.data.vprops, ...o.vprops }, texts: { ...sl.data.texts, ...o.texts } };
        return (
          <div className="sec bnode-form" key={sl.index}>
            <span className="sec-t">{sl.name} · {c.name}</span>
            <VariantFields data={cur} onChange={patch => update(id, { overrides: { ...data.overrides, [sl.index]: { vprops: { ...o.vprops, ...patch.vprops }, texts: { ...o.texts, ...patch.texts } } } })} />
          </div>
        );
      })}
      <div className="sec">
        <span className="sec-t">Pattern</span>
        <span className="note">{count} instance(s) on this canvas. To edit the pattern itself: detach this instance, edit its Stacks and components, then save it again under the same name.</span>
        <button className="pill-btn" style={{ alignSelf: 'flex-start' }} onClick={() => detach(id)}>Detach</button>
      </div>
    </>
  );
}

function ScreenInspector({ id, data, nodes, edges }: { id: string; data: ScreenData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, patterns, update, env } = useBuilder();
  const [tab, setTab] = useState<'preview' | 'jsx' | 'css' | 'files'>('preview');
  const [copied, setCopied] = useState('');
  const tree = buildTree(nodes, edges, id, patterns);
  const code: Code | null = tree ? generateScreen(lib, tree, env.vars) : null;
  const copy = (k: string, t: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1400); });
  return (
    <>
      <div className="sec bnode-form">
        <span className="sec-t">Screen</span>
        <label className="row">Name<input value={data.name} onChange={e => update(id, { name: e.target.value })} /></label>
        <label className="row">Width<select value={data.width} onChange={e => update(id, { width: +e.target.value })}><option value={1280}>Desktop · 1280</option><option value={768}>Tablet · 768</option><option value={390}>Mobile · 390</option></select></label>
        <VarSelect label="Background" prefix={/^(Background|Surface)\//} value={data.bg} onChange={bg => update(id, { bg })} />
        <VarSelect label="Padding" prefix={/^(Padding|Space)\/(?!Negative)/} value={data.pad} onChange={pad => update(id, { pad })} />
        <VarSelect label="Gap" prefix={/^(Gap|Space)\/(?!Negative)/} value={data.gap} onChange={gap => update(id, { gap })} />
      </div>
      <div className="sec">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="seg">{(['preview', 'jsx', 'css', 'files'] as const).map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{{ preview: 'Preview', jsx: 'JSX', css: 'CSS', files: 'Files' }[t]}</button>)}</div>
          <span className="spacer" />
          {code && (tab === 'jsx' || tab === 'css') && <button className="pill-btn" onClick={() => copy(tab, tab === 'jsx' ? code.tsx : code.css)}>{copied === tab ? 'Copied ✓' : 'Copy'}</button>}
        </div>
        {tab === 'preview' && tree && <div className="screen-preview"><div style={{ zoom: Math.min(1, 370 / data.width), width: data.width }}><Live t={tree} /></div></div>}
        {tab === 'jsx' && code && <pre className="code">{code.tsx}</pre>}
        {tab === 'css' && code && <pre className="code">{code.css}</pre>}
        {tab === 'files' && code && (
          <>
            {code.hooks.map(h => <details key={h.name}><summary style={{ cursor: 'pointer', font: '600 13px/1.4 var(--ui)' }}>hooks/{h.name}.ts</summary><pre className="code" style={{ marginTop: 8 }}>{h.tsx}</pre></details>)}
            {code.patterns.map(p => <details key={p.id}><summary style={{ cursor: 'pointer', font: '600 13px/1.4 var(--ui)', color: 'var(--violet-ink)' }}>◇ patterns/{p.name}.tsx</summary><pre className="code" style={{ marginTop: 8 }}>{p.tsx}</pre><pre className="code" style={{ marginTop: 8 }}>{p.css}</pre></details>)}
            {code.components.map(c => <details key={c.id}><summary style={{ cursor: 'pointer', font: '600 13px/1.4 var(--ui)' }}>{c.name}.tsx · {c.base}.css</summary><pre className="code" style={{ marginTop: 8 }}>{c.tsx}</pre><pre className="code" style={{ marginTop: 8 }}>{c.css}</pre></details>)}
          </>
        )}
        {tab === 'preview' && <span className="note">Tokens resolved with the current modes. Figma fonts that are not installed fall back to Onest.</span>}
      </div>
    </>
  );
}
