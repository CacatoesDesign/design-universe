import { useState } from 'react';
import { BREAKPOINTS, modeCollections, varNameError, type Breakpoint, type Env, type StateVar, type VarType } from './logic';

const PREF = 'ds-graph-sim-open';
const readOpen = () => { try { const v = localStorage.getItem(PREF); return v === null ? null : v === '1'; } catch { return null; } };
const writeOpen = (v: boolean) => { try { localStorage.setItem(PREF, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
const uid = () => 'var-' + Math.random().toString(36).slice(2, 8);

/** Contrôle de valeur d'une variable selon son type. */
function ValueInput({ v, value, onChange, label }: { v: StateVar; value: string; onChange: (x: string) => void; label: string }) {
  if (v.type === 'boolean') return (
    <div className="seg sim-seg" role="group" aria-label={label}>
      {['true', 'false'].map(x => <button type="button" key={x} aria-pressed={value === x} onClick={() => onChange(x)}>{x}</button>)}
    </div>
  );
  if (v.type === 'enum') return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      {!v.options.includes(value) && <option value={value}>{value || '—'}</option>}
      {v.options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
  return <input aria-label={label} type="number" value={value} onChange={e => onChange(e.target.value)} />;
}

function VarEditor({ v, onSave, onDelete, onCancel, nameError }: { v: StateVar; onSave: (v: StateVar) => void; onDelete?: () => void; onCancel: () => void; nameError: (name: string) => string }) {
  const [d, setD] = useState(v);
  const [opts, setOpts] = useState(v.options.join(', '));
  const options = opts.split(',').map(s => s.trim()).filter(Boolean);
  const name = d.name.trim();
  // Le nom devient un identifiant JS (ident) : il doit être unique et non réservé une fois converti.
  const err = nameError(name);
  const ok = !!name && !err && (d.type !== 'enum' || options.length > 0);
  const setType = (type: VarType) => setD({ ...d, type, def: type === 'boolean' ? 'false' : type === 'number' ? '0' : options[0] ?? '' });
  const save = () => {
    const def = d.type === 'enum' ? (options.includes(d.def) ? d.def : options[0]) : d.def;
    onSave({ ...d, name, options: d.type === 'enum' ? options : [], def });
  };
  return (
    <form className="sim-edit bnode-form" onSubmit={e => { e.preventDefault(); if (ok) save(); }}>
      <label className="row">Name<input autoFocus value={d.name} placeholder="isLoggedIn" onChange={e => setD({ ...d, name: e.target.value })} /></label>
      <label className="row">Type
        <select value={d.type} onChange={e => setType(e.target.value as VarType)}>
          <option value="boolean">Boolean</option><option value="enum">Enum</option><option value="number">Number</option>
        </select>
      </label>
      {d.type === 'enum' && <label className="row">Values<input value={opts} placeholder="admin, user, guest" onChange={e => setOpts(e.target.value)} /></label>}
      {/* Pas de <label> englobant : il nommerait (et déclencherait) le premier bouton true / false. */}
      <div className="row"><span>Default</span>
        {d.type === 'enum'
          ? <select aria-label="Default value" value={options.includes(d.def) ? d.def : options[0] ?? ''} onChange={e => setD({ ...d, def: e.target.value })}>{options.map(o => <option key={o}>{o}</option>)}</select>
          : <ValueInput v={d} value={d.def} onChange={def => setD({ ...d, def })} label="Default value" />}
      </div>
      {err && <span className="note">{err}</span>}
      <div className="sim-actions">
        {onDelete && <button type="button" className="link-btn danger" onClick={onDelete}>Delete</button>}
        <span className="spacer" />
        <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="pill-btn" disabled={!ok}>Save</button>
      </div>
    </form>
  );
}

/**
 * Panneau « Simulate » : variables d'état, breakpoint et modes Figma.
 * Changer une valeur met à jour l'aperçu et atténue les branches non prises sur le canvas.
 */
export function Simulator({ env, setVars, setValue, setBp, setMode, usage, hasLogic }: {
  env: Env; setVars: (f: (v: StateVar[]) => StateVar[]) => void; setValue: (id: string, x: string) => void;
  setBp: (b: Breakpoint) => void; setMode: (collId: string, modeId: string) => void; usage: (varId: string) => number;
  /** Ouvert par défaut seulement si le canvas contient de la logique ; ensuite, le dernier choix est retenu. */
  hasLogic: boolean;
}) {
  const [pref, setPref] = useState(readOpen);
  const open = pref ?? hasLogic;
  const setOpen = (v: boolean) => { setPref(v); writeOpen(v); };
  const [editing, setEditing] = useState<string | null>(null);
  const cols = modeCollections(env.lib);
  const nameError = (except?: string) => (name: string) => varNameError(env.lib, env.vars, name, except);

  if (!open) return (
    <button className="sim-panel sim-closed" onClick={() => setOpen(true)} aria-expanded={false}>
      <span className="dot v" /> Simulate · {env.bp}{env.vars.length ? ` · ${env.vars.length} var.` : ''}
    </button>
  );
  return (
    <section className="sim-panel" aria-label="Simulate display conditions">
      <div className="sim-head">
        <span className="sec-t">Simulate</span>
        <span className="spacer" />
        <button className="x-btn" onClick={() => setOpen(false)} aria-label="Collapse the simulator" aria-expanded>−</button>
      </div>
      <div className="sim-row">
        <span className="sim-k">Breakpoint</span>
        <div className="seg sim-seg" role="group" aria-label="Breakpoint">
          {BREAKPOINTS.map(b => <button type="button" key={b.id} aria-pressed={env.bp === b.id} onClick={() => setBp(b.id)}>{b.label}</button>)}
        </div>
      </div>
      {cols.map(c => (
        <div className="sim-row" key={c.id}>
          <span className="sim-k" title={`Mode of the Figma collection ${c.name}`}>{c.name}</span>
          <select aria-label={`${c.name} mode`} value={env.modes[c.id] ?? c.modes[0].id} onChange={e => setMode(c.id, e.target.value)}>
            {c.modes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      ))}
      <span className="sim-sub">Variables</span>
      {!env.vars.length && editing !== 'new' && <span className="note">State the screen depends on, e.g. isLoggedIn, role, cartCount.</span>}
      {env.vars.map(v => editing === v.id
        ? <VarEditor key={v.id} v={v} nameError={nameError(v.id)} onCancel={() => setEditing(null)}
            onSave={nv => { setVars(vs => vs.map(x => (x.id === v.id ? nv : x))); setEditing(null); }}
            onDelete={() => { const n = usage(v.id); if (!n || confirm(`Delete "${v.name}"? ${n} condition(s) use it and will stop matching.`)) { setVars(vs => vs.filter(x => x.id !== v.id)); setEditing(null); } }} />
        : (
          <div className="sim-row" key={v.id}>
            <button className="sim-k link-btn" onClick={() => setEditing(v.id)} title="Edit variable">{v.name}</button>
            <ValueInput v={v} value={env.values[v.id] ?? v.def} onChange={x => setValue(v.id, x)} label={`Value of ${v.name}`} />
          </div>
        ))}
      {editing === 'new'
        ? <VarEditor v={{ id: uid(), name: '', type: 'boolean', options: [], def: 'false' }} nameError={nameError()} onCancel={() => setEditing(null)}
            onSave={nv => { setVars(vs => [...vs, nv]); setEditing(null); }} />
        : <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing('new')}>+ Variable</button>}
    </section>
  );
}
