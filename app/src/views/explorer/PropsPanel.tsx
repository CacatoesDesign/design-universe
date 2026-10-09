import { Fragment, useState } from 'react';
import { cssVarName, formatValue, tierOf, zoneMismatch, type Indexes, type Zone } from '../../lib/library';
import type { Component, Library, Modes } from '../../lib/types';
import { useTyping, zoneCode, zoneValue } from './ComponentLevel';
import { PanelModeButton } from '../../components/PanelModeButton';

export function PropsPanel({ lib, idx, comp, zones, sel, open, modes, onClose, onSelect, onStep, onGoComponent }: {
  lib: Library; idx: Indexes; comp: Component; zones: Zone[]; sel: string | null; open: boolean; modes: Modes;
  onClose: () => void; onSelect: (k: string) => void; onStep: (d: number) => void; onGoComponent: (id: string) => void;
}) {
  const z = zones.find(x => x.key === sel) ?? null;
  const i = z ? zones.indexOf(z) : -1;
  const val = z ? zoneValue(lib, z, modes) : null;
  const code = z ? zoneCode(lib, z) : '';
  const typed = useTyping(code, open && !!z, 520 + (val?.res?.steps.length ?? 0) * 110);
  const warn = z ? zoneMismatch(lib, z, modes) : null;
  const v = z?.varId ? lib.variables[z.varId] : undefined;
  const users = v ? [...(idx.varUsage[v.id] ?? [])].filter(id => id !== comp.id) : [];
  const steps = val?.res?.steps ?? [];
  const [expanded, setExpanded] = useState<string | null>(null); // relations dépliées pour cette zone
  const allUsers = expanded === sel;

  return (
    <aside className="panel" data-open={open} data-panel onClick={e => e.stopPropagation()}>
      <div className="panel-head">
        <div className="t" key={sel ?? 'none'} style={{ animation: 'rowIn .36s ease-out both' }}>
          <span className="eyebrow">{comp.name}{z ? ` · property ${i + 1} of ${zones.length}` : ' · properties'}</span>
          <span className="panel-title">{z ? z.label : 'Pick a zone'}</span>
        </div>
        <PanelModeButton />
        <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="panel-body" key={sel ?? 'empty'}>
        {!z && (
          <div className="sec">
            <span className="note">Click a zone of the component, or pick it here. {zones.length} properties scanned on this variant.</span>
            <div className="zone-list" style={{ borderTop: '1px solid var(--line-2)' }}>
              {zones.map((x, n) => (
                <button key={x.key} onClick={() => onSelect(x.key)}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)' }}>{String(n + 1).padStart(2, '0')}</span>
                  <span style={{ font: '600 13px/1.2 var(--ui)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
                  <span className="css-var" style={{ fontSize: 11 }}>{x.cssProp}</span>
                </button>
              ))}
            </div>
            {comp.description && <><span className="sec-t">Figma documentation</span><div className="desc">{comp.description}</div></>}
          </div>
        )}
        {z && (
          <>
            <div className="sec">
              <span className="sec-t">Mapping</span>
              <div className="grid-map">
                <span className="lbl">Figma</span>
                <div className="col">
                  <span style={{ font: '600 13px/1.3 var(--ui)', whiteSpace: 'nowrap' }}>{z.figmaProp}</span>
                  <span className="fig-var">{val?.color && <span className="sw" style={{ background: val.color }} />}{!val?.color && v && <span className="mono" style={{ fontSize: 10.5, color: 'var(--mute)' }}>#</span>}{v ? v.name : z.kind === 'instance' ? z.node.n : 'unbound'}</span>
                </div>
                <span className="lbl">Code</span>
                <div className="col">
                  <span className="mono" style={{ fontSize: 12.5 }}>{z.cssProp || '—'}</span>
                  {v && <span className="css-var">{cssVarName(v).name}{cssVarName(v).derived && <span style={{ color: 'var(--mute)' }}> · derived name</span>}</span>}
                </div>
              </div>
              {warn && <div className="warn-box">⚠ {warn}. The value applied in Figma does not match the bound variable.</div>}
              {v && !v.local && <div className="warn-box">This variable is bound to the layer but doesn't appear in the file's local collections (orphan variable).</div>}
              {z.kind === 'instance' && z.refComponent && lib.components[z.refComponent] && (
                <button className="pill-btn" onClick={() => onGoComponent(z.refComponent!)}>Open {lib.components[z.refComponent].name} →</button>
              )}
            </div>
            {z.kind !== 'instance' && (
              <div className="sec">
                <span className="sec-t">Resolution{steps.length ? ' · ' + steps.map(s => s.modeName).filter((m, n, a) => a.indexOf(m) === n).join(' / ') : ''}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {steps.map((s, n) => (
                    <Fragment key={s.v.id}>
                      <div className="chain-row" style={{ animationDelay: `${(n + 3) * 110}ms` }}>
                        <span className="lbl" style={{ paddingTop: 0 }}>{tierOf(lib, s.v)}</span>
                        <span className={'tag ' + tierOf(lib, s.v)} title={`${lib.collections[s.v.collection]?.name} · ${cssVarName(s.v).name}`}>{s.v.name}</span>
                      </div>
                      <div className="chain-arrow" style={{ animation: `rowIn .36s ease-out ${(n + 3) * 110 + 60}ms both` }}><span /><span><span className="arr" />{n === steps.length - 1 ? 'resolves to' : lib.collections[s.v.collection]?.modes.length > 1 ? `alias · mode ${s.modeName}` : 'alias'}</span></div>
                    </Fragment>
                  ))}
                  <div className="chain-row" style={{ animationDelay: `${(steps.length + 3) * 110}ms` }}>
                    <span className="lbl" style={{ paddingTop: 0 }}>Value</span>
                    <span className="tag Value">{val?.color && <span className="sw" style={{ background: val.color }} />}{val?.text}</span>
                  </div>
                  {val?.res?.broken && <div className="warn-box" style={{ marginTop: 12 }}>{val.res.broken}</div>}
                  {!z.varId && <span className="note" style={{ marginTop: 12 }}>No variable is bound to this property in Figma: the value is hard-coded.</span>}
                </div>
              </div>
            )}
            {z.kind !== 'instance' && (
              <div className="sec" style={{ animationDelay: `${(steps.length + 4) * 110}ms` }}>
                <span className="sec-t">Generated CSS</span>
                <div className="code" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}><span className="p">{typed.slice(0, z.cssProp.length)}</span><span>{typed.slice(z.cssProp.length)}</span><span style={{ color: 'var(--coral)' }}>▍</span></div>
              </div>
            )}
            {v && (
              <div className="sec">
                <span className="sec-t">Relations</span>
                {users.length
                  ? <p className="note relations">Also used by {(allUsers ? users : users.slice(0, 3)).map((id, n, arr) => (
                      <Fragment key={id}>{n > 0 && (n === arr.length - 1 && (allUsers || users.length <= 3) ? ' and ' : ', ')}<button className="text-link" onClick={() => onGoComponent(id)}>{lib.components[id]?.name}</button></Fragment>
                    ))}{!allUsers && users.length > 3 && <> and <button className="text-link more" onClick={() => setExpanded(sel)} aria-expanded={false}>{users.length - 3} other{users.length - 3 > 1 ? 's' : ''}</button></>}, directly or via alias.</p>
                  : <span className="note">{v.name} is not used by any other scanned component.</span>}
                <span className="note">Collection: {lib.collections[v.collection]?.name} · type {v.type}{steps.length > 1 ? ` · ${steps.length} alias levels` : ''} · {formatValue(val?.res?.value, steps[steps.length - 1]?.v.type)}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="panel-foot">
        <button className="pill-btn prev" onClick={() => onStep(-1)}>← Previous</button>
        <span className="dots" role="img" aria-label={i >= 0 ? `Property ${i + 1} of ${zones.length}` : `${zones.length} properties`}>
          {zones.map((x, n) => <i key={x.key} data-on={n === i} />)}
        </span>
        <button className="pill-btn next" onClick={() => onStep(1)}>Next →</button>
      </div>
    </aside>
  );
}
