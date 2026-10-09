import libraryUrl from '../data/library.json?url';
import type { Component, FNode, Library, Modes, Screen, Tier, Variable, VarValue } from './types';

/** Lib de démo (Simple Design System), servie comme fichier JSON à part : ni parsée comme du JS, ni dans le bundle. */
export async function loadDefaultLibrary(): Promise<Library> {
  const r = await fetch(libraryUrl);
  if (!r.ok) throw new Error(`library.json: HTTP ${r.status}`);
  return (await r.json()) as Library;
}

/* ---------- Variables ---------- */

const PRIMITIVE_COLS = /primitive|^sizes?$|^radius$|^border width$/i;
const COMPONENT_COLS = /^component$|avatar stack/i;

/** Identifiant stable de la lib (stockage local, remontage) : clé du fichier Figma, sinon nom + date du scan. */
export const libId = (lib: Library) => lib.file.key || `local:${lib.file.name}@${lib.file.scannedAt}`;

export function tierOf(lib: Library, v: Variable): Tier {
  const name = lib.collections[v.collection]?.name ?? '';
  if (COMPONENT_COLS.test(name)) return 'Component';
  if (PRIMITIVE_COLS.test(name)) return 'Primitive';
  return 'Semantic';
}

/** Nom de variable CSS : code syntax WEB de Figma si renseigné, sinon dérivé du nom. */
export function cssVarName(v: Variable): { name: string; derived: boolean } {
  if (v.css) return { name: '--' + v.css, derived: false };
  return { name: '--' + v.name.toLowerCase().replace(/[\/\s]+/g, '-').replace(/[^a-z0-9-]/g, ''), derived: true };
}

export function modeFor(lib: Library, colId: string, modes: Modes): string {
  const col = lib.collections[colId];
  return modes[colId] ?? col?.modes[0]?.id ?? '';
}

export interface ResolveStep { v: Variable; mode: string; modeName: string }
export interface Resolution { steps: ResolveStep[]; value: VarValue | undefined; broken?: string }

export function resolveVar(lib: Library, id: string, modes: Modes = {}): Resolution {
  const steps: ResolveStep[] = [];
  let cur: string | undefined = id;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) return { steps, value: undefined, broken: 'alias loop' };
    seen.add(cur);
    const v: Variable | undefined = lib.variables[cur];
    if (!v) return { steps, value: undefined, broken: `variable ${cur} not found in scan` };
    const m = modeFor(lib, v.collection, modes);
    const col = lib.collections[v.collection];
    steps.push({ v, mode: m, modeName: col?.modes.find(x => x.id === m)?.name ?? m });
    const val: VarValue | undefined = v.values[m] ?? Object.values(v.values)[0];
    if (val && typeof val === 'object' && 'alias' in val) { cur = val.alias; continue; }
    return { steps, value: val };
  }
  return { steps, value: undefined };
}

/** Variable + toutes ses cibles d'alias, dans tous les modes (protégé contre les boucles). */
export function aliasClosure(lib: Library, id: string): Variable[] {
  const out: Variable[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const v = lib.variables[cur];
    if (!v) continue;
    out.push(v);
    for (const val of Object.values(v.values)) if (val && typeof val === 'object' && 'alias' in val) stack.push(val.alias);
  }
  return out;
}

export function formatValue(val: VarValue | undefined, type?: Variable['type']): string {
  if (val === undefined) return '—';
  if (typeof val === 'object') return '→ alias';
  if (typeof val === 'number') return type === 'FLOAT' ? (val >= 999 ? `${val}px · pill` : `${+val.toFixed(2)}px`) : String(val);
  return String(val);
}

/* ---------- Zones (propriétés liées à des variables) ---------- */

export interface Zone {
  key: string;
  path: number[];
  node: FNode;
  label: string;
  figmaProp: string;
  cssProp: string;
  varId?: string;
  raw: string | number | undefined;
  kind: 'color' | 'dimension' | 'type' | 'instance';
  refComponent?: string;
}

const isTextual = (n: FNode) => n.t === 'Tex';
const isShape = (n: FNode) => n.t === 'Ell' || n.t === 'Rec';

