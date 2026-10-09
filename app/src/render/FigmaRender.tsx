import type { CSSProperties, ReactNode } from 'react';
import type { FNode, Library, Paint } from '../lib/types';
import { sanitizeSvg } from './sanitizeSvg';

const WEIGHTS: [RegExp, number][] = [[/thin/i, 100], [/extra ?light/i, 200], [/light/i, 300], [/semi ?bold/i, 600], [/extra ?bold/i, 800], [/bold/i, 700], [/black/i, 900], [/medium/i, 500]];
export const weightOf = (style: string) => WEIGHTS.find(([re]) => re.test(style))?.[1] ?? 400;
export const familyOf = (ff: string) => `"${ff}", Onest, Inter, system-ui, sans-serif`;

export function paintCss(p: Paint): string | null {
  if (p.c) {
    if (p.o !== undefined && p.o < 1) return p.c + Math.round(p.o * 255).toString(16).padStart(2, '0');
    return p.c;
  }
  if (p.g) return `linear-gradient(180deg, ${p.g.map(s => { const [c, pos] = s.split('@'); return `${c} ${Math.round(+pos * 100)}%`; }).join(', ')})`;
  if (p.img) return 'IMG';
  return null;
}

function backgroundOf(fills: Paint[]): CSSProperties {
  const layers = fills.map(paintCss).filter(Boolean) as string[];
  if (!layers.length) return {};
  const css = layers.reverse().map(l => (l === 'IMG' ? 'repeating-linear-gradient(45deg, #E8E4E0 0 6px, #F2EFEC 6px 12px)' : l.startsWith('linear') ? l : `linear-gradient(${l}, ${l})`));
  if (css.length === 1 && !layers[0].startsWith('linear') && layers[0] !== 'IMG') return { background: layers[0] };
  return { background: css.join(', ') };
}

const JUSTIFY: Record<string, string> = { MN: 'flex-start', CR: 'center', MX: 'flex-end', SN: 'space-between' };
const ALIGN: Record<string, string> = { MN: 'flex-start', CR: 'center', MX: 'flex-end', BE: 'baseline' };
const fixedKind = (n: FNode) => n.t === 'Ell' || n.t === 'Rec' || n.t === 'Vec' || !!n.icon || !!n.svg;

export function fillsAxis(n: FNode, parent: FNode, axis: 'h' | 'v'): boolean {
  const lay = parent.lay;
  if (!lay || fixedKind(n)) return false;
  const horizontal = lay[0] === 'H';
  const primary = (axis === 'h') === horizontal;
  const size = axis === 'h' ? n.w : n.h;
  const inner = axis === 'h' ? parent.w - lay[3] - lay[5] : parent.h - lay[2] - lay[4];
  if (!primary) return Math.abs(size - inner) <= 1.5;
  const kids = parent.c ?? [];
  const sum = kids.reduce((s, k) => s + (axis === 'h' ? k.w : k.h), 0) + lay[1] * Math.max(0, kids.length - 1);
  return Math.abs(sum - inner) <= 1.5;
}

export interface RenderOpts {
  lib: Library;
  texts?: Record<string, string>;
  dataPaths?: boolean;
  /** Contenu à poser dans les calques slot du composant (par nom de slot), à la place du contenu Figma. */
  slots?: Record<string, ReactNode>;
}

export function FigmaRender({ node, opts, style }: { node: FNode; opts: RenderOpts; style?: CSSProperties }) {
  return <>{renderNode(node, null, [], opts, style)}</>;
}

