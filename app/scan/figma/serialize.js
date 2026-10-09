// Sérialiseur Plugin API → format compact FNode (voir src/lib/types.ts et src/render/FigmaRender.tsx).
// Collé en tête de chaque script use_figma (lecture seule). Retourne aussi les icônes rencontrées.
const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const TYPE = { COMPONENT: 'Com', INSTANCE: 'Ins', FRAME: 'Fra', TEXT: 'Tex', ELLIPSE: 'Ell', RECTANGLE: 'Rec', VECTOR: 'Vec', GROUP: 'Fra', BOOLEAN_OPERATION: 'Vec', LINE: 'Vec', STAR: 'Vec', POLYGON: 'Vec', COMPONENT_SET: 'Fra', SLOT: 'Slo' };
const AX = { MIN: 'MN', CENTER: 'CR', MAX: 'MX', SPACE_BETWEEN: 'SN', BASELINE: 'BE' };
const round = v => Math.round(v * 100) / 100;
const paints = (arr, bound) => {
  if (!Array.isArray(arr)) return undefined;
  const out = [];
  arr.forEach((p, i) => {
    if (p.visible === false) return;
    if (p.type === 'SOLID') { const o = { c: hex(p.color) }; if (p.opacity !== undefined && p.opacity < 1) o.o = round(p.opacity); const v = p.boundVariables?.color?.id; if (v) o.v = v.replace(/^VariableID:/, ''); out.push(o); }
    else if (p.type === 'IMAGE') out.push({ img: 1 });
    else if (p.type.startsWith('GRADIENT')) out.push({ g: p.gradientStops.map(s => hex(s.color) + '@' + round(s.position)) });
  });
  return out.length ? out : undefined;
};
const BOUND_KEYS = ['itemSpacing', 'paddingLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'strokeWeight', 'width', 'height', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing', 'minWidth', 'maxWidth', 'opacity'];
const ICONS = {};
async function iconBody(node) {
  try { const s = await node.exportAsync({ format: 'SVG_STRING' }); return s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim(); } catch (e) { return undefined; }
}
async function ser(n, isRoot, opts) {
  if (n.visible === false) return null;
  const o = { t: TYPE[n.type] || 'Fra', n: n.name, w: round(n.width), h: round(n.height) };
  const parentAuto = n.parent && 'layoutMode' in n.parent && n.parent.layoutMode !== 'NONE' && n.layoutPositioning !== 'ABSOLUTE';
  if (!isRoot && !parentAuto) { o.x = round(n.x); o.y = round(n.y); }
  if (!isRoot && 'layoutSizingHorizontal' in n) { o.sh = n.layoutSizingHorizontal === 'HUG' ? 'H' : 'F'; o.sv = n.layoutSizingVertical === 'HUG' ? 'H' : 'F'; }
  if ('opacity' in n && n.opacity < 1) o.op = round(n.opacity);
  const b = {};
  const bv = n.boundVariables || {};
  for (const k of BOUND_KEYS) { const x = bv[k]; const id = Array.isArray(x) ? x[0]?.id : x?.id; if (id) b[k] = id.replace(/^VariableID:/, ''); }
  // Icône : instance d'un composant d'icône → SVG dédoublonné par nom@taille
  if (n.type === 'INSTANCE') {
    const mc = await n.getMainComponentAsync();
    if (mc) {
      const set = mc.parent?.type === 'COMPONENT_SET' ? mc.parent : null;
      o.ref = (set || mc).id; if (set) o.var = mc.id;
      const iconLike = opts.iconPages.includes(await pageOf(mc));
      if (iconLike) {
        const key = (set ? set.name + '/' + mc.name : mc.name) + '@' + Math.round(n.width);
        if (!(key in ICONS)) ICONS[key] = await iconBody(n);
        o.icon = key;
        // Couleur de l'instance : premier remplissage plein, sinon premier contour plein (icônes au trait).
        const solid = k => x => k in x && Array.isArray(x[k]) && x[k].some(p => p.type === 'SOLID' && p.visible !== false);
        const fillNode = n.findOne(solid('fills')), strokeNode = fillNode ? null : n.findOne(solid('strokes'));
        const col = fillNode || strokeNode;
        if (col) { const p = col[fillNode ? 'fills' : 'strokes'].find(p => p.type === 'SOLID' && p.visible !== false); o.ic = hex(p.color); const v = p.boundVariables?.color?.id; if (v) o.icv = v.replace(/^VariableID:/, ''); }
        if (Object.keys(b).length) o.b = b;
        return o;
      }
    }
  }
  if (n.type === 'TEXT') {
    const f = paints(n.fills); if (f) o.f = f;
    const fn = n.fontName === figma.mixed ? n.getRangeFontName(0, 1) : n.fontName;
    const fs = n.fontSize === figma.mixed ? n.getRangeFontSize(0, 1) : n.fontSize;
    const lh = n.lineHeight === figma.mixed ? n.getRangeLineHeight(0, 1) : n.lineHeight;
    const ls = n.letterSpacing === figma.mixed ? n.getRangeLetterSpacing(0, 1) : n.letterSpacing;
    o.tx = { c: n.characters, fs, ff: fn.family, st: fn.style, lh: lh.unit === 'AUTO' ? null : lh.unit === 'PERCENT' ? lh.value + '%' : lh.value,
      ls: ls.unit === 'PERCENT' ? round(ls.value / 100) : round(ls.value / (fs || 16)), al: { LEFT: 'L', CENTER: 'C', RIGHT: 'R', JUSTIFIED: 'J' }[n.textAlignHorizontal] || 'L',
      ar: n.textAutoResize === 'WIDTH_AND_HEIGHT' ? 'W' : n.textAutoResize === 'HEIGHT' ? 'H' : 'N' };
    if (Object.keys(b).length) o.b = b;
    return o;
  }
  if (['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'STAR', 'POLYGON'].includes(n.type)) {
    o.svg = await iconBody(n); if (Object.keys(b).length) o.b = b; return o;
  }
  const f = paints(n.fills); if (f) o.f = f;
  const s = paints(n.strokes);
  if (s) {
    o.s = s;
    if (n.strokeWeight !== figma.mixed) o.sw = round(n.strokeWeight);
    if ('strokeTopWeight' in n) { const w = [n.strokeTopWeight, n.strokeRightWeight, n.strokeBottomWeight, n.strokeLeftWeight]; if (n.strokeWeight === figma.mixed || w.some(x => x !== n.strokeWeight)) o.sws = w.map(round); }
  }
  if ('cornerRadius' in n) {
    if (n.cornerRadius === figma.mixed) o.r = [n.topLeftRadius, n.topRightRadius, n.bottomRightRadius, n.bottomLeftRadius].map(round);
    else if (n.cornerRadius) o.r = round(n.cornerRadius);
  }
  if ('effects' in n && n.effects.length) {
    const fx = n.effects.filter(e => e.visible !== false && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW'))
      .map(e => [e.type === 'INNER_SHADOW' ? 'I' : 'D', round(e.offset.x), round(e.offset.y), round(e.radius), round(e.spread || 0), hex(e.color), round(e.color.a)]);
    if (fx.length) o.fx = fx;
  }
  if ('layoutMode' in n && n.layoutMode !== 'NONE') {
    o.lay = [n.layoutMode === 'HORIZONTAL' ? 'H' : 'V', n.primaryAxisAlignItems === 'SPACE_BETWEEN' ? 0 : round(n.itemSpacing), round(n.paddingTop), round(n.paddingRight), round(n.paddingBottom), round(n.paddingLeft),
      AX[n.primaryAxisAlignItems] || 'MN', AX[n.counterAxisAlignItems] || 'MN', n.layoutWrap === 'WRAP' ? 1 : 0];
  }
  if ('clipsContent' in n && n.clipsContent && (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE')) o.clip = 1;
  if (Object.keys(b).length) o.b = b;
  if ('children' in n) {
    const kids = [];
    for (const c of n.children) { if (opts.budget.n-- <= 0) break; const k = await ser(c, false, opts); if (k) kids.push(k); }
    if (kids.length) o.c = kids;
  }
  return o;
}
async function pageOf(node) { let p = node; while (p && p.type !== 'PAGE') p = p.parent; return p ? p.name : ''; }
