import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FigmaRender } from '../../render/FigmaRender';
import { Connector, curve } from '../../components/Connector';
import { ZoomControls } from '../../components/ZoomBar';
import { nudgeTransform } from '../../lib/camera';
import { setAmbientParallax, setAmbientTarget } from '../../lib/ambient';
import { cssVarName, formatValue, resolveVar, tierOf, zoneMismatch, type Zone } from '../../lib/library';
import type { Library, Modes, Variant } from '../../lib/types';

interface Rect { x: number; y: number; w: number; h: number; r?: number }

const MIN_SCALE = 0.25, MAX_SCALE = 8, STEP = 1.25;

export function zoneCode(lib: Library, z: Zone) {
  const v = z.varId ? lib.variables[z.varId] : undefined;
  if (z.kind === 'instance') return `<${z.node.n} />`;
  const val = v ? `var(${cssVarName(v).name})` : typeof z.raw === 'number' ? `${z.raw}px` : String(z.raw ?? '');
  return `${z.cssProp}: ${val};`;
}

export function zoneValue(lib: Library, z: Zone, modes: Modes) {
  if (z.varId) {
    const r = resolveVar(lib, z.varId, modes);
    const last = r.steps[r.steps.length - 1]?.v;
    return { text: r.broken ? 'unresolved' : formatValue(r.value, last?.type), color: typeof r.value === 'string' && r.value.startsWith('#') ? r.value : null, res: r };
  }
  return { text: typeof z.raw === 'number' ? `${z.raw}px` : String(z.raw ?? '—'), color: typeof z.raw === 'string' && z.raw.startsWith('#') ? z.raw : null, res: null };
}

export function useTyping(text: string, active: boolean, delay = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!active) return;
    let iv: number | undefined;
    const t = window.setTimeout(() => { iv = window.setInterval(() => setN(x => (x >= text.length ? (clearInterval(iv), x) : x + 2)), 22); }, delay);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [text, active, delay]);
  return active ? text.slice(0, n) : text;
}

