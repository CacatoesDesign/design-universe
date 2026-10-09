import { aliasClosure, cssVarName } from './library';
import type { Component, FNode, Library, Variable } from './types';
import { weightOf } from '../render/FigmaRender';
import { slotNodes } from './slots';

export const slug = (s: string) => slugRaw(s).replace(/^(\d)/, 'n-$1');
const slugRaw = (s: string) => s.toLowerCase().replace(/^[_\[\]\s]+/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'el';
export const pascal = (s: string) => slug(s).split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join('') || 'Component';

export class TokenCollector {
  used = new Set<string>();
  private lib: Library;
  constructor(lib: Library) { this.lib = lib; }
  ref(id: string | undefined, fallback: string): string {
    if (!id) return fallback;
    const v = this.lib.variables[id];
    if (!v) return `${fallback} /* variable ${id} missing from scan */`;
    this.used.add(id);
    return `var(${cssVarName(v).name})`;
  }
  rootCss(): string {
    const all = new Map<string, Variable>();
    for (const id of this.used) for (const v of aliasClosure(this.lib, id)) all.set(v.id, v);
    const valueCss = (v: Variable, modeId: string) => {
      const val = v.values[modeId] ?? Object.values(v.values)[0];
      if (val && typeof val === 'object') { const t = this.lib.variables[val.alias]; return t ? `var(${cssVarName(t).name})` : `/* alias ${val.alias} not found */`; }
      if (v.type === 'FLOAT') return /weight/i.test(v.name) ? String(val) : `${val}px`;
      if (v.type === 'STRING') return /family/i.test(v.name) ? `"${val}", Onest, system-ui, sans-serif` : `"${val}"`;
      return String(val);
    };
    const byTier = [...all.values()].sort((a, b) => a.collection.localeCompare(b.collection) || a.name.localeCompare(b.name));
    const lines: string[] = [':root {'];
    let col = '';
    const extraModes: string[] = [];
    for (const v of byTier) {
      const c = this.lib.collections[v.collection];
      if (v.collection !== col) { col = v.collection; lines.push(`  /* ${c?.name ?? v.collection}${c?.orphan ? ' (outside local collections)' : ''} */`); }
      const { name, derived } = cssVarName(v);
      lines.push(`  ${name}: ${valueCss(v, c?.modes[0]?.id ?? '')};${derived ? ' /* derived name: no WEB code syntax in Figma */' : ''}`);
      c?.modes.slice(1).forEach(m => {
        const a = valueCss(v, c.modes[0].id), b = valueCss(v, m.id);
        if (a !== b) extraModes.push(`  /* mode ${m.name} */ ${name}: ${b};`);
      });
    }
    lines.push('}');
    if (extraModes.length) lines.push('', '/* Secondary modes: the selector below is an implementation choice, not Figma data. */', '[data-mode="mobile"] {', ...extraModes, '}');
    return lines.join('\n');
  }
}

const JUST: Record<string, string> = { MN: 'flex-start', CR: 'center', MX: 'flex-end', SN: 'space-between' };
const ALI: Record<string, string> = { MN: 'flex-start', CR: 'center', MX: 'flex-end', BE: 'baseline' };

export function declsFor(n: FNode, tk: TokenCollector, root: boolean): string[] {
  const d: string[] = [];
  const b = n.b ?? {};
  if (n.lay) {
    const [dir, gap, pt, pr, pb, pl, pa, ca, wrap] = n.lay;
    d.push(root ? 'display: inline-flex' : 'display: flex');
    if (dir === 'V') d.push('flex-direction: column');
    if (wrap) d.push('flex-wrap: wrap');
    if ((n.c?.length ?? 0) > 1 && pa !== 'SN') d.push(`gap: ${tk.ref(b.itemSpacing, gap + 'px')}`);
    if (pt || pb || b.paddingTop) d.push(`padding-block: ${pt === pb ? tk.ref(b.paddingTop, pt + 'px') : `${tk.ref(b.paddingTop, pt + 'px')} ${tk.ref(b.paddingBottom, pb + 'px')}`}`);
    if (pl || pr || b.paddingLeft) d.push(`padding-inline: ${pl === pr ? tk.ref(b.paddingLeft, pl + 'px') : `${tk.ref(b.paddingLeft, pl + 'px')} ${tk.ref(b.paddingRight, pr + 'px')}`}`);
    if (JUST[pa] !== 'flex-start') d.push(`justify-content: ${JUST[pa]}`);
    if (ALI[ca] !== 'flex-start') d.push(`align-items: ${ALI[ca]}`);
  }
  const fill = n.f?.find(p => p.c);
  if (n.tx) {
    const t = n.tx;
    if (fill) d.push(`color: ${tk.ref(fill.v, fill.c!)}`);
    d.push(`font-family: ${tk.ref(b.fontFamily, `"${t.ff}", sans-serif`)}`);
    d.push(`font-size: ${tk.ref(b.fontSize, t.fs + 'px')}`);
    d.push(`font-weight: ${tk.ref(b.fontWeight, String(weightOf(t.st)))}`);
    if (t.lh != null) d.push(`line-height: ${typeof t.lh === 'number' ? t.lh + 'px' : +(parseFloat(t.lh) / 100).toFixed(3)}`);
    if (t.ls) d.push(`letter-spacing: ${t.ls}em`);
    if (t.ar === 'W') d.push('white-space: nowrap');
  } else if (fill) d.push(`background: ${tk.ref(fill.v, fill.c!)}`);
  else if (n.f?.some(p => p.img)) d.push('background: url(/* Figma image not exported */) center / cover');
  const stroke = n.s?.find(p => p.c);
  if (stroke) {
    if (n.sws) d.push(`border-style: solid`, `border-width: ${n.sws.map(w => w + 'px').join(' ')}`, `border-color: ${tk.ref(stroke.v, stroke.c!)}`);
    else d.push(`border: ${tk.ref(b.strokeTopWeight || b.strokeWeight, (n.sw ?? 1) + 'px')} solid ${tk.ref(stroke.v, stroke.c!)}`);
  }
  if (n.t === 'Ell') d.push('border-radius: 50%');
  else if (b.topLeftRadius || n.r) d.push(`border-radius: ${tk.ref(b.topLeftRadius, Array.isArray(n.r) ? n.r.map(r => r + 'px').join(' ') : n.r + 'px')}`);
  if (n.t === 'Ell' || n.t === 'Rec' || n.icon || n.svg || b.width) {
    d.push(`inline-size: ${tk.ref(b.width, n.w + 'px')}`, `block-size: ${tk.ref(b.height || b.width, n.h + 'px')}`, 'flex: none');
  }
  if (n.op !== undefined) d.push(`opacity: ${n.op}`);
  if (n.fx?.length) d.push(`box-shadow: ${n.fx.map(([t, x, y, r, sp, c, a]) => `${t === 'I' ? 'inset ' : ''}${x}px ${y}px ${r}px ${sp}px ${c}${Math.round(a * 255).toString(16).padStart(2, '0')}`).join(', ')}`);
  if (n.clip) d.push('overflow: hidden');
  return d;
}

interface El { cls: string; node: FNode; path: string }

function elementsOf(tree: FNode, base: string): El[] {
  const out: El[] = [];
  const counts: Record<string, number> = {};
  const walk = (n: FNode, path: number[]) => {
    if (path.length) {
      let s = n.tx ? 'label' : n.icon ? 'icon' : slug(n.n);
      if (n.ref && !n.icon) s = slug(n.n);
      counts[s] = (counts[s] ?? 0) + 1;
      out.push({ cls: `${base}__${s}${counts[s] > 1 ? '-' + counts[s] : ''}`, node: n, path: path.join('.') });
    }
    if (!n.icon && !(n.ref && path.length)) n.c?.forEach((c, i) => walk(c, [...path, i]));
  };
  walk(tree, []);
  return out;
}

const attr = (k: string) => 'data-' + slug(k);

export function componentCode(lib: Library, c: Component) {
  const tk = new TokenCollector(lib);
  const base = slug(c.name);
  const name = pascal(c.name);
  const def = c.variants[0];
  const css: string[] = [];
  for (const v of c.variants) {
    const sel = `.${base}` + Object.entries(v.props).map(([k, val]) => `[${attr(k)}="${val}"]`).join('');
    const block = (selector: string, decls: string[]) => decls.length && css.push(`${selector} {\n${decls.map(x => '  ' + x + ';').join('\n')}\n}`);
    block(sel, declsFor(v.tree, tk, true));
    for (const el of elementsOf(v.tree, base)) block(`${sel} .${el.cls}`, el.node.ref && !el.node.icon ? [`/* instance of ${el.node.n}: see its own component */`] : declsFor(el.node, tk, false));
  }
  const texts = Object.entries(c.props).filter(([, t]) => t === 'TEXT').map(([k]) => k);
  const axes: Record<string, string[]> = {};
  c.variants.forEach(v => Object.entries(v.props).forEach(([k, val]) => { (axes[k] ??= []).includes(val) || axes[k].push(val); }));
  let ti = 0;
  const deps = new Set<string>();
  // Slots natifs du composant (calques slot de la variante par défaut) : une prop ReactNode chacun.
  const slotNames = slotNodes(def.tree).map(x => x.name);
  const textProp = new Map<string, string>();
  const jsx = (n: FNode, path: number[], depth: number): string => {
    const pad = '  '.repeat(depth + 2);
    const el = elementsOf(def.tree, base).find(e => e.path === path.join('.'));
    const cls = path.length ? el?.cls ?? base : base;
    if (n.tx) {
      const p = texts[ti++];
      if (p) textProp.set(p, n.tx.c);
      return `${pad}<span className="${cls}">${p ? `{${propId(p)}}` : escapeJsx(n.tx.c)}</span>`;
    }
    if (n.icon || n.svg) return `${pad}<svg className="${cls}" aria-hidden="true" /* SVG ${n.icon ?? n.n} exported from Figma */ />`;
    if (n.t === 'Slo' && slotNames.includes(n.n)) {
      const kids = (n.c ?? []).map((k, i) => jsx(k, [...path, i], depth + 2));
      const id = slotPropId(c, n.n);
      return kids.length
        ? `${pad}<span className="${cls}">\n${pad}  {${id} ?? (\n${pad}    <>\n${kids.join('\n')}\n${pad}    </>\n${pad}  )}\n${pad}</span>`
        : `${pad}<span className="${cls}">{${id}}</span>`;
    }
    if (n.ref && path.length) { const dep = lib.components[n.ref]; if (dep) deps.add(dep.id); return dep ? `${pad}<${pascal(dep.name)} />` : `${pad}{/* instance ${n.n}: component missing from scan */}`; }
    const kids = (n.c ?? []).map((k, i) => jsx(k, [...path, i], depth + 1));
    const tag = path.length ? 'span' : 'button';
    const attrs = path.length ? '' : ` ${Object.keys(axes).map(k => `${attr(k)}={${propId(k)}}`).join(' ')}`;
    return kids.length ? `${pad}<${tag} className="${cls}"${attrs}>\n${kids.join('\n')}\n${pad}</${tag}>` : `${pad}<${tag} className="${cls}"${attrs} />`;
  };
  const body = jsx(def.tree, [], 0);
  const propsType = [
    ...Object.entries(axes).map(([k, vals]) => `  ${propId(k)}?: ${vals.map(v => `'${v}'`).join(' | ')};`),
    ...texts.map(t => `  ${propId(t)}?: string;`),
    ...slotNames.map(n => `  /** Figma slot "${n}": replaces its default content. */\n  ${slotPropId(c, n)}?: ReactNode;`),
  ];
  const defaults = [
    ...Object.keys(axes).map(k => `${propId(k)} = '${def.props[k]}'`),
    ...texts.map(t => `${propId(t)} = ${JSON.stringify(textProp.get(t) ?? t)}`),
    ...slotNames.map(n => slotPropId(c, n)),
  ];
  const tsx = `// ${c.name} — generated from Figma (${lib.file.name}), default variant: ${def.name}
${slotNames.length ? "import type { ReactNode } from 'react';\n" : ''}${[...deps].map(id => `import { ${pascal(lib.components[id].name)} } from './${pascal(lib.components[id].name)}';`).join('\n')}${deps.size ? '\n' : ''}import './${base}.css';

export interface ${name}Props {
${propsType.join('\n') || '  // no scanned variant properties'}
}

export function ${name}({ ${defaults.join(', ')} }: ${name}Props) {
  return (
${body}
  );
}
`;
  return { tsx, css: `${tk.rootCss()}\n\n${css.join('\n\n')}\n`, base, deps: [...deps] };
}

const RESERVED = new Set(['style', 'className', 'key', 'ref', 'children']);
/** Nom de prop React à partir d'une propriété Figma (évite les noms réservés comme `style`). */
export const propId = (s: string) => { const p = pascal(s); const id = p[0].toLowerCase() + p.slice(1); return RESERVED.has(id) ? id + 'Variant' : id; };
/** Prop React d'un slot : son nom, suffixé « Slot » s'il entre en collision avec une autre prop du composant. */
export const slotPropId = (c: Component, name: string) => {
  const id = propId(name);
  const taken = Object.entries(c.props).some(([k, t]) => t !== 'SLOT' && propId(k) === id);
  return taken ? id + 'Slot' : id;
};
const escapeJsx = (s: string) => s.replace(/[{}<>]/g, m => `{'${m}'}`);
