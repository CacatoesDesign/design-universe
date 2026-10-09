import { createContext, useContext, type CSSProperties } from 'react';
import { slotNodes, type SlotPicks } from '../../lib/slots';
import { FigmaRender, fillsAxis } from '../../render/FigmaRender';
import { resolveVar } from '../../lib/library';
import type { FNode, Library, Modes } from '../../lib/types';
import { variantOf, type BData, type Pattern, type Tree } from './compose';
import { evalCond, switchPick, type Env } from './logic';

export interface Ctx {
  lib: Library; modes: Modes; patterns: Record<string, Pattern>;
  update: (id: string, patch: Partial<BData>) => void; remove: (id: string) => void;
  savePattern: (stackId: string, name: string) => string | null; detach: (nodeId: string) => void;
  /** Valeurs simulées (variables, breakpoint, modes) qui pilotent les nodes logiques. */
  env: Env;
  /** Retire les liens arrivant sur une poignée (cas de Router supprimé). */
  dropEdges: (target: string, handle: string) => void;
  /** Composants choisis par slot (mémorisés par lib) et ajout d'un composant relié à un slot. */
  slotPicks: SlotPicks; setSlotPicks: (key: string, ids: string[]) => void;
  fillSlot: (nodeId: string, slot: string, compId: string) => void;
}
export const BuilderCtx = createContext<Ctx>(null!);
export const useBuilder = () => useContext(BuilderCtx);

export function useVal() {
  const { lib, modes } = useBuilder();
  return (id?: string) => { if (!id) return undefined; const v = resolveVar(lib, id, modes).value; return typeof v === 'number' ? v : typeof v === 'string' ? v : undefined; };
}

const slotDir = (tree: FNode, name: string) => slotNodes(tree).find(x => x.name === name)?.dir;

const JUST = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between', stretch: 'stretch' } as const;

/** Rendu live d'une composition (composants, Stacks, patterns, Screen) avec les valeurs de tokens résolues. */
export function Live({ t, stretch = false }: { t: Tree; stretch?: boolean }) {
  const { lib, env } = useBuilder();
  const val = useVal();
  // Logique : seule la branche retenue par la simulation s'affiche.
  if (t.kind === 'if') { const c = evalCond(env, t.data.cond) ? t.then : t.else; return c ? <Live t={c} stretch={stretch} /> : null; }
  if (t.kind === 'show') return t.child && evalCond(env, t.data.cond) ? <Live t={t.child} stretch={stretch} /> : null;
  if (t.kind === 'switch') { const k = switchPick(env, t.data); const i = t.data.cases.findIndex(x => x.id === k); const c = i < 0 ? t.fallback : t.cases[i]; return c ? <Live t={c} stretch={stretch} /> : null; }
  if (t.kind === 'pattern') return <Live t={t.child} stretch={stretch} />;
  if (t.kind === 'component') {
    const v = variantOf(lib, t.data);
    if (!v) return null;
    // Un composant conçu fluide (enfants en FILL) s'étire ; un composant en HUG garde sa taille.
    const fluid = (v.tree.c ?? []).some(c => c.sh === 'F' && fillsAxis(c, v.tree, 'h'));
    // Slots remplis : chaque élément s'étire dans un slot vertical, garde sa taille dans un slot horizontal.
    const slots = t.fill && Object.fromEntries(Object.entries(t.fill).map(([k, list]) => [k, list.map(c => <Live key={c.id} t={c} stretch={slotDir(v.tree, k) === 'V'} />)]));
    return <FigmaRender node={v.tree} opts={{ lib, texts: t.data.texts, slots }} style={stretch ? (fluid ? { width: '100%' } : { alignSelf: 'flex-start' }) : undefined} />;
  }
  const d = t.data;
  const s: CSSProperties = { display: 'flex', flexDirection: t.kind === 'screen' || (d as { dir?: string }).dir === 'V' ? 'column' : 'row', gap: val(d.gap) as number, padding: val(d.pad) as number, background: val(d.bg) as string };
  if (t.kind === 'stack') { s.justifyContent = JUST[t.data.justify]; s.alignItems = JUST[t.data.align]; s.borderRadius = val(t.data.radius) as number; }
  else { s.width = t.data.width; s.minHeight = 120; }
  const kidStretch = t.kind === 'screen' || (t.data.dir === 'V' && t.data.align === 'stretch');
  return <div style={s}>{t.children.map(c => <Live key={c.id} t={c} stretch={kidStretch} />)}{!t.children.length && <span style={{ font: '500 11px/1.4 var(--ui)', color: '#9A9A9A', padding: 8 }}>Connect nodes here</span>}</div>;
}

export function VarSelect({ value, onChange, prefix, label }: { value?: string; onChange: (v?: string) => void; prefix: RegExp; label: string }) {
  const { lib } = useBuilder();
  const opts = Object.values(lib.variables).filter(v => v.local && prefix.test(v.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return (
    <label className="row">{label}
      <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {opts.map(v => { const r = resolveVar(lib, v.id).value; return <option key={v.id} value={v.id}>{v.name}{typeof r === 'number' ? ` · ${r}` : ''}</option>; })}
      </select>
    </label>
  );
}
