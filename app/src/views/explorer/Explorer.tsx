import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ambient } from '../../components/Ambient';
import { Aurora } from '../../components/Aurora';
import { setAmbientParallax, setAmbientTarget } from '../../lib/ambient';
import { VariantBar } from './VariantBar';
import { findVariant, usageContexts, variantAxes, zoneMismatch, zonesOf, type Indexes } from '../../lib/library';
import type { Library, Modes, Screen } from '../../lib/types';
import { usePreviews } from '../../lib/figmaApi';
import { FallbackImg, previewSources } from './FlowParts';
import { ComponentLevel } from './ComponentLevel';
import { PropsPanel } from './PropsPanel';
import { PatternLevel } from './PatternLevel';
import { UsageLevel } from './UsageLevel';
import { LibraryLevel } from './LibraryLevel';
import { ComponentList } from './ComponentList';
import { PanelModeButton } from '../../components/PanelModeButton';
import { ZonePicker } from './ZonePicker';
import { DepthRail } from '../../components/DepthRail';
import { DiveGhost, type Dive } from '../../components/DiveGhost';
import { reducedMotion } from '../../lib/camera';
import { Shortcuts } from './Shortcuts';
import { hintSeen, markHint } from '../../lib/hints';
import { setMusicLevel, sfx } from '../../lib/sound';


