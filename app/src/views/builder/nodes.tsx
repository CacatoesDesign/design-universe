import { Handle, Position, useEdges, useNodes, type NodeProps, type Node } from '@xyflow/react';
import { FigmaRender } from '../../render/FigmaRender';
import { In, Out } from '../explorer/FlowParts';
import { resolveVar } from '../../lib/library';
import { buildTree, variantOf, type BNode, type CompData, type PatternData, type ScreenData, type StackData } from './compose';
import { Live, useBuilder } from './context';
import { slotHandle, slotNodes, suggestions } from '../../lib/slots';
import { condLabel, evalCond, subjectInfo, switchPick, type IfData, type ShowData, type SwitchData } from './logic';

/* Nodes compacts : nom + aperçu. Leurs propriétés s'éditent dans l'inspecteur (node sélectionné). */

function CompNode({ id, data, selected }: NodeProps<Node<CompData>>) {
  const { lib, slotPicks } = useBuilder();
  const edges = useEdges();
  const c = lib.components[data.compId];
  const v = c ? variantOf(lib, data) : undefined;
  if (!c || !v) return <div className="fnode bnode"><Out />Component not found</div>;
  const filled = edges.some(e => e.target === id && e.targetHandle?.startsWith('slot:'));
  const k = Math.min(1, 216 / v.tree.w, 90 / v.tree.h);
  return (
    <div className="fnode bnode" data-selected={selected} style={{ width: 240 }}>
      <Out />
      <div className="hd"><span className="nm">{c.name}</span><span className="badge">Component</span></div>
      <div className="preview" style={{ height: Math.max(56, v.tree.h * k + 16) }}><div style={{ transform: `scale(${k})`, transformOrigin: 'center', flex: 'none' }}>{filled ? <FilledPreview id={id} /> : <FigmaRender node={v.tree} opts={{ lib, texts: data.texts }} />}</div></div>
      {Object.keys(v.props).length > 0 && <div className="uses-list">{Object.values(v.props).map((x, i) => <span key={i}>{x}</span>)}</div>}
      {/* Slots : une entrée par slot de la variante. Vide dans Figma et sans suggestion : à choisir dans l'inspecteur. */}
      {slotNodes(v.tree).length > 0 && (
        <div className="branches slots">
          {slotNodes(v.tree).map(sl => {
            const n = edges.filter(e => e.target === id && e.targetHandle === slotHandle(sl.name)).length;
            const status = n ? `${n} item${n > 1 ? 's' : ''}` : !sl.empty ? 'Figma content' : suggestions(lib, c.id, sl.name, slotPicks).source === 'none' ? 'empty · choose components' : 'empty';
            return (
              <div key={sl.name} className="branch slot" data-filled={n > 0} data-empty={!n && sl.empty}>
                <Handle type="target" position={Position.Left} id={slotHandle(sl.name)} />
                <span className="bdot" aria-hidden="true" /><span className="bl">▢ {sl.name}</span><span className="bnow">{status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Aperçu d'un composant dont des slots sont remplis : rendu live avec leur contenu (seulement dans ce cas, car il suit tout le graphe). */
export function FilledPreview({ id }: { id: string }) {
  const { patterns } = useBuilder();
  const nodes = useNodes() as BNode[]; const edges = useEdges();
  const t = buildTree(nodes, edges, id, patterns);
  return t ? <Live t={t} /> : null;
}

function StackNode({ data, selected }: NodeProps<Node<StackData>>) {
  const { lib } = useBuilder();
  const tok = (id?: string) => (id ? `${lib.variables[id]?.name} · ${resolveVar(lib, id).value}` : null);
  return (
    <div className="fnode bnode layout" data-selected={selected} style={{ width: 220 }}>
      <In /><Out />
      <div className="hd"><span className="nm">▤ {data.name}</span><span className="badge">Stack</span></div>
      <div className="uses-list">
        <span>{data.dir === 'H' ? '→ horizontal' : '↓ vertical'}</span>
        {tok(data.gap) && <span>gap {tok(data.gap)}</span>}
        {tok(data.pad) && <span>pad {tok(data.pad)}</span>}
        {data.justify !== 'start' && <span>{data.justify}</span>}
      </div>
    </div>
  );
}

function PatternNode({ id, data, selected }: NodeProps<Node<PatternData>>) {
  const { patterns } = useBuilder();
  const p = patterns[data.patternId];
  if (!p) return <div className="fnode bnode pattern" style={{ width: 240 }}><Out />Pattern deleted</div>;
  const tree = buildTree([{ id, type: 'pattern', position: { x: 0, y: 0 }, data }], [], id, patterns);
  return (
    <div className="fnode bnode pattern" data-selected={selected} style={{ width: 280 }}>
      <Out />
      <div className="hd"><span className="nm">◇ {p.name}</span><span className="badge">Pattern</span></div>
      <div className="preview" style={{ padding: 10, justifyContent: 'flex-start', overflow: 'hidden' }}><div style={{ zoom: 0.55 }}>{tree && <Live t={tree} />}</div></div>
    </div>
  );
}

function ScreenNode({ data, selected }: NodeProps<Node<ScreenData>>) {
  return (
    <div className="fnode bnode screen" data-selected={selected} style={{ width: 220 }}>
      <In />
      <div className="hd"><span className="nm">▢ {data.name}</span><span className="badge coral">Screen</span></div>
      <div className="uses-list"><span>{data.width}px</span><span className="txt">preview and code: select this node</span></div>
    </div>
  );
}

/* ---------- Logique : une ligne par entrée, la branche retenue par la simulation est marquée ---------- */

export function Branch({ h, label, on, filled }: { h: string; label: string; on: boolean; filled: boolean }) {
  return (
    <div className="branch" data-on={on} data-filled={filled}>
      <Handle type="target" position={Position.Left} id={h} />
      <span className="bdot" aria-hidden="true" /><span className="bl">{label}</span>{on && <span className="bnow">shown</span>}
    </div>
  );
}

/** Entrées déjà reliées d'un node logique (pour distinguer une branche vide). */
function useFilled(id: string) {
  const edges = useEdges();
  return (h: string) => edges.some(e => e.target === id && e.targetHandle === h);
}

export function IfNode({ id, data, selected }: NodeProps<Node<IfData>>) {
  const { lib, env } = useBuilder();
  const on = evalCond(env, data.cond), filled = useFilled(id);
  return (
    <div className="fnode bnode logic" data-selected={selected} style={{ width: 220 }}>
      <Out />
      <div className="hd"><span className="nm">⑂ {data.name}</span><span className="badge">If</span></div>
      <span className="cond">{condLabel(lib, env.vars, data.cond)}</span>
      <div className="branches">
        <Branch h="then" label="then" on={on} filled={filled('then')} />
        <Branch h="else" label="else" on={!on} filled={filled('else')} />
      </div>
    </div>
  );
}

export function SwitchNode({ id, data, selected }: NodeProps<Node<SwitchData>>) {
  const { lib, env } = useBuilder();
  const pick = switchPick(env, data), filled = useFilled(id);
  const info = subjectInfo(lib, env.vars, data.subject);
  return (
    <div className="fnode bnode logic" data-selected={selected} style={{ width: 220 }}>
      <Out />
      <div className="hd"><span className="nm">⇶ {data.name}</span><span className="badge">Router</span></div>
      <span className="cond">{info ? `by ${info.label}` : data.subject ? 'missing variable' : 'no subject'}</span>
      <div className="branches">
        {data.cases.map(k => <Branch key={k.id} h={k.id} label={k.value || 'empty'} on={pick === k.id} filled={filled(k.id)} />)}
        <Branch h="default" label="default" on={pick === 'default'} filled={filled('default')} />
      </div>
    </div>
  );
}

export function ShowNode({ id, data, selected }: NodeProps<Node<ShowData>>) {
  const { lib, env } = useBuilder();
  const on = evalCond(env, data.cond), filled = useFilled(id);
  return (
    <div className="fnode bnode logic" data-selected={selected} style={{ width: 220 }}>
      <Out />
      <div className="hd"><span className="nm">◑ {data.name}</span><span className="badge">Show</span></div>
      <span className="cond">when {condLabel(lib, env.vars, data.cond)}</span>
      <div className="branches"><Branch h="in" label={on ? 'content' : 'content · hidden'} on={on} filled={filled('in')} /></div>
    </div>
  );
}

export const nodeTypes = { component: CompNode, stack: StackNode, screen: ScreenNode, pattern: PatternNode, if: IfNode, switch: SwitchNode, show: ShowNode };
