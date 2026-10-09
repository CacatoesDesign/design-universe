import type { Edge, Node } from '@xyflow/react';
import { componentCode, declsFor, pascal, propId, slotPropId, slug, TokenCollector } from '../../lib/codegen';
import { slotOfHandle } from '../../lib/slots';
import { findVariant } from '../../lib/library';
import type { FNode, Library } from '../../lib/types';
import { BREAKPOINT_HOOK, caseExpr, condExpr, isLogic, newLogicUse, propsName, screenSignature, type IfData, type LogicUse, type ShowData, type StateVar, type SwitchData } from './logic';

export interface CompData extends Record<string, unknown> { kind: 'component'; compId: string; vprops: Record<string, string>; texts: Record<string, string> }
export interface StackData extends Record<string, unknown> { kind: 'stack'; name: string; dir: 'H' | 'V'; gap?: string; pad?: string; bg?: string; radius?: string; justify: 'start' | 'center' | 'end' | 'space-between'; align: 'start' | 'center' | 'end' | 'stretch' }
export interface ScreenData extends Record<string, unknown> { kind: 'screen'; name: string; width: number; bg?: string; pad?: string; gap?: string }
/** Override d'un emplacement (composant) d'un pattern : variantes et textes propres à cette instance. */
export interface SlotOverride { vprops?: Record<string, string>; texts?: Record<string, string> }
export interface PatternData extends Record<string, unknown> { kind: 'pattern'; patternId: string; overrides: Record<number, SlotOverride> }
export type BData = CompData | StackData | ScreenData | PatternData | IfData | SwitchData | ShowData;
export type BNode = Node<BData>;

/** Définition enregistrée d'un pattern : un Stack et ses enfants, sans positions. */
export type PTree = { kind: 'component'; data: CompData; fill?: Record<string, PTree[]> } | { kind: 'stack'; data: StackData; children: PTree[] };
export interface Pattern { id: string; name: string; root: PTree; updatedAt: string }

export type Tree =
  | { kind: 'component'; id: string; data: CompData; slot?: number; fill?: Record<string, Tree[]> }
  | { kind: 'stack'; id: string; data: StackData; children: Tree[] }
  | { kind: 'screen'; id: string; data: ScreenData; children: Tree[] }
  | { kind: 'pattern'; id: string; data: PatternData; pattern: Pattern; child: Tree }
  | { kind: 'if'; id: string; data: IfData; then: Tree | null; else: Tree | null }
  | { kind: 'switch'; id: string; data: SwitchData; cases: (Tree | null)[]; fallback: Tree | null }
  | { kind: 'show'; id: string; data: ShowData; child: Tree | null };

/** Vrai si l'arbre contient un node logique (If, Router, Show) : il ne peut pas être figé en pattern. */
export const hasLogic = (t: Tree): boolean =>
  t.kind === 'if' || t.kind === 'switch' || t.kind === 'show' || ((t.kind === 'stack' || t.kind === 'screen') && t.children.some(hasLogic))
  || (t.kind === 'component' && Object.values(t.fill ?? {}).some(l => l.some(hasLogic)));

/** Slots remplis d'un composant : nom du slot → contenu, dans l'ordre (seuls les slots non vides). */
const fillOf = <T, U>(fill: Record<string, T[]> | undefined, f: (t: T) => U | null) => {
  const out: Record<string, U[]> = {};
  for (const [k, list] of Object.entries(fill ?? {})) { const l = list.map(f).filter(Boolean) as U[]; if (l.length) out[k] = l; }
  return Object.keys(out).length ? out : undefined;
};

/** Nœuds texte d'un arbre (ordre DFS, sans entrer dans les instances), alignés sur les props TEXT du composant. */
export function textNodes(t: FNode, path: number[] = [], out: { path: string; text: string; name: string }[] = []) {
  if (t.tx) out.push({ path: path.join('.'), text: t.tx.c, name: t.n });
  if (!(t.ref && path.length)) t.c?.forEach((c, i) => textNodes(c, [...path, i], out));
  return out;
}

/* ---------- Patterns ---------- */

