import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { FigmaRender } from '../../render/FigmaRender';
import { NAV_DELAY, nudgeTransform, reducedMotion } from '../../lib/camera';
import { hintSeen, markHint } from '../../lib/hints';
import { formatValue, resolveVar, tierOf, type Indexes } from '../../lib/library';
import { TokenCollector, declsFor, slug } from '../../lib/codegen';
import type { Component, FNode, Library, Modes } from '../../lib/types';
import { PanelModeButton } from '../../components/PanelModeButton';

interface R { x: number; y: number; w: number; h: number }

function findPaths(n: FNode, pred: (n: FNode) => boolean, path: number[] = [], out: number[][] = []) {
  if (path.length && pred(n)) { out.push(path); return out; }
  if (n.ref && path.length) return out;
  n.c?.forEach((c, i) => findPaths(c, pred, [...path, i], out));
  return out;
}

export function PatternLevel({ lib, idx, comp, parents, parentIdx, onParent, onEnter, panelOpen, onPanel, modes, onEmptyUsage, active = true }: {
  active?: boolean; lib: Library; idx: Indexes; comp: Component; parents: Component[]; parentIdx: number; onParent: (i: number) => void;
  onEnter: (id: string, el?: Element | null) => void; panelOpen: boolean; onPanel: (o: boolean) => void; modes: Modes; onEmptyUsage: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null); // calque caméra : les mesures sont dans son repère
  const [nudge, setNudge] = useState<string | null>(null);
  const [hintDone, setHintDone] = useState(() => hintSeen('pattern'));
  // Recul en douceur à la fermeture du panneau ou en quittant la vue.
  const [prev, setPrev] = useState({ panelOpen, active });
  if (prev.panelOpen !== panelOpen || prev.active !== active) {
    setPrev({ panelOpen, active });
    if ((prev.panelOpen && !panelOpen) || (prev.active && !active)) setNudge(null);
  }
  // Premier clic dans la vue : la caméra s'approche un peu du point cliqué.
  const approach = (e: React.MouseEvent) => {
    if (!hintDone) { markHint('pattern'); setHintDone(true); }
    if (nudge || !cam.current) return;
    const S = cam.current.getBoundingClientRect(), k = S.width / (cam.current.offsetWidth || S.width) || 1;
    setNudge(nudgeTransform((e.clientX - S.left) / k, (e.clientY - S.top) / k, size.w, size.h));
  };
  const [m, setM] = useState<{ inst: (R & { path: string; ref: string; name: string })[]; gaps: (R & { label: string; vertical: boolean })[] }>({ inst: [], gaps: [] });
  const [size, setSize] = useState({ w: 1000, h: 600 });
  const p = parents[parentIdx];
  const tree = p?.variants[0]?.tree;

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const scale = tree ? Math.max(0.3, Math.min(1.4, (size.w - (panelOpen ? 560 : 160)) / tree.w, (size.h - 240) / tree.h)) : 1;

  useLayoutEffect(() => {
    if (!tree || !cam.current || !root.current) return;
    const measure = () => {
      const S = cam.current!.getBoundingClientRect();
      const k = S.width / (cam.current!.offsetWidth || S.width) || 1; // échelle du niveau pendant la transition de zoom
      const rel = (e: Element): R => { const r = e.getBoundingClientRect(); return { x: (r.left - S.left) / k, y: (r.top - S.top) / k, w: r.width / k, h: r.height / k }; };
      const q = (path: number[]) => root.current!.querySelector(`[data-path="${path.join('.')}"]`);
      const inst = findPaths(tree, n => !!n.ref && !n.icon).map(path => {
        let n: FNode = tree; for (const i of path) n = n.c![i];
        const e = q(path); return e ? { ...rel(e), path: path.join('.'), ref: n.ref!, name: lib.components[n.ref!]?.name ?? n.n } : null;
      }).filter(Boolean) as (R & { path: string; ref: string; name: string })[];
      const gaps: (R & { label: string; vertical: boolean })[] = [];
      const walk = (n: FNode, path: number[]) => {
        if (n.ref && path.length) return;
        if (n.lay && (n.c?.length ?? 0) > 1 && n.lay[1] > 0) {
          const e = q(path);
          if (e) {
            const kids = [...e.children].map(rel); const H = n.lay[0] === 'H';
            const res = n.b?.itemSpacing ? resolveVar(lib, n.b.itemSpacing, modes) : null;
            const label = res?.steps.length ? `${res.steps[0].v.name} · ${formatValue(res.value, 'FLOAT')}` : `gap ${n.lay[1]}px · unbound`;
            for (let i = 0; i < kids.length - 1; i++) {
              const a = kids[i], b = kids[i + 1];
              gaps.push(H ? { x: a.x + a.w, y: Math.min(a.y, b.y), w: b.x - a.x - a.w, h: Math.max(a.h, b.h), label, vertical: false } : { x: Math.min(a.x, b.x), y: a.y + a.h, w: Math.max(a.w, b.w), h: b.y - a.y - a.h, label, vertical: true });
            }
          }
        }
        n.c?.forEach((c, i) => walk(c, [...path, i]));
      };
      walk(tree, []);
      setM({ inst, gaps });
    };
    measure();
    const id = requestAnimationFrame(measure);
    const late = window.setTimeout(measure, 700);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; cancelAnimationFrame(id); clearTimeout(late); };
  }, [tree, scale, size, panelOpen, lib, modes, active]);

  if (!p || !tree) {
    return (
      <div className="empty-state">
        <span className="badge">Pattern</span>
        <h3>No scanned pattern instantiates {comp.name}</h3>
        <p>No other renderable component in the library contains an instance of {comp.name}. Its direct usages in screens are shown at the Usage level.</p>
        <button className="pill-btn" onClick={onEmptyUsage}>View usages ↑</button>
      </div>
    );
  }

  const tk = new TokenCollector(lib);
  const css = `.${slug(p.name)} {\n${declsFor(tree, tk, true).map(d => '  ' + d + ';').join('\n')}\n}`;
  const gapChain = tree.b?.itemSpacing ?? findPaths(tree, n => !!n.lay && !!n.b?.itemSpacing && !n.ref).map(path => { let n: FNode = tree; for (const i of path) n = n.c![i]; return n.b!.itemSpacing; })[0];
  const gapRes = gapChain ? resolveVar(lib, gapChain, modes) : null;

  return (
    <div ref={wrap} className="pattern-wrap" onClick={() => onPanel(false)}>
      <div className="hint" style={{ opacity: panelOpen || hintDone ? 0 : 1 }}><span><span className="dot v" />Click the pattern for its properties · an instance to enter it</span></div>
      <div ref={cam} className="camera" style={{ transform: nudge ?? 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: panelOpen ? 'translateX(-200px)' : 'none', transition: 'transform .42s var(--ease)' }}>
        <div className="pattern-frame" data-sel={panelOpen} onClick={e => { e.stopPropagation(); approach(e); onPanel(true); }} style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
          <span className="pf-label">◇ {p.name}<span>{tree.lay ? `auto layout · ${tree.lay[0] === 'H' ? '→' : '↓'}` : 'frame'}</span></span>
          <div ref={root} style={{ pointerEvents: 'none' }}><FigmaRender node={tree} opts={{ lib, dataPaths: true }} /></div>
        </div>
      </div>
      {m.gaps.map((g, i) => (
        <div key={'g' + i} style={{ position: 'absolute', left: g.x, top: g.y, width: Math.max(2, g.w), height: Math.max(2, g.h), background: 'repeating-linear-gradient(-45deg, rgba(124,92,240,.5) 0 1.5px, transparent 1.5px 5px)', pointerEvents: 'none' }}>
          {i === 0 && <>
            <span style={{ position: 'absolute', left: '50%', top: '100%', width: 1, height: 44, background: 'var(--violet)' }} />
            <span className="gap-tag" style={{ left: '50%', top: `calc(100% + 44px)` }}>{g.label}</span>
          </>}
        </div>
      ))}
      {m.inst.map(r => (
        <span key={r.path} className="inst-ring" style={{ left: r.x, top: r.y, width: r.w, height: r.h, outlineColor: r.ref === comp.id ? 'var(--violet)' : 'rgba(124,92,240,.35)' }}
          onClick={e => { e.stopPropagation(); approach(e); const el = e.currentTarget; window.setTimeout(() => onEnter(r.ref, el), reducedMotion() ? 0 : NAV_DELAY); }} title={`Enter ${r.name}`}>
          {r.ref === comp.id && <span className="inst-tag">◇ instance · {r.name}</span>}
        </span>
      ))}
      </div>
      {parents.length > 1 && (
        <div className="pattern-switch" onClick={e => e.stopPropagation()}>
          {parents.map((x, i) => <button key={x.id} className="chip" aria-pressed={i === parentIdx} onClick={() => onParent(i)}>{x.name}</button>)}
        </div>
      )}
      <aside className="panel" data-open={panelOpen} data-panel onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <div className="t"><span className="eyebrow">{p.kind === 'set' ? 'Component set' : 'Component'} · page {p.page}</span><span className="panel-title">{p.name}</span></div>
          <PanelModeButton />
          <button className="x-btn" onClick={() => onPanel(false)} aria-label="Close">×</button>
        </div>
        <div className="panel-body">
          {Object.keys(p.props).length > 0 && (
            <div className="sec">
              <span className="sec-t">Component properties</span>
              <div className="grid-map" style={{ gridTemplateColumns: '96px minmax(0,1fr)', gap: '12px' }}>
                {Object.entries(p.props).map(([k, t]) => (
                  <Fragment key={k}><span className="lbl">{k}</span><span className="mono" style={{ fontSize: 11.5 }}>{Array.isArray(t) ? t.join(' · ') : t}</span></Fragment>
                ))}
              </div>
            </div>
          )}
          <div className="sec">
            <span className="sec-t">Auto layout</span>
            <div className="grid-map" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <span className="lbl">Direction</span><span>{tree.lay ? (tree.lay[0] === 'H' ? 'Horizontal →' : 'Vertical ↓') : 'None (free frame)'}</span>
              <span className="lbl">Gap</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {gapRes?.steps.map((s, i) => <span key={s.v.id} style={{ display: 'contents' }}>{i > 0 && <span style={{ color: 'var(--coral-ink)', fontWeight: 600 }}>→</span>}<span className={'tag ' + tierOf(lib, s.v)}>{s.v.name}</span></span>)}
                {gapRes && <><span style={{ color: 'var(--coral-ink)', fontWeight: 600 }}>→</span><span className="tag Value">{formatValue(gapRes.value, 'FLOAT')}</span></>}
                {!gapRes && <span className="note">not bound to a variable</span>}
              </span>
            </div>
          </div>
          <div className="sec">
            <span className="sec-t">Instances</span>
            <div className="zone-list">
              {p.uses.filter(u => lib.components[u.id]).map((u, i) => (
                <button key={u.id} onClick={() => onEnter(u.id)}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="mono" style={{ fontSize: 12.5 }}>{u.name} ×{u.count}</span>
                  <span style={{ font: '600 11px/1 var(--ui)', color: 'var(--violet)' }}>Enter component →</span>
                </button>
              ))}
            </div>
            <span className="note">Used in {idx.screens[p.id]?.length ?? 0} scanned screen(s).</span>
          </div>
          <div className="sec">
            <span className="sec-t">Generated CSS</span>
            <div className="code">{css}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
