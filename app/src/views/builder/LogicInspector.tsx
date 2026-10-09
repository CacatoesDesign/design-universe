import type { Edge } from '@xyflow/react';
import { useBuilder } from './context';
import type { BNode } from './compose';
import {
  caseExpr, condExpr, evalCond, newLogicUse, OPS, opsFor, subjectInfo, subjectKey, subjects, switchPick,
  type Cond, type IfData, type ShowData, type Subject, type SubjectInfo, type SwitchData,
} from './logic';

const uid = () => 'case-' + Math.random().toString(36).slice(2, 8);

/** Menu des sujets testables, groupés : variables, viewport, modes Figma. */
function SubjectSelect({ value, onChange }: { value?: Subject; onChange: (s: SubjectInfo | undefined) => void }) {
  const { lib, env } = useBuilder();
  const all = subjects(lib, env.vars);
  const groups = [
    { label: 'Variables', items: all.filter(s => s.subject.src === 'var') },
    { label: 'Viewport', items: all.filter(s => s.subject.src === 'bp') },
    { label: 'Figma modes', items: all.filter(s => s.subject.src === 'mode') },
  ].filter(g => g.items.length);
  const key = subjectKey(value);
  const missing = !!value && !all.some(s => s.key === key);
  return (
    <label className="row">Test
      <select value={missing ? '' : key} onChange={e => onChange(all.find(s => s.key === e.target.value))}>
        <option value="">{missing ? 'Missing variable' : '—'}</option>
        {groups.map(g => <optgroup key={g.label} label={g.label}>{g.items.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>)}
      </select>
    </label>
  );
}

/** Champ de valeur : liste des valeurs connues (booléen, enum, breakpoint, mode) ou nombre libre. */
function ValueField({ info, value, onChange, label = 'Value' }: { info?: SubjectInfo; value: string; onChange: (v: string) => void; label?: string }) {
  if (info && info.type !== 'number') return (
    <label className="row">{label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        {!info.values.includes(value) && <option value={value}>{value || '—'}</option>}
        {info.values.map(v => <option key={v}>{v}</option>)}
      </select>
    </label>
  );
  return <label className="row">{label}<input type={info ? 'number' : 'text'} value={value} disabled={!info} onChange={e => onChange(e.target.value)} /></label>;
}

function CondEditor({ cond, onChange }: { cond: Cond; onChange: (c: Cond) => void }) {
  const { lib, env } = useBuilder();
  const info = subjectInfo(lib, env.vars, cond.subject);
  const ops = info ? opsFor(info.type) : (['eq'] as const);
  return (
    <>
      <SubjectSelect value={cond.subject} onChange={s => onChange({ subject: s?.subject, op: 'eq', value: s ? (s.type === 'number' ? '0' : s.values[0] ?? '') : '' })} />
      <label className="row">Operator
        <select value={cond.op} disabled={!info} onChange={e => onChange({ ...cond, op: e.target.value as Cond['op'] })}>
          {ops.map(o => <option key={o} value={o}>{info?.type === 'number' ? OPS[o] : o === 'eq' ? 'is' : 'is not'}</option>)}
        </select>
      </label>
      <ValueField info={info} value={cond.value} onChange={value => onChange({ ...cond, value })} />
      {!env.vars.length && <span className="note">Add state variables (isLoggedIn, role…) in the Simulate panel, or test the breakpoint or a Figma mode.</span>}
    </>
  );
}

/** Ce qui est relié à chaque entrée, et laquelle la simulation affiche. */
function Inputs({ id, rows, nodes, edges }: { id: string; rows: { h: string; label: string; on: boolean }[]; nodes: BNode[]; edges: Edge[] }) {
  const { lib, patterns } = useBuilder();
  // Composant : son nom suivi de son premier texte saisi (« Button · Log in »), pour distinguer deux instances.
  const name = (n?: BNode) => {
    if (!n) return null;
    if (n.data.kind === 'component') { const t = Object.values(n.data.texts)[0]; return [lib.components[n.data.compId]?.name, t].filter(Boolean).join(' · '); }
    return n.data.kind === 'pattern' ? patterns[n.data.patternId]?.name : n.data.name;
  };
  return (
    <div className="sec">
      <span className="sec-t">Inputs</span>
      <div className="logic-inputs">
        {rows.map(r => {
          const src = name(nodes.find(n => n.id === edges.find(e => e.target === id && e.targetHandle === r.h)?.source));
          return (
            <div key={r.h} data-on={r.on}>
              <span className="bl">{r.label}</span>
              {src ? <span className="fig-var">{src}</span> : <span className="note">nothing connected (renders nothing)</span>}
              {r.on && <span className="bnow">shown</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CodeLine({ code }: { code: string }) {
  return <div className="sec"><span className="sec-t">Code</span><div className="code">{code}</div></div>;
}

export function IfInspector({ id, data, nodes, edges }: { id: string; data: IfData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, env, update } = useBuilder();
  const on = evalCond(env, data.cond);
  return (
    <>
      <div className="sec bnode-form">
        <span className="sec-t">Condition</span>
        <label className="row">Name<input value={data.name} onChange={e => update(id, { name: e.target.value })} /></label>
        <CondEditor cond={data.cond} onChange={cond => update(id, { cond })} />
      </div>
      <Inputs id={id} nodes={nodes} edges={edges} rows={[{ h: 'then', label: 'then', on }, { h: 'else', label: 'else', on: !on }]} />
      <CodeLine code={`{${condExpr(lib, env.vars, data.cond, newLogicUse())} ? <Then /> : <Else />}`} />
    </>
  );
}

export function ShowInspector({ id, data, nodes, edges }: { id: string; data: ShowData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, env, update } = useBuilder();
  const on = evalCond(env, data.cond);
  return (
    <>
      <div className="sec bnode-form">
        <span className="sec-t">Show when</span>
        <label className="row">Name<input value={data.name} onChange={e => update(id, { name: e.target.value })} /></label>
        <CondEditor cond={data.cond} onChange={cond => update(id, { cond })} />
      </div>
      <Inputs id={id} nodes={nodes} edges={edges} rows={[{ h: 'in', label: on ? 'content' : 'content · hidden', on }]} />
      <CodeLine code={`{${condExpr(lib, env.vars, data.cond, newLogicUse())} && <Content />}`} />
    </>
  );
}

export function SwitchInspector({ id, data, nodes, edges }: { id: string; data: SwitchData; nodes: BNode[]; edges: Edge[] }) {
  const { lib, env, update, dropEdges } = useBuilder();
  const info = subjectInfo(lib, env.vars, data.subject);
  const pick = switchPick(env, data);
  const setCase = (cid: string, value: string) => update(id, { cases: data.cases.map(k => (k.id === cid ? { ...k, value } : k)) });
  // Nouveau cas : la première valeur connue pas encore utilisée.
  const next = () => info?.values.find(v => !data.cases.some(k => k.value === v)) ?? '';
  const use = newLogicUse();
  return (
    <>
      <div className="sec bnode-form">
        <span className="sec-t">Route by</span>
        <label className="row">Name<input value={data.name} onChange={e => update(id, { name: e.target.value })} /></label>
        <SubjectSelect value={data.subject} onChange={s => update(id, { subject: s?.subject, cases: data.cases.map((k, i) => ({ ...k, value: s?.values[i] ?? (s?.type === 'number' ? String(i) : '') })) })} />
      </div>
      <div className="sec bnode-form">
        <span className="sec-t">Cases · {data.cases.length} + default</span>
        {data.cases.map((k, i) => (
          <div className="case-row" key={k.id}>
            <ValueField info={info} value={k.value} label={`Case ${i + 1}`} onChange={v => setCase(k.id, v)} />
            <button className="x-btn" aria-label={`Remove case ${i + 1}`} title="Remove case (its link is removed too)" onClick={() => { dropEdges(id, k.id); update(id, { cases: data.cases.filter(x => x.id !== k.id) }); }}>×</button>
          </div>
        ))}
        <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => update(id, { cases: [...data.cases, { id: uid(), value: next() }] })}>+ Case</button>
        <span className="note">The first matching case wins; otherwise the default input is shown.</span>
      </div>
      <Inputs id={id} nodes={nodes} edges={edges} rows={[...data.cases.map(k => ({ h: k.id, label: k.value || 'empty', on: pick === k.id })), { h: 'default', label: 'default', on: pick === 'default' }]} />
      <CodeLine code={data.cases.length ? `{${data.cases.map((k, i) => `${caseExpr(lib, env.vars, data.subject, k.value, use)} ? <Case${i + 1} />`).join(' : ')} : <Default />}` : '{<Default />}'} />
    </>
  );
}