/** Emplacements (composants) d'un pattern, en ordre DFS, avec un nom de prop stable (button1, button2…). */
export function slotsOf(lib: Library, p: Pattern) {
  const out: { index: number; data: CompData; name: string }[] = [];
  const count: Record<string, number> = {};
  const walk = (t: PTree) => {
    if (t.kind === 'component') {
      const base = propId(lib.components[t.data.compId]?.name ?? 'item');
      count[base] = (count[base] ?? 0) + 1;
      out.push({ index: out.length, data: t.data, name: base + count[base] });
      Object.values(t.fill ?? {}).forEach(l => l.forEach(walk));
    } else t.children.forEach(walk);
  };
  walk(p.root);
  return out;
}

/** Capture un Stack du canvas (et tout ce qui y est relié) en définition de pattern. */
export function snapshot(t: Tree): PTree | null {
  if (t.kind === 'component') { const fill = fillOf(t.fill, snapshot); return fill ? { kind: 'component', data: { ...t.data }, fill } : { kind: 'component', data: { ...t.data } }; }
  if (t.kind === 'stack') return { kind: 'stack', data: { ...t.data }, children: t.children.map(snapshot).filter(Boolean) as PTree[] };
  if (t.kind === 'pattern') return snapshot(t.child); // un pattern imbriqué est figé avec ses overrides
  return null;
}

function expand(p: PTree, prefix: string, overrides: Record<number, SlotOverride>, counter = { i: 0 }): Tree {
  if (p.kind === 'component') {
    const slot = counter.i++;
    const o = overrides[slot] ?? {};
    const data = { ...p.data, vprops: { ...p.data.vprops, ...o.vprops }, texts: { ...p.data.texts, ...o.texts } };
    return { kind: 'component', id: `${prefix}/s${slot}`, slot, data, fill: fillOf(p.fill, c => expand(c, prefix, overrides, counter)) };
  }
  return { kind: 'stack', id: `${prefix}/k${counter.i}`, data: p.data, children: p.children.map(c => expand(c, prefix, overrides, counter)) };
}

/* ---------- Arbre du canvas ---------- */

export function buildTree(nodes: BNode[], edges: Edge[], id: string, patterns: Record<string, Pattern> = {}, seen = new Set<string>()): Tree | null {
  const n = nodes.find(x => x.id === id); if (!n || seen.has(id)) return null;
  seen.add(id);
  if (n.data.kind === 'component') {
    // Slots : chaque poignée « slot:<nom> » reçoit des nodes, rangés de haut en bas (puis de gauche à droite).
    const fill: Record<string, BNode[]> = {};
    for (const e of edges) {
      const name = e.target === id ? slotOfHandle(e.targetHandle) : null;
      const src = name !== null && nodes.find(x => x.id === e.source);
      if (src) (fill[name!] ??= []).push(src);
    }
    Object.values(fill).forEach(l => l.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x));
    return { kind: 'component', id, data: n.data, fill: fillOf(fill, c => buildTree(nodes, edges, c.id, patterns, seen)) };
  }
  if (n.data.kind === 'pattern') {
    const p = patterns[n.data.patternId]; if (!p) return null;
    return { kind: 'pattern', id, data: n.data, pattern: p, child: expand(p.root, id, n.data.overrides) };
  }
  if (isLogic(n.data)) {
    // Une entrée par poignée : then / else, un cas du Router, ou l'entrée unique du Show.
    const at = (h: string) => { const e = edges.find(x => x.target === id && x.targetHandle === h); return e ? buildTree(nodes, edges, e.source, patterns, seen) : null; };
    if (n.data.kind === 'if') return { kind: 'if', id, data: n.data, then: at('then'), else: at('else') };
    if (n.data.kind === 'switch') return { kind: 'switch', id, data: n.data, cases: n.data.cases.map(k => at(k.id)), fallback: at('default') };
    return { kind: 'show', id, data: n.data, child: at('in') };
  }
  const children = edges.filter(e => e.target === id).map(e => nodes.find(x => x.id === e.source)).filter(Boolean)
    .sort((a, b) => (n.data.kind === 'stack' && n.data.dir === 'H' ? a!.position.x - b!.position.x : a!.position.y - b!.position.y))
    .map(c => buildTree(nodes, edges, c!.id, patterns, seen)).filter(Boolean) as Tree[];
  return n.data.kind === 'stack' ? { kind: 'stack', id, data: n.data, children } : { kind: 'screen', id, data: n.data as ScreenData, children };
}

