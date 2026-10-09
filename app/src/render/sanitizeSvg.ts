// Nettoie le balisage SVG venu d'un library.json (potentiellement importé) avant injection dans le DOM :
// liste blanche d'éléments et d'attributs de dessin, aucun gestionnaire d'événement ni ressource externe.

const ELEMENTS = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'stop']);
const ATTRS = new Set([
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points', 'transform', 'id',
  'fill', 'fill-rule', 'fill-opacity', 'clip-rule', 'clip-path', 'mask', 'opacity', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'offset', 'stop-color',
  'stop-opacity', 'gradientunits', 'gradienttransform', 'maskunits', 'clippathunits', 'style',
]);
// Seules les références internes url(#id) sont acceptées dans les valeurs.
const UNSAFE_VALUE = /url\(\s*(?!['"]?#)|javascript:|expression\(|@import/i;

const cache = new Map<string, string>();

export function sanitizeSvg(markup: string): string {
  const hit = cache.get(markup);
  if (hit !== undefined) return hit;
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.querySelector('parsererror')) { cache.set(markup, ''); return ''; }
  const clean = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ELEMENTS.has(child.tagName.toLowerCase())) { child.remove(); continue; }
      for (const a of [...child.attributes]) {
        if (!ATTRS.has(a.name.toLowerCase()) || UNSAFE_VALUE.test(a.value)) child.removeAttribute(a.name);
      }
      clean(child);
    }
  };
  clean(root);
  const out = root.innerHTML;
  cache.set(markup, out);
  return out;
}