export function ComponentLevel({ lib, variant, zones, sel, onSelect, modes, panelOpen, onOpenPanel, compName, texts, toolbar, active = true }: {
  active?: boolean; lib: Library; variant: Variant; zones: Zone[]; sel: string | null; onSelect: (k: string | null) => void; modes: Modes;
  panelOpen: boolean; onOpenPanel: () => void; compName: string; texts?: Record<string, string>;
  /** Variantes : pastille en bas de la scène, à côté du zoom. */ toolbar?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLDivElement>(null); // calque caméra : toutes les mesures sont dans son repère
  const [nudge, setNudge] = useState<string | null>(null);
  // Recul en douceur à la désélection ou en quittant la vue.
  const [prev, setPrev] = useState({ sel, active });
  if (prev.sel !== sel || prev.active !== active) {
    setPrev({ sel, active });
    if ((prev.sel && !sel) || (prev.active && !active)) setNudge(null);
  }
  // Changement de combinaison : compteur qui rejoue l'animation de ré-assemblage (pas à l'arrivée dans la vue).
  const [swap, setSwap] = useState({ id: variant.id, n: 0 });
  if (swap.id !== variant.id) setSwap({ id: variant.id, n: swap.n + 1 });
  const [size, setSize] = useState({ w: 1000, h: 600 });
  const [rects, setRects] = useState<Record<string, Rect[]>>({});
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const t = variant.tree;
  const fit = Math.max(0.35, Math.min(2.2, (size.w - 680) / t.w, (size.h - 220) / t.h));
  // Zoom utilisateur : z multiplie l'échelle ajustée, (x, y) = déplacement depuis le centre de la scène.
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const scale = fit * view.z;
  const fitView = useCallback(() => setView({ z: 1, x: 0, y: 0 }), []);
  // Zoom vers `target` (échelle absolue, 1 = taille Figma) en gardant fixe le point (ax, ay) relatif au centre.
  const zoomTo = useCallback((target: number | ((s: number) => number), ax = 0, ay = 0) => setView(v => {
    const s1 = fit * v.z;
    const s2 = Math.max(MIN_SCALE, Math.min(MAX_SCALE, typeof target === 'function' ? target(s1) : target));
    const r = s2 / s1;
    return { z: s2 / fit, x: ax - (ax - v.x) * r, y: ay - (ay - v.y) * r };
  }), [fit]);

  // Pincement trackpad / Ctrl (⌘) + molette : zoom centré sur le curseur. La molette seule reste au changement de niveau.
  useEffect(() => {
    const el = stageRef.current; if (!el || !active) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); e.stopPropagation();
      const c = camRef.current ?? el;
      const S = c.getBoundingClientRect();
      const k = S.width / (c.offsetWidth || S.width) || 1;
      const ax = (e.clientX - S.left) / k - c.offsetWidth / 2, ay = (e.clientY - S.top) / k - c.offsetHeight / 2;
      const dy = Math.max(-50, Math.min(50, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY)); // borne : un cran de molette ≈ ×1,6
      zoomTo(s => s * Math.exp(-dy * 0.01), ax, ay);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [active, zoomTo]);

  // Glisser (fond ou zones) pour se déplacer ; un glisser ne sélectionne ni ne désélectionne.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.callout, .bottom-dock, .zoom-dock')) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    // Capture seulement une fois le glisser engagé : un simple clic garde sa cible (zone ou fond).
    if (!d.moved) { setGrabbing(true); e.currentTarget.setPointerCapture(e.pointerId); }
    d.moved = true; d.x = e.clientX; d.y = e.clientY;
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = () => { const d = drag.current; drag.current = null; setGrabbing(false); if (d?.moved) suppressClick.current = true; };

  // Mesure des zones sur le rendu réel (coordonnées de la scène).
  useLayoutEffect(() => {
    const st = camRef.current, root = rootRef.current; if (!st || !root) return;
    const measure = () => {
      const S = st.getBoundingClientRect();
      const k = S.width / (st.offsetWidth || S.width) || 1; // échelle du niveau pendant la transition de zoom
      const el = (p: number[]) => root.querySelector<HTMLElement>(`[data-path="${p.join('.')}"]`);
      const rel = (e: Element): Rect => { const r = e.getBoundingClientRect(); return { x: (r.left - S.left) / k, y: (r.top - S.top) / k, w: r.width / k, h: r.height / k }; };
      const out: Record<string, Rect[]> = {};
      for (const z of zones) {
        const e = el(z.path); if (!e) continue;
        const R = rel(e);
        const lay = z.node.lay;
        const kind = z.key.split(':')[1];
        if (kind === 'px' && lay) out[z.key] = [{ ...R, w: Math.max(4, lay[5] * scale) }, { ...R, x: R.x + R.w - Math.max(4, lay[3] * scale), w: Math.max(4, lay[3] * scale) }];
        else if (kind === 'py' && lay) out[z.key] = [{ x: R.x + lay[5] * scale, y: R.y, w: R.w - (lay[5] + lay[3]) * scale, h: Math.max(4, lay[2] * scale) }, { x: R.x + lay[5] * scale, y: R.y + R.h - Math.max(4, lay[4] * scale), w: R.w - (lay[5] + lay[3]) * scale, h: Math.max(4, lay[4] * scale) }];
        else if (kind === 'gap' && lay) {
          const kids = [...e.children].map(rel);
          const g: Rect[] = [];
          for (let i = 0; i < kids.length - 1; i++) {
            const a = kids[i], b = kids[i + 1];
            g.push(lay[0] === 'H' ? { x: a.x + a.w, y: R.y + lay[2] * scale, w: Math.max(3, b.x - a.x - a.w), h: R.h - (lay[2] + lay[4]) * scale } : { x: R.x + lay[5] * scale, y: a.y + a.h, w: R.w - (lay[5] + lay[3]) * scale, h: Math.max(3, b.y - a.y - a.h) });
          }
          out[z.key] = g.length ? g : [R];
        } else if (kind === 'radius') out[z.key] = [{ x: R.x - 8, y: R.y - 8, w: R.w + 16, h: R.h + 16, r: typeof z.node.r === 'number' ? Math.min(999, z.node.r * scale + 8) : 8 }];
        else out[z.key] = [R];
      }
      setRects(out);
    };
    measure();
    const id = requestAnimationFrame(measure);
    const late = window.setTimeout(measure, 700);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; cancelAnimationFrame(id); clearTimeout(late); };
  }, [zones, scale, view, size, variant, texts, panelOpen, active, swap.n]); // la mesure tardive (700 ms) suit la fin du ré-assemblage (520 ms)

  const z = zones.find(x => x.key === sel) ?? null;
  const zr = z ? rects[z.key] : null;

  // Lumière ambiante : vise la zone sélectionnée ; parallaxe opposée au déplacement du canvas.
  useEffect(() => {
    if (!active) return;
    if (!camRef.current || !zr?.length) { setAmbientTarget(null); return; }
    const r = zr[0];
    const aim = () => {
      const c = camRef.current; if (!c) return;
      const C = c.getBoundingClientRect(), k = C.width / (c.offsetWidth || C.width) || 1;
      setAmbientTarget({ x: C.left + (r.x + r.w / 2) * k, y: C.top + (r.y + r.h / 2) * k });
    };
    aim();
    const late = window.setTimeout(aim, 620); // re-vise une fois le rapprochement de caméra (560 ms) terminé
    return () => clearTimeout(late);
  }, [zr, active]);
  useEffect(() => { if (active) setAmbientParallax(view.x * 0.02, view.y * 0.02); }, [view.x, view.y, active]);
  const val = z ? zoneValue(lib, z, modes) : null;
  const code = z ? zoneCode(lib, z) : '';
  const typed = useTyping(code, !!z && !panelOpen);
  const warn = z ? zoneMismatch(lib, z, modes) : null;

  // Barre du bas (variantes + zoom) : sa hauteur réserve le bas de la scène au popup.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useLayoutEffect(() => {
    const el = dockRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  // Popup : à droite de la sélection si possible, sinon à gauche.
  const callout = useMemo(() => {
    if (!z || !zr?.length || panelOpen) return null;
    const box = zr.reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), x2: Math.max(a.x2, r.x + r.w), y2: Math.max(a.y2, r.y + r.h) }), { x: 1e9, y: 1e9, x2: -1e9, y2: -1e9 });
    const right = box.x2 + 70 + 280 < size.w - 12;
    const mid = size.w / 2 + view.x;
    const cx = right ? Math.max(box.x2 + 70, mid + (t.w * scale) / 2 + 40) : Math.min(box.x - 70 - 280, mid - (t.w * scale) / 2 - 320);
    const x = Math.max(12, Math.min(size.w - 292, cx));
    const y = Math.max(64, Math.min(size.h - 16 - dockH - 12 - 230, (box.y + box.y2) / 2 - 80));
    const ax = right ? x : x + 280, ay = y + 60;
    const target = zr.reduce((best, r) => { const tx = Math.max(r.x, Math.min(ax, r.x + r.w)), ty = Math.max(r.y, Math.min(ay, r.y + r.h)); const d = Math.hypot(tx - ax, ty - ay); return !best || d < best.d ? { tx, ty, d } : best; }, null as null | { tx: number; ty: number; d: number })!;
    return { x, y, ax, ay, tx: target.tx, ty: target.ty, origin: right ? 'left center' : 'right center' };
  }, [z, zr, size, panelOpen, scale, t.w, view.x, dockH]);

  const idx = z ? zones.indexOf(z) + 1 : 0;
  const lastStep = val?.res?.steps[val.res.steps.length - 1];
  const chain = val?.res ? val.res.steps.slice(1).map(s => s.v.name).concat(val.text).join(' → ') : 'raw value, not bound to a variable';
  const primaryHit = (key: string) => { const k = key.split(':')[1]; return ['bg', 'color', 'icon', 'inst', 'border'].includes(k); };
  const hitZones = zones.filter(x => primaryHit(x.key) || ['px', 'py', 'gap', 'radius'].includes(x.key.split(':')[1]));
  const firstPerPath = new Set<string>();
  const hits = hitZones.filter(x => { const k = x.key.split(':')[1]; if (['px', 'py', 'gap', 'radius'].includes(k)) return true; const p = x.path.join('.'); if (firstPerPath.has(p)) return false; firstPerPath.add(p); return true; });
  const order = (k: string) => ({ radius: 0, bg: 1, border: 1, px: 2, py: 2, gap: 3 } as Record<string, number>)[k.split(':')[1]] ?? 4;
  hits.sort((a, b) => order(a.key) - order(b.key) || a.path.length - b.path.length);

  const pick = (k: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressClick.current) { suppressClick.current = false; return; }
    const S = camRef.current!.getBoundingClientRect();
    const sc = S.width / (camRef.current!.offsetWidth || S.width) || 1;
    const x = (e.clientX - S.left) / sc, y = (e.clientY - S.top) / sc;
    setRipple({ x, y, k: Date.now() });
    // Premier clic dans la vue : la caméra s'approche un peu de la zone.
    if (!sel && !nudge) { setNudge(nudgeTransform(x, y, size.w, size.h)); }
    onSelect(k);
  };

  return (
    <div ref={stageRef} className="comp-wrap" style={{ transform: panelOpen ? 'translateX(-200px)' : 'none', cursor: grabbing ? 'grabbing' : view.z > 1.01 ? 'grab' : undefined }}
      onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onSelect(null); }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div ref={camRef} className="camera" style={{ transform: nudge ?? 'none' }}>
      <div className="comp-center" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${scale})` }}>
        <div ref={rootRef} key={swap.n} className={'comp-surface' + (swap.n ? ' swap' : '')} style={{ pointerEvents: 'none', '--k': scale } as React.CSSProperties}>
          <FigmaRender node={t} opts={{ lib, dataPaths: true, texts }} />
        </div>
      </div>
      {hits.map(h => (rects[h.key] ?? []).map((r, i) => {
        const k = h.key.split(':')[1];
        return k === 'radius'
          ? <span key={h.key + i} className="zone-hit" onClick={e => pick(h.key, e)} title={h.label} style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r, background: 'transparent', border: '1.5px dashed var(--coral)' }} />
          : <span key={h.key + i} className={'zone-hit' + (h.path.length ? '' : ' light')} onClick={e => pick(h.key, e)} title={h.label} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
      }))}
      {(zr ?? []).map((r, i, arr) => (
        <div key={i} className="sel-box" style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r ?? 2 }}>
          {!r.r && <><i /><i /><i /><i /></>}
          {panelOpen && i === arr.length - 1 && <span className="sel-dim">{val?.text}</span>}
        </div>
      ))}
      {ripple && <span key={ripple.k} className="ripple" style={{ left: ripple.x, top: ripple.y }} />}
      {callout && (
        <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
          <Connector key={sel} d={curve(callout.ax, callout.ay, callout.tx, callout.ty)} x1={callout.ax} y1={callout.ay} x2={callout.tx} y2={callout.ty} drawn delay={80} pulse={1} pulseDelay={0.45} />
        </svg>
      )}
      {callout && z && (
        <div key={sel} className="callout" style={{ left: callout.x, top: callout.y, transformOrigin: callout.origin }} onClick={e => e.stopPropagation()}>
          <span className="co-head"><span>{z.label}</span><span className="mono">{String(idx).padStart(2, '0')}</span></span>
          <span className="co-var">{val?.color && <span className="sw" style={{ background: val.color }} />}{z.varId ? lib.variables[z.varId]?.name ?? z.varId : z.kind === 'instance' ? z.node.n : 'Unbound value'}</span>
          <span className="co-fig">Figma · {z.figmaProp}{lastStep ? ` · ${tierOf(lib, val!.res!.steps[0].v)}` : ''}</span>
          <span className="co-code"><span className="p">{typed.slice(0, z.cssProp.length)}</span>{typed.slice(z.cssProp.length)}<span className="caret">{typed.length < code.length ? '▍' : ''}</span></span>
          <span className="co-chain">{z.kind === 'instance' ? `Instance of ${lib.components[z.refComponent!]?.name ?? z.node.n}: its tokens live in its own component` : chain}</span>
          {warn && <span className="co-warn">⚠ {warn}</span>}
          <button className="link-btn" onClick={e => { e.stopPropagation(); onOpenPanel(); }}>View properties →</button>
        </div>
      )}
      </div>
      {/* Variantes seules en bas, centrées dans la partie visible (le panneau Properties couvre la droite). */}
      <div ref={dockRef} className="bottom-dock" data-panel-open={panelOpen} onClick={e => e.stopPropagation()}>
        {toolbar && <div className="variant-pill">{toolbar}</div>}
      </div>
      {/* Zoom en haut à gauche, sous le nom de la variante. */}
      <div className="bottom-pill zoom-dock" style={{ left: panelOpen ? 216 : 16 }} onClick={e => e.stopPropagation()}>
        <ZoomControls position="inline" enabled={active} pct={Math.round(scale * 100)}
          onIn={() => zoomTo(s => s * STEP)} onOut={() => zoomTo(s => s / STEP)} onReset={() => zoomTo(1)} onFit={fitView} />
      </div>
      <div style={{ position: 'absolute', left: panelOpen ? 220 : 20, top: 18, transition: 'left .48s var(--ease)', font: '500 11px/1 var(--mono)', color: 'var(--mute)', zIndex: 6 }}>{compName} · {variant.name}</div>
    </div>
  );
}