export function variantOf(lib: Library, d: CompData) {
  const c = lib.components[d.compId];
  return c ? findVariant(c, d.vprops) ?? c.variants[0] : undefined;
}

/* ---------- Génération de code ---------- */

const J = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between', stretch: 'stretch' } as const;

interface Ctx {
  lib: Library; tk: TokenCollector; css: string[]; used: Set<string>; patterns: Map<string, Pattern>; n: { i: number }; prefix: string;
  vars: StateVar[]; logic: LogicUse;
  /** Dans une définition de pattern : expression JSX d'une prop d'emplacement. */
  slotProp?: (slot: number, prop: string) => string;
}

/** Attributs JSX d'un composant : variantes + textes surchargés. */
export function compAttrs(lib: Library, d: CompData, slotProp?: (prop: string) => string) {
  const c = lib.components[d.compId]!;
  const v = variantOf(lib, d);
  const texts = Object.entries(c.props).filter(([, k]) => k === 'TEXT').map(([k]) => k);
  const tn = v ? textNodes(v.tree) : [];
  const out: string[] = [];
  for (const [k, x] of Object.entries(v?.props ?? {})) out.push(slotProp ? `${propId(k)}={${slotProp(k)}}` : `${propId(k)}="${x}"`);
  texts.forEach((p, i) => {
    if (!tn[i]) return;
    if (slotProp) out.push(`${propId(p)}={${slotProp(p)}}`);
    else if (d.texts[tn[i].path] !== undefined) out.push(`${propId(p)}=${JSON.stringify(d.texts[tn[i].path])}`);
  });
  return out;
}

function emit(t: Tree, depth: number, ctx: Ctx): string {
  const pad = '  '.repeat(depth + 2);
  const { lib } = ctx;
  if (t.kind === 'component') {
    const c = lib.components[t.data.compId]; if (!c) return `${pad}{/* component ${t.data.compId} not found */}`;
    ctx.used.add(c.id);
    const attrs = compAttrs(lib, t.data, ctx.slotProp && t.slot !== undefined ? p => ctx.slotProp!(t.slot!, p) : undefined);
    // Slots remplis : une prop ReactNode par slot, avec son contenu en fragment.
    for (const [name, list] of Object.entries(t.fill ?? {})) {
      const inner = list.map(x => emit(x, depth + 2, ctx)).join('\n');
      attrs.push(`${slotPropId(c, name)}={\n${pad}  <>\n${inner}\n${pad}  </>\n${pad}}`);
    }
    return `${pad}<${pascal(c.name)}${attrs.length ? ' ' + attrs.join(' ') : ''} />`;
  }
  if (t.kind === 'pattern') {
    ctx.patterns.set(t.pattern.id, t.pattern);
    const slots = slotsOf(lib, t.pattern);
    const attrs: string[] = [];
    for (const s of slots) {
      const o = t.data.overrides[s.index]; if (!o) continue;
      const c = lib.components[s.data.compId]; if (!c) continue;
      for (const [k, x] of Object.entries(o.vprops ?? {})) if (x !== s.data.vprops[k]) attrs.push(`${s.name}${pascal(k)}="${x}"`);
      const v = variantOf(lib, { ...s.data, vprops: { ...s.data.vprops, ...o.vprops } });
      const tn = v ? textNodes(v.tree) : [];
      Object.entries(c.props).filter(([, k]) => k === 'TEXT').forEach(([p], i) => {
        const val = tn[i] && o.texts?.[tn[i].path];
        if (val !== undefined && val !== s.data.texts[tn[i].path]) attrs.push(`${s.name}${pascal(p)}=${JSON.stringify(val)}`);
      });
    }
    return `${pad}<${pascal(t.pattern.name)}${attrs.length ? ' ' + attrs.join(' ') : ''} />`;
  }
  if (t.kind === 'if' || t.kind === 'switch' || t.kind === 'show') return emitLogic(t, depth, ctx);
  const cls = t.kind === 'screen' ? 'screen' : `${ctx.prefix}${slug(t.data.name) || 'stack'}-${++ctx.n.i}`;
  const d = t.data;
  const decls = t.kind === 'screen'
    ? ['display: flex', 'flex-direction: column', `inline-size: min(100%, ${(d as ScreenData).width}px)`, 'margin-inline: auto']
    : ['display: flex', ...((d as StackData).dir === 'V' ? ['flex-direction: column'] : []), `justify-content: ${J[(d as StackData).justify]}`, `align-items: ${J[(d as StackData).align]}`];
  const val = (id: string) => ctx.tk.ref(id, '0');
  if (d.gap) decls.push(`gap: ${val(d.gap)}`);
  if (d.pad) decls.push(`padding: ${val(d.pad)}`);
  if (d.bg) decls.push(`background: ${val(d.bg)}`);
  if (t.kind === 'stack' && t.data.radius) decls.push(`border-radius: ${val(t.data.radius)}`);
  ctx.css.push(`.${cls} {\n${decls.map(x => '  ' + x + ';').join('\n')}\n}`);
  const tag = t.kind === 'screen' ? 'main' : 'div';
  const kids = t.children.map(c => emit(c, depth + 1, ctx));
  return `${pad}<${tag} className="${cls}">\n${kids.join('\n')}${kids.length ? '\n' : ''}${pad}</${tag}>`;
}