function bindingZones(n: FNode, path: number[], prefix: string): Zone[] {
  const out: Zone[] = [];
  const b = n.b ?? {};
  const k = path.join('.');
  const P = (s: string) => (prefix ? `${prefix} · ${s}` : s);
  const lay = n.lay;
  const fill = n.f?.find(p => p.c);
  if (fill) {
    if (isTextual(n)) out.push({ key: k + ':color', path, node: n, label: P('Text color'), figmaProp: 'Text · Fill', cssProp: 'color', varId: fill.v, raw: fill.c, kind: 'color' });
    else out.push({ key: k + ':bg', path, node: n, label: P(isShape(n) ? `Fill ${n.n}` : 'Background'), figmaProp: 'Fill', cssProp: 'background', varId: fill.v, raw: fill.c, kind: 'color' });
  }
  const stroke = n.s?.find(p => p.c);
  if (stroke) out.push({ key: k + ':border', path, node: n, label: P('Border'), figmaProp: 'Stroke', cssProp: 'border-color', varId: stroke.v, raw: stroke.c, kind: 'color' });
  if (b.strokeTopWeight || b.strokeWeight) out.push({ key: k + ':bw', path, node: n, label: P('Border width'), figmaProp: 'Stroke weight', cssProp: 'border-width', varId: b.strokeTopWeight || b.strokeWeight, raw: n.sw, kind: 'dimension' });
  if (lay) {
    // Valeur brute du côté qui porte le token (padding asymétrique : haut 0, bas lié à Space/400…).
    if (b.paddingLeft || b.paddingRight || lay[5] || lay[3]) out.push({ key: k + ':px', path, node: n, label: P('Horizontal padding'), figmaProp: 'Auto layout · Horizontal padding', cssProp: 'padding-inline', varId: b.paddingLeft || b.paddingRight, raw: b.paddingLeft || !b.paddingRight ? lay[5] : lay[3], kind: 'dimension' });
    if (b.paddingTop || b.paddingBottom || lay[2] || lay[4]) out.push({ key: k + ':py', path, node: n, label: P('Vertical padding'), figmaProp: 'Auto layout · Vertical padding', cssProp: 'padding-block', varId: b.paddingTop || b.paddingBottom, raw: b.paddingTop || !b.paddingBottom ? lay[2] : lay[4], kind: 'dimension' });
    if ((b.itemSpacing || lay[1]) && (n.c?.length ?? 0) > 1) out.push({ key: k + ':gap', path, node: n, label: P('Gap'), figmaProp: 'Auto layout · Gap', cssProp: 'gap', varId: b.itemSpacing, raw: lay[1], kind: 'dimension' });
  }
  if (b.topLeftRadius || (typeof n.r === 'number' && n.r > 0)) out.push({ key: k + ':radius', path, node: n, label: P('Radius'), figmaProp: 'Corner radius', cssProp: 'border-radius', varId: b.topLeftRadius, raw: typeof n.r === 'number' ? n.r : undefined, kind: 'dimension' });
  if (b.width) out.push({ key: k + ':size', path, node: n, label: P('Size'), figmaProp: 'Width · Height', cssProp: 'inline-size', varId: b.width, raw: n.w, kind: 'dimension' });
  if (n.tx) {
    if (b.fontSize || n.tx.fs) out.push({ key: k + ':fs', path, node: n, label: P('Font size'), figmaProp: 'Text · Font size', cssProp: 'font-size', varId: b.fontSize, raw: n.tx.fs, kind: 'type' });
    if (b.fontWeight) out.push({ key: k + ':fw', path, node: n, label: P('Font weight'), figmaProp: 'Text · Weight', cssProp: 'font-weight', varId: b.fontWeight, raw: n.tx.st, kind: 'type' });
    if (b.fontFamily) out.push({ key: k + ':ff', path, node: n, label: P('Font family'), figmaProp: 'Text · Font family', cssProp: 'font-family', varId: b.fontFamily, raw: n.tx.ff, kind: 'type' });
  }
  if (n.icon && n.ic) out.push({ key: k + ':icon', path, node: n, label: P('Icon color'), figmaProp: 'Vector · Fill', cssProp: 'color', varId: n.icv, raw: n.ic, kind: 'color' });
  return out;
}

/** Zones d'un variant : le calque racine, ses descendants, et les instances imbriquées (sans entrer dedans). */
export function zonesOf(tree: FNode): Zone[] {
  const out: Zone[] = [];
  const textCount = { n: 0 };
  const countText = (n: FNode) => { if (n.t === 'Tex') textCount.n++; if (!n.ref) n.c?.forEach(countText); };
  countText(tree);
  const walk = (n: FNode, path: number[], depth: number) => {
    if (depth > 0 && n.ref && !n.icon) {
      out.push({ key: path.join('.') + ':inst', path, node: n, label: `Instance · ${n.n}`, figmaProp: 'Instance', cssProp: '', raw: undefined, kind: 'instance', refComponent: n.ref });
      return;
    }
    const prefix = depth === 0 ? '' : n.t === 'Tex' ? (textCount.n > 1 ? n.n.slice(0, 18) : 'Label') : n.icon ? 'Icon' : n.n.slice(0, 18);
    out.push(...bindingZones(n, path, prefix));
    if (!n.icon) n.c?.forEach((c, i) => walk(c, [...path, i], depth + 1));
  };
  walk(tree, [], 0);
  return out;
}