export function Explorer({ lib, idx, dark, modes, setModes, initial }: { lib: Library; idx: Indexes; dark: boolean; modes: Modes; setModes: (m: Modes) => void; initial?: string }) {
  const comps = Object.values(lib.components);
  const firstRenderable = comps.find(c => c.name === 'Button' && c.variants.length) ?? comps.find(c => c.variants.length)!;
  const [compId, setCompId] = useState(initial ?? firstRenderable.id);
  const comp = lib.components[compId] ?? firstRenderable;
  const [vprops, setVprops] = useState<Record<string, string>>(comp.variants[0]?.props ?? {});
  const [level, setLevel] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [setPanelOpen, setSetPanelOpen] = useState(false);
  const [parentIdx, setParentIdx] = useState(0);
  const [clicked, setClicked] = useState(false);
  const [hintsDone] = useState(() => hintSeen('component')); // indications déjà vues dans ce navigateur
  const [zoomed, setZoomed] = useState(false);
  const [screen, setScreen] = useState<Screen | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previews = usePreviews();

  const variant = findVariant(comp, vprops) ?? comp.variants[0];
  const zones = useMemo(() => (variant ? zonesOf(variant.tree) : []), [variant]);
  const parents = useMemo(() => (idx.parents[comp.id] ?? []).map(id => lib.components[id]).filter(c => c?.variants.length), [idx, comp, lib]);
  const axes = useMemo(() => variantAxes(comp), [comp]);
  const usageCount = useMemo(() => usageContexts(lib, idx, comp.id).length, [lib, idx, comp]);
  const multiModeCols = Object.values(lib.collections).filter(c => c.modes.length > 1 && !c.orphan);

  const openComp = useCallback((id: string, lv = 0) => {
    const c = lib.components[id]; if (!c) return;
    setCompId(id); setVprops(c.variants[0]?.props ?? {}); setSel(null); setPanel(false); setSetPanelOpen(false); setParentIdx(0); setScreen(null);
    setLevel(c.variants.length ? lv : Math.max(lv, 2));
  }, [lib]);

  // Plongée : la carte cliquée devient le cadre du niveau suivant ; au retour, le cadre se replie vers elle.
  const [ghost, setGhost] = useState<Dive | null>(null);
  const [stageSize, setStageSize] = useState({ w: 1000, h: 700 });
  const diveFrom = useRef<Record<number, { rect: Dive['from']; label: string }>>({});
  const endGhost = useCallback(() => setGhost(null), []);
  const dive = useCallback((el: Element | null | undefined, label: string, into: number) => {
    const st = stageRef.current; if (!st || !el || reducedMotion()) return;
    const S = st.getBoundingClientRect(), r = el.getBoundingClientRect();
    const rect = { x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height };
    diveFrom.current[into] = { rect, label };
    setStageSize({ w: S.width, h: S.height });
    setGhost({ from: rect, label, dir: 'in', k: Date.now() });
  }, []);

  const goLevel = useCallback((l: number) => {
    const target = Math.max(comp.variants.length ? 0 : 2, Math.min(3, l));
    // Retour vers le niveau d'où l'on a plongé : repli vers la carte d'origine.
    const back = target === level + 1 ? diveFrom.current[level] : undefined;
    if (back && stageRef.current && !reducedMotion()) {
      const S = stageRef.current.getBoundingClientRect();
      setStageSize({ w: S.width, h: S.height });
      setGhost({ from: back.rect, label: back.label, dir: 'out', k: Date.now() });
    }
    // En remontant, oublie toutes les plongées vers les niveaux traversés (saut de plusieurs niveaux compris).
    if (target > level) for (const k of Object.keys(diveFrom.current)) if (+k < target) delete diveFrom.current[+k];
    if (target !== level) { setPanel(false); setSetPanelOpen(false); setScreen(null); if (target > 0) setSel(null); }
    setLevel(target);
  }, [level, comp]);

  const select = useCallback((k: string | null, sound: 'select' | 'option' = 'select') => { setSel(k); if (k) { sfx(sound); setClicked(true); markHint('component'); } }, []);
  const step = useCallback((d: number) => {
    if (!zones.length) return;
    if (level !== 0) setLevel(0);
    const i = sel ? zones.findIndex(z => z.key === sel) : d > 0 ? -1 : 0;
    select(zones[(i + d + zones.length) % zones.length].key, 'option');
  }, [zones, sel, level, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (clicked) setZoomed(true); goLevel(level + 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (clicked) setZoomed(true); goLevel(level - 1); }
      else if (e.key === 'Escape') { if (screen || setPanelOpen || panel) sfx('close'); if (screen) setScreen(null); else if (setPanelOpen) setSetPanelOpen(false); else if (panel) setPanel(false); else setSel(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goLevel, level, panel, setPanelOpen, screen, clicked]);

  // Molette / trackpad : un changement de niveau par geste (pincement seulement sur les graphes, où la molette sert au déplacement).
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    let acc = 0, lock = 0, reset: number | undefined;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.('[data-panel]')) return;
      if (level >= 2 && !e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now(); if (now < lock) return;
      acc += e.ctrlKey ? e.deltaY * 4 : e.deltaY;
      clearTimeout(reset); reset = window.setTimeout(() => { acc = 0; }, 180);
      if (Math.abs(acc) < 60) return;
      const out = acc > 0; acc = 0; lock = now + 750;
      goLevel(level + (out ? 1 : -1));
      if (clicked) setZoomed(true);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [level, goLevel, clicked]);

  // Tout changement de niveau (rail, clavier, ouverture d'un composant…) : la musique suit, avec le son de plongée ou de remontée.
  const prevLevel = useRef(level);
  useEffect(() => {
    if (level !== prevLevel.current) sfx(level < prevLevel.current ? 'dive' : 'rise');
    prevLevel.current = level;
    setMusicLevel(level);
  }, [level]);
  // Nouveau niveau : la lumière revient au repos, sans parallaxe.
  useEffect(() => { setAmbientTarget(null); setAmbientParallax(0, 0); }, [level, compId]);
  const state = (i: number) => (i === level ? 'active' : i < level ? 'below' : 'above');
  const parent = parents[parentIdx];

  return (
    <div className="explorer">
      <ComponentList lib={lib} current={comp} screenId={screen?.id} onOpenComp={id => openComp(id, 0)}
        onOpenScreen={s => { sfx('open'); goLevel(2); setScreen(s); }} />
      <section className="center">
        <div className="crumbs">
          {[3, 2, 1, 0].map((l, n) => (
            <span key={l} style={{ display: 'contents' }}>
              {n > 0 && <span className="sep">›</span>}
              <button aria-current={level === l} onClick={() => goLevel(l)} disabled={l === 0 && !comp.variants.length}>
                {l === 3 ? 'Library' : l === 2 ? 'Usage' : l === 1 ? (parent?.name ?? 'Pattern') : comp.name}
              </button>
            </span>
          ))}
          {level === 0 && zones.length > 0 && <ZonePicker zones={zones} sel={sel} onSelect={k => select(k, 'option')} mismatch={z => zoneMismatch(lib, z, modes)} />}
          <div className="tools">
            {multiModeCols.map(c => (
              <div className="seg" key={c.id} title={`${c.name} collection modes`}>
                {c.modes.map(m => <button key={m.id} aria-pressed={(modes[c.id] ?? c.modes[0].id) === m.id} onClick={() => { if ((modes[c.id] ?? c.modes[0].id) !== m.id) sfx('tick'); setModes({ ...modes, [c.id]: m.id }); }}>{m.name}</button>)}
              </div>
            ))}
            <button className="pill-btn" aria-pressed={level === 0 ? panel : setPanelOpen} onClick={() => { sfx((level === 1 ? setPanelOpen : level === 0 && panel) ? 'close' : 'open'); if (level === 1) setSetPanelOpen(!setPanelOpen); else { goLevel(0); setPanel(!panel); } }}>Properties</button>
            <Shortcuts />
          </div>
        </div>
        <div className="stage" ref={stageRef} onClick={() => { setSel(null); }}>
          <Aurora depth={level} zone={sel ? zones.findIndex(z => z.key === sel) + 1 : 0} dark={dark} hover={Object.entries(vprops).some(([k, v]) => /^(state|status|interaction)$/i.test(k) && !/^default$/i.test(v))} />
          <Ambient depth={level} dark={dark} />
          {ghost && <DiveGhost key={ghost.k} dive={ghost} stage={stageSize} onDone={endGhost} />}
          <DepthRail level={level} disabled={l => l < 2 && !comp.variants.length} onGo={l => { if (clicked) setZoomed(true); goLevel(l); }}
            counts={[comp.variants.length ? `${zones.length} zones` : '—', `${parents.length}`, `${usageCount} contexts`, `${comps.length}`]} />
          <div className="level" data-state={state(3)}>{level === 3 && <LibraryLevel lib={lib} idx={idx} current={comp.id} onOpen={(id, el) => { dive(el, lib.components[id]?.name ?? '', 2); openComp(id, 2); }} />}</div>
          <div className="level" data-state={state(2)}>{level >= 2 && <UsageLevel key={comp.id} active={level === 2} lib={lib} idx={idx} comp={comp} onPattern={(id, el) => { const i = parents.findIndex(p => p.id === id); setParentIdx(Math.max(0, i)); dive(el, lib.components[id]?.name ?? '', 1); goLevel(1); }} onScreen={s => { sfx('open'); setScreen(s); }} screenOpen={!!screen} />}</div>
          <div className="level" data-state={state(1)}>
            {level <= 2 && <PatternLevel lib={lib} idx={idx} comp={comp} parents={parents} parentIdx={parentIdx} onParent={setParentIdx} modes={modes}
              active={level === 1} onEnter={(id, el) => { dive(el, lib.components[id]?.name ?? '', 0); if (id === comp.id) goLevel(0); else openComp(id, 0); }} panelOpen={setPanelOpen && level === 1} onPanel={o => { if (o !== setPanelOpen) sfx(o ? 'open' : 'close'); setSetPanelOpen(o); }} onEmptyUsage={() => goLevel(2)} />}
          </div>
          <div className="level" data-state={state(0)}>
            {variant && (
              <>
                <div className="hint" style={{ opacity: clicked || hintsDone ? 0 : 1, transform: clicked ? 'translateY(-6px)' : 'none' }}><span><span className="dot" />Click a zone of the component</span></div>
                <div className="hint" style={{ opacity: clicked && !zoomed && !panel && !hintsDone ? 1 : 0, transform: clicked && !zoomed ? 'none' : 'translateY(6px)', transition: 'opacity .3s ease-out .12s, transform .3s ease-out .12s' }}>
                  <span><span style={{ display: 'flex', gap: 3 }}><span className="kbd">↑</span><span className="kbd">↓</span></span>or scroll to change level · pinch or <span className="kbd">+</span><span className="kbd">−</span> to zoom</span>
                </div>
                <ComponentLevel key={comp.id} active={level === 0} lib={lib} variant={variant} zones={zones} sel={sel} onSelect={select} modes={modes} panelOpen={panel} onOpenPanel={() => { if (!panel) sfx('open'); setPanel(true); }} compName={comp.name}
                  toolbar={Object.keys(axes).length > 0 ? <VariantBar axes={axes} current={vprops} collapse={panel}
                    isOk={(k, v) => !!findVariant(comp, { ...vprops, [k]: v }) || comp.variants.some(x => x.props[k] === v)}
                    onPick={(k, v) => { sfx('pick'); const next = { ...vprops, [k]: v }; setVprops(findVariant(comp, next) ? next : comp.variants.find(x => x.props[k] === v)!.props); setSel(null); }} /> : undefined} />
                                <PropsPanel lib={lib} idx={idx} comp={comp} zones={zones} sel={sel} open={panel} modes={modes} onClose={() => { sfx('close'); setPanel(false); }} onSelect={select} onStep={step} onGoComponent={id => openComp(id, 0)} />
              </>
            )}
          </div>
          <aside className="panel" data-open={!!screen && level === 2} data-panel onClick={e => e.stopPropagation()}>
            {screen && (
              <>
                <div className="panel-head"><div className="t"><span className="eyebrow">Screen · page {screen.page}</span><span className="panel-title">{screen.name}</span></div><PanelModeButton /><button className="x-btn" onClick={() => { sfx('close'); setScreen(null); }} aria-label="Close">×</button></div>
                <div className="panel-body">
                  <div className="sec">
                    <FallbackImg key={screen.id + '|' + (previews.urls[screen.id] ?? '')} sources={previewSources(screen.id, previews.urls[screen.id])} fallback={null} alt={`Figma preview of ${screen.name}`} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
                    <span className="sec-t">Composition</span>
                    <div className="zone-list">
                      {screen.uses.map(u => (
                        <button key={u.id} onClick={() => lib.components[u.id] && openComp(u.id, 0)} disabled={!lib.components[u.id]}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--mute)' }}>×{u.count}</span>
                          <span style={{ font: '600 13px/1.2 var(--ui)', color: u.id === comp.id ? 'var(--violet)' : undefined }}>{u.name}</span>
                          <span style={{ font: '600 11px/1 var(--ui)', color: 'var(--violet)' }}>{lib.components[u.id] ? 'Open →' : ''}</span>
                        </button>
                      ))}
                    </div>
                    <span className="note">{screen.w}×{screen.h}px frame. Only instances of library components are listed.</span>
                    {lib.file.key && <a className="pill-btn" style={{ textDecoration: 'none', alignSelf: 'flex-start' }} target="_blank" rel="noreferrer" href={`https://www.figma.com/design/${lib.file.key}/?node-id=${screen.id.replace(':', '-')}`}>Open in Figma ↗</a>}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