/** Branche d'une condition : le JSX de l'enfant entre parenthèses, ou null. */
function branch(t: Tree | null, depth: number, ctx: Ctx) {
  if (!t) return 'null';
  const pad = '  '.repeat(depth + 2);
  return `(\n${emit(t, depth + 1, ctx)}\n${pad})`;
}

/** If → ternaire, Router → ternaires chaînés, Show → `cond && (…)`. Imbriqués, ils restent des expressions. */
function logicExpr(t: Tree & { kind: 'if' | 'switch' | 'show' }, depth: number, ctx: Ctx): string {
  const { lib, vars, logic } = ctx;
  // Logique imbriquée entre parenthèses : sinon `show && a ? <A/> : <B/>` se lit `(show && a) ? …`.
  const sub = (c: Tree | null) => (c && isLogic(c.data) ? `(${logicExpr(c as Tree & { kind: 'if' | 'switch' | 'show' }, depth, ctx)})` : branch(c, depth, ctx));
  if (t.kind === 'if') return `${condExpr(lib, vars, t.data.cond, logic)} ? ${sub(t.then)} : ${sub(t.else)}`;
  if (t.kind === 'show') return `${condExpr(lib, vars, t.data.cond, logic)} && ${sub(t.child)}`;
  const pad = '  '.repeat(depth + 2);
  const arms = t.data.cases.map((k, i) => `${caseExpr(lib, vars, t.data.subject, k.value, logic)} ? ${sub(t.cases[i])}`);
  return arms.length ? `${arms.join(`\n${pad}  : `)}\n${pad}  : ${sub(t.fallback)}` : sub(t.fallback);
}

function emitLogic(t: Tree & { kind: 'if' | 'switch' | 'show' }, depth: number, ctx: Ctx) {
  const pad = '  '.repeat(depth + 2);
  return `${pad}{${logicExpr(t, depth, ctx)}}`;
}