export function nodeAt(tree: FNode, path: number[]): FNode | undefined {
  let n: FNode | undefined = tree;
  for (const i of path) n = n?.c?.[i];
  return n;
}

/* ---------- Audit : valeur Figma vs valeur du token ---------- */

export function zoneMismatch(lib: Library, z: Zone, modes: Modes): string | null {
  if (!z.varId || z.raw === undefined) return null;
  const r = resolveVar(lib, z.varId, modes);
  if (r.value === undefined || typeof r.value === 'object') return null;
  if (typeof r.value === 'number' && typeof z.raw === 'number') {
    if (Math.abs(r.value - z.raw) > 0.5 && !(r.value >= 999 && z.raw >= 999)) return `Figma value ${z.raw}px ≠ token ${r.value}px`;
    return null;
  }
  if (typeof r.value === 'string' && typeof z.raw === 'string' && z.kind === 'color' && r.value.startsWith('#')) {
    if (r.value.slice(0, 7).toUpperCase() !== z.raw.slice(0, 7).toUpperCase()) return `Figma color ${z.raw} ≠ token ${r.value}`;
  }
  return null;
}

/* ---------- Relations ---------- */

export interface Indexes {
  parents: Record<string, string[]>;          // composant -> patterns qui l'instancient
  screens: Record<string, string[]>;          // composant -> écrans (ids) qui l'utilisent
  varUsage: Record<string, Set<string>>;      // variable -> composants qui la lient (directement ou via alias)
  componentVars: Record<string, Set<string>>; // composant -> variables liées
}

export function buildIndexes(lib: Library): Indexes {
  const parents: Record<string, string[]> = {};
  const screens: Record<string, string[]> = {};
  const varUsage: Record<string, Set<string>> = {};
  const componentVars: Record<string, Set<string>> = {};
  for (const c of Object.values(lib.components)) {
    for (const u of c.uses) if (lib.components[u.id]) (parents[u.id] ??= []).push(c.id);
    const set = (componentVars[c.id] = new Set());
    const walk = (n: FNode) => {
      for (const v of Object.values(n.b ?? {})) set.add(v);
      n.f?.forEach(p => p.v && set.add(p.v));
      n.s?.forEach(p => p.v && set.add(p.v));
      if (n.icv) set.add(n.icv);
      n.c?.forEach(walk);
    };
    c.variants.forEach(v => walk(v.tree));
    for (const id of set) {
      for (const v of aliasClosure(lib, id)) (varUsage[v.id] ??= new Set()).add(c.id);
    }
  }
  for (const s of lib.screens) for (const u of s.uses) (screens[u.id] ??= []).push(s.id);
  return { parents, screens, varUsage, componentVars };
}

export function defaultVariant(c: Component) {
  return c.variants[0];
}

export function findVariant(c: Component, props: Record<string, string>) {
  return c.variants.find(v => Object.entries(props).every(([k, val]) => v.props[k] === val)) ?? null;
}

/** Options de variantes réellement disponibles (celles dont l'arbre a été scanné). */
export function variantAxes(c: Component): Record<string, string[]> {
  const axes: Record<string, string[]> = {};
  for (const v of c.variants) for (const [k, val] of Object.entries(v.props)) {
    const a = (axes[k] ??= []);
    if (!a.includes(val)) a.push(val);
  }
  return axes;
}

export function textProps(c: Component): string[] {
  return Object.entries(c.props).filter(([, t]) => t === 'TEXT').map(([k]) => k);
}

/** Contextes d'usage d'un composant : patterns qui l'instancient, écrans directs, puis écrans via ces patterns. */
export type UsageCtx = { kind: 'pattern'; comp: Component; via?: undefined } | { kind: 'screen'; screen: Screen; via?: string };
export function usageContexts(lib: Library, idx: Indexes, compId: string): UsageCtx[] {
  const out: UsageCtx[] = [];
  for (const pid of idx.parents[compId] ?? []) { const p = lib.components[pid]; if (p?.variants.length) out.push({ kind: 'pattern', comp: p }); }
  const seen = new Set<string>();
  const screensById = Object.fromEntries(lib.screens.map(s => [s.id, s]));
  for (const sid of idx.screens[compId] ?? []) if (screensById[sid] && !seen.has(sid)) { seen.add(sid); out.push({ kind: 'screen', screen: screensById[sid] }); }
  for (const pid of idx.parents[compId] ?? []) for (const sid of idx.screens[pid] ?? []) if (screensById[sid] && !seen.has(sid)) { seen.add(sid); out.push({ kind: 'screen', screen: screensById[sid], via: lib.components[pid]?.name }); }
  return out;
}
