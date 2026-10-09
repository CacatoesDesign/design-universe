import { useMemo, useState } from 'react';
import { cssVarName, formatValue, resolveVar, tierOf, zoneMismatch, zonesOf, type Indexes } from '../lib/library';
import type { Library, Modes } from '../lib/types';

export function TokensView({ lib, idx, modes, onOpen }: { lib: Library; idx: Indexes; modes: Modes; onOpen: (id: string) => void }) {
  const cols = Object.values(lib.collections);
  const [col, setCol] = useState<string>('audit');
  const [q, setQ] = useState('');

  const audit = useMemo(() => {
    const out: { comp: string; variant: string; label: string; msg: string }[] = [];
    for (const c of Object.values(lib.components)) for (const v of c.variants) for (const z of zonesOf(v.tree)) {
      const m = zoneMismatch(lib, z, modes);
      if (m) out.push({ comp: c.id, variant: v.name, label: z.label, msg: m });
    }
    const unbound: { comp: string; variant: string; label: string }[] = [];
    for (const c of Object.values(lib.components)) { const v = c.variants[0]; if (!v) continue; for (const z of zonesOf(v.tree)) if (!z.varId && z.kind !== 'instance' && z.kind !== 'type') unbound.push({ comp: c.id, variant: v.name, label: z.label }); }
    const orphans = Object.values(lib.variables).filter(v => !v.local);
    const unused = Object.values(lib.variables).filter(v => !idx.varUsage[v.id]);
    return { out, unbound, orphans, unused };
  }, [lib, idx, modes]);

  const vars = Object.values(lib.variables).filter(v => v.collection === col && (!q || v.name.toLowerCase().includes(q.toLowerCase())));
  const c = lib.collections[col];

  return (
    <div className="tokens">
      <nav className="sidebar">
        <input className="search" placeholder="Filter variables…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="side-group">
          <span className="side-title">Quality check</span>
          <button className="side-item" aria-current={col === 'audit'} onClick={() => setCol('audit')}><span className="nm">Audit</span><span className="ct">{audit.out.length + audit.orphans.length}</span></button>
        </div>
        <div className="side-group">
          <span className="side-title">Collections</span>
          {cols.map(x => (
            <button key={x.id} className="side-item" aria-current={col === x.id} onClick={() => setCol(x.id)}>
              <span className="nm">{x.name}{x.orphan ? ' · orphan' : ''}</span>
              <span className="ct">{Object.values(lib.variables).filter(v => v.collection === x.id).length}</span>
            </button>
          ))}
        </div>
      </nav>
      <div className="tok-main">
        {col === 'audit' ? (
          <>
            <div className="tok-h"><h2>Library audit</h2><span>scanned {lib.file.scannedAt} · {lib.file.via}</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 980 }}>
              <section className="sec">
                <span className="sec-t">Figma value ≠ bound token value ({audit.out.length})</span>
                <span className="note">The property is bound to a variable, but the value read on the layer does not match the token's resolved value (current mode).</span>
                <table className="tok-table"><thead><tr><th>Component</th><th>Variant</th><th>Property</th><th>Mismatch</th></tr></thead><tbody>
                  {audit.out.map((a, i) => <tr key={i}><td><button className="link-btn" onClick={() => onOpen(a.comp)}>{lib.components[a.comp].name}</button></td><td className="mono" style={{ fontSize: 11 }}>{a.variant}</td><td>{a.label}</td><td>{a.msg}</td></tr>)}
                </tbody></table>
              </section>
              <section className="sec">
                <span className="sec-t">Bound variables outside local collections ({audit.orphans.length})</span>
                <span className="note">Bound to layers but missing from <span className="mono">getLocalVariablesAsync()</span>. They still resolve, but don't appear in the local variables panel.</span>
                <table className="tok-table"><thead><tr><th>Variable</th><th>Collection</th><th>Used by</th></tr></thead><tbody>
                  {audit.orphans.map(v => <tr key={v.id}><td>{v.name}</td><td>{lib.collections[v.collection]?.name}</td><td><div className="used-by">{[...(idx.varUsage[v.id] ?? [])].map(id => <button key={id} onClick={() => onOpen(id)}>{lib.components[id]?.name}</button>)}</div></td></tr>)}
                </tbody></table>
              </section>
              <section className="sec">
                <span className="sec-t">Properties not bound to a variable ({audit.unbound.length}, default variant)</span>
                <table className="tok-table"><thead><tr><th>Component</th><th>Property</th></tr></thead><tbody>
                  {audit.unbound.map((a, i) => <tr key={i}><td><button className="link-btn" onClick={() => onOpen(a.comp)}>{lib.components[a.comp].name}</button></td><td>{a.label}</td></tr>)}
                </tbody></table>
              </section>
              <section className="sec">
                <span className="sec-t">Variables unused by scanned components ({audit.unused.length} / {Object.keys(lib.variables).length})</span>
                <span className="note">Computed over the {Object.values(lib.components).filter(x => x.variants.length).length} components whose tree was scanned: a variable listed here may be used elsewhere in the file.</span>
              </section>
            </div>
          </>
        ) : (
          <>
            <div className="tok-h"><h2>{c?.name}</h2><span>{vars.length} variables · modes: {c?.modes.map(m => m.name).join(', ')}</span></div>
            <table className="tok-table">
              <thead><tr><th>Variable</th><th>Tier</th>{c?.modes.map(m => <th key={m.id}>{m.name}</th>)}<th>CSS</th><th>Used by</th></tr></thead>
              <tbody>
                {vars.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td><span className={'tag ' + tierOf(lib, v)} style={{ fontSize: 11 }}>{tierOf(lib, v)}</span></td>
                    {c?.modes.map(m => {
                      const r = resolveVar(lib, v.id, { ...modes, [v.collection]: m.id });
                      const raw = v.values[m.id];
                      const alias = raw && typeof raw === 'object' ? lib.variables[raw.alias]?.name ?? raw.alias : null;
                      const color = typeof r.value === 'string' && r.value.startsWith('#') ? r.value : null;
                      return <td key={m.id}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{color && <span className="sw" style={{ background: color }} />}<span className="mono" style={{ fontSize: 11.5 }}>{formatValue(r.value, r.steps[r.steps.length - 1]?.v.type)}</span></span>{alias && <div style={{ fontSize: 11, color: 'var(--coral-ink)', marginTop: 3 }}>→ {alias}</div>}</td>;
                    })}
                    <td className="css-var" style={{ fontSize: 11 }}>{cssVarName(v).name}{cssVarName(v).derived && <span style={{ color: 'var(--mute)' }}> *</span>}</td>
                    <td><div className="used-by">{[...(idx.varUsage[v.id] ?? [])].map(id => <button key={id} onClick={() => onOpen(id)}>{lib.components[id]?.name}</button>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 14 }}>* name derived from the variable name: no WEB code syntax is set in Figma.</p>
          </>
        )}
      </div>
    </div>
  );
}