/** Code d'un pattern : un composant React dont chaque emplacement expose ses variantes et textes en props. */
export function patternCode(lib: Library, p: Pattern) {
  const tk = new TokenCollector(lib);
  const name = pascal(p.name);
  const slots = slotsOf(lib, p);
  const props: string[] = [], defaults: string[] = [];
  for (const s of slots) {
    const c = lib.components[s.data.compId]; if (!c) continue;
    const v = variantOf(lib, s.data);
    for (const [k, vals] of Object.entries(c.props)) {
      if (Array.isArray(vals) && v?.props[k] !== undefined) {
        const avail = [...new Set(c.variants.map(x => x.props[k]).filter(Boolean))];
        props.push(`  ${s.name}${pascal(k)}?: ${avail.map(x => `'${x}'`).join(' | ')};`);
        defaults.push(`${s.name}${pascal(k)} = '${v.props[k]}'`);
      }
    }
    const tn = v ? textNodes(v.tree) : [];
    Object.entries(c.props).filter(([, k]) => k === 'TEXT').forEach(([t], i) => {
      if (!tn[i]) return;
      props.push(`  ${s.name}${pascal(t)}?: string;`);
      defaults.push(`${s.name}${pascal(t)} = ${JSON.stringify(s.data.texts[tn[i].path] ?? tn[i].text)}`);
    });
  }
  const ctx: Ctx = { lib, tk, css: [], used: new Set(), patterns: new Map(), n: { i: 0 }, prefix: slug(p.name) + '__', vars: [], logic: newLogicUse(),
    slotProp: (slot, prop) => `${slots[slot].name}${pascal(prop)}` };
  const body = emit(expand(p.root, 'p', {}), 0, ctx);
  const imports = [...ctx.used].map(id => `import { ${pascal(lib.components[id].name)} } from './${pascal(lib.components[id].name)}';`);
  const tsx = `// Pattern "${p.name}" — created in the DS Universe Builder
${imports.join('\n')}
import './${slug(p.name)}.css';

export interface ${name}Props {
${props.join('\n') || '  // no configurable slots'}
}

export function ${name}({ ${defaults.join(', ')} }: ${name}Props) {
  return (
${body}
  );
}
`;
  return { name, tsx, css: `${tk.rootCss()}\n\n${ctx.css.join('\n\n')}\n`, deps: [...ctx.used] };
}

export function generateScreen(lib: Library, root: Tree, vars: StateVar[] = []) {
  const ctx: Ctx = { lib, tk: new TokenCollector(lib), css: [], used: new Set(), patterns: new Map(), n: { i: 0 }, prefix: '', vars, logic: newLogicUse() };
  const body = emit(root, 0, ctx);
  const name = pascal(root.kind === 'screen' ? root.data.name : 'Screen');
  const imports = [
    ...[...ctx.patterns.values()].map(p => `import { ${pascal(p.name)} } from './patterns/${pascal(p.name)}';`),
    ...[...ctx.used].map(id => `import { ${pascal(lib.components[id].name)} } from './components/${pascal(lib.components[id].name)}';`),
  ];
  // Conditions : variables et modes deviennent des props de l'écran, le breakpoint un hook.
  const sig = screenSignature(lib, vars, ctx.logic);
  if (ctx.logic.bp) imports.push(`import { useBreakpoint } from './hooks/useBreakpoint';`);
  const propsDecl = sig.props.length ? `export interface ${propsName(name)} {\n${sig.props.join('\n')}\n}\n\n` : '';
  const params = sig.props.length ? `{ ${sig.defaults.join(', ')} }: ${propsName(name)}` : '';
  const tsx = `${imports.join('\n')}\nimport './${slug(name)}.css';\n\n${propsDecl}export function ${name}(${params}) {\n${sig.hooks.map(h => h + '\n').join('')}  return (\n${body}\n  );\n}\n`;
  const hooks = ctx.logic.bp ? [{ name: 'useBreakpoint', tsx: BREAKPOINT_HOOK }] : [];
  const patterns = [...ctx.patterns.values()].map(p => ({ id: p.id, ...patternCode(lib, p) }));
  const components: ({ id: string; name: string } & ReturnType<typeof componentCode>)[] = [];
  const queue = [...ctx.used, ...patterns.flatMap(p => p.deps)];
  const done = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (done.has(id) || !lib.components[id]) continue;
    done.add(id);
    const code = componentCode(lib, lib.components[id]);
    components.push({ id, name: pascal(lib.components[id].name), ...code });
    queue.push(...code.deps);
  }
  return { tsx, css: `${ctx.tk.rootCss()}\n\n${ctx.css.join('\n\n')}\n`, components, patterns, hooks };
}

export { declsFor };