function renderNode(n: FNode, parent: FNode | null, path: number[], opts: RenderOpts, extra?: CSSProperties, nested = false): ReactNode {
  const s: CSSProperties = { boxSizing: 'border-box', position: 'relative', flex: 'none' };
  const key = path.join('.');
  const inAuto = !!parent?.lay;

  // Taille
  if (!parent) {
    const hasFill = (axis: 'h' | 'v') => (n.c ?? []).some(c => (axis === 'h' ? c.sh : c.sv) === 'F' && fillsAxis(c, n, axis));
    if (!n.lay || hasFill('h') || n.tx) s.width = n.w;
    if (!n.lay || hasFill('v')) s.height = n.h;
    if (n.lay) { s.minWidth = 0; }
  } else if (inAuto) {
    const horizontal = parent.lay![0] === 'H';
    for (const axis of ['h', 'v'] as const) {
      const mode = axis === 'h' ? n.sh : n.sv;
      const dim = axis === 'h' ? 'width' : 'height';
      const size = axis === 'h' ? n.w : n.h;
      const primary = (axis === 'h') === horizontal;
      if (mode === 'F' && fillsAxis(n, parent, axis)) {
        if (primary) { s.flex = '1 1 0'; s.minWidth = 0; } else s.alignSelf = 'stretch';
      } else if (mode === 'F' || !n.lay && !n.tx) s[dim] = size;
      else if (n.tx && mode === 'H') { /* hug texte */ }
    }
  } else {
    s.position = 'absolute'; s.left = n.x ?? 0; s.top = n.y ?? 0; s.width = n.w; s.height = n.h;
  }

  // Apparence
  if (n.op !== undefined) s.opacity = n.op;
  if (!n.tx && n.f?.length) Object.assign(s, backgroundOf(n.f));
  if (n.s?.length) {
    const c = n.s.map(paintCss).find(x => x && x !== 'IMG') ?? 'transparent';
    s.borderStyle = 'solid'; s.borderColor = c;
    s.borderWidth = n.sws ? n.sws.map(w => w + 'px').join(' ') : (n.sw ?? 1);
  }
  if (n.t === 'Ell') s.borderRadius = '50%';
  else if (Array.isArray(n.r)) s.borderRadius = n.r.map(r => r + 'px').join(' ');
  else if (n.r) s.borderRadius = n.r;
  if (n.fx?.length) s.boxShadow = n.fx.map(([t, x, y, r, sp, c, a]) => `${t === 'I' ? 'inset ' : ''}${x}px ${y}px ${r}px ${sp}px ${c}${Math.round(a * 255).toString(16).padStart(2, '0')}`).join(', ');
  if (n.clip) s.overflow = 'hidden';

  // Layout
  if (n.lay) {
    const [dir, gap, pt, pr, pb, pl, pa, ca, wrap] = n.lay;
    s.display = 'flex'; s.flexDirection = dir === 'H' ? 'row' : 'column';
    if (gap > 0 && pa !== 'SN') s.gap = gap;
    s.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    s.justifyContent = JUSTIFY[pa] ?? 'flex-start';
    s.alignItems = ALIGN[ca] ?? 'flex-start';
    if (wrap) s.flexWrap = 'wrap';
  }
  const negGap = n.lay && n.lay[1] < 0 ? n.lay[1] : 0;
  Object.assign(s, extra);
  const dp = opts.dataPaths ? { 'data-path': key } : {};

  // Texte
  if (n.tx) {
    const t = n.tx;
    const color = n.f?.map(paintCss).find(Boolean);
    Object.assign(s, {
      fontFamily: familyOf(t.ff), fontSize: t.fs, fontWeight: weightOf(t.st), fontStyle: /italic/i.test(t.st) ? 'italic' : undefined,
      lineHeight: t.lh == null ? 'normal' : typeof t.lh === 'number' ? t.lh + 'px' : (parseFloat(t.lh) / 100).toString(),
      letterSpacing: t.ls ? t.ls + 'em' : undefined, textAlign: ({ L: 'left', C: 'center', R: 'right', J: 'justify' } as const)[t.al as 'L'] ?? 'left',
      color, whiteSpace: t.ar === 'W' ? 'nowrap' : 'normal', overflowWrap: 'break-word',
    } as CSSProperties);
    if (t.ar !== 'W' && !s.width && !s.flex && !s.alignSelf) s.width = n.w;
    return <span key={key} style={s} {...dp}>{opts.texts?.[key] ?? t.c}</span>;
  }

  // Vecteurs et icônes
  const svgBody = n.icon ? opts.lib.icons[n.icon] : n.svg;
  if (svgBody !== undefined) {
    const safe = sanitizeSvg(svgBody);
    // Couleur de l'instance (ic) : remplace les couleurs du SVG partagé, en remplissage comme en contour (icônes au trait).
    const body = n.ic && /^#[0-9A-Fa-f]{6}$/.test(n.ic) ? safe.replace(/(fill|stroke)="#[0-9A-Fa-f]{6}"/g, `$1="${n.ic}"`) : safe;
    if (!s.width) s.width = n.w;
    if (!s.height) s.height = n.h;
    return <svg key={key} style={s} width={n.w} height={n.h} viewBox={`0 0 ${n.w} ${n.h}`} fill="none" {...dp} dangerouslySetInnerHTML={{ __html: body }} />;
  }

  if (!s.width && !s.flex && !n.lay && !s.alignSelf) s.width = n.w;
  if (!s.height && !n.lay && s.alignSelf !== 'stretch') s.height = n.h;
  // Slot rempli (au niveau du composant seulement) : le contenu fourni remplace celui de Figma et fixe la hauteur.
  const fill = n.t === 'Slo' && !nested ? opts.slots?.[n.n] : undefined;
  if (fill !== undefined) { delete s.height; s.minHeight = 0; return <div key={key} style={s} {...dp} data-slot={n.n}>{fill}</div>; }
  const inInstance = nested || (!!n.ref && path.length > 0);
  const kids = n.c?.map((c, i) => {
    const el = renderNode(c, n, [...path, i], opts, negGap && i > 0 ? { marginLeft: n.lay![0] === 'H' ? negGap : undefined, marginTop: n.lay![0] === 'V' ? negGap : undefined } : undefined, inInstance);
    return el;
  });
  return <div key={key} style={s} {...dp}>{kids}</div>;
}
