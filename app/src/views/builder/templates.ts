import type { Edge } from '@xyflow/react';
import type { Library } from '../../lib/types';
import { textNodes, variantOf, type BNode, type StackData } from './compose';

/* Modèles de départ : vrais composants de la lib (Simple Design System), textes de démo modifiables. */

const byName = (lib: Library, n: string) => Object.values(lib.components).find(c => c.name === n && c.variants.length)?.id;
/** Premier token local qui existe parmi les noms donnés (noms SDS d'abord, puis conventions courantes). */
export const varId = (lib: Library, ...names: string[]) => {
  for (const n of names) { const v = Object.values(lib.variables).find(x => x.name === n && x.local); if (v) return v.id; }
  return undefined;
};

export function template(lib: Library, kind: 'nav' | 'form' | 'dash'): { nodes: BNode[]; edges: Edge[] } {
  // Textes posés par nom de calque (« Label », « Value »…) : le chemin est retrouvé dans l'arbre de la variante.
  const comp = (id: string, name: string, vprops: Record<string, string>, byLayer: Record<string, string>, x: number, y: number): BNode | null => {
    const compId = byName(lib, name); if (!compId) return null;
    const v = variantOf(lib, { kind: 'component', compId, vprops, texts: {} });
    const texts: Record<string, string> = {};
    const tn = v ? textNodes(v.tree) : [];
    for (const [layer, text] of Object.entries(byLayer)) { const t = tn.find(n => n.name === layer) ?? (layer === '*' ? tn[0] : undefined); if (t) texts[t.path] = text; }
    return { id, type: 'component', position: { x, y }, data: { kind: 'component', compId, vprops: v?.props ?? vprops, texts } };
  };
  const stack = (id: string, name: string, x: number, y: number, p: Partial<StackData>): BNode => ({ id, type: 'stack', position: { x, y }, data: { kind: 'stack', name, dir: 'H', justify: 'start', align: 'center', ...p } });
  const screen = (name: string, width: number): BNode => ({ id: 'screen', type: 'screen', position: { x: 960, y: 220 }, data: { kind: 'screen', name, width, bg: varId(lib, 'Background/Default/Default'), pad: varId(lib, 'Space/800'), gap: varId(lib, 'Space/600') } });
  const e = (s: string, t: string): Edge => ({ id: `${s}>${t}`, source: s, target: t, type: 'grad' });
  const surface = { bg: varId(lib, 'Background/Default/Secondary'), radius: varId(lib, 'Radius/200') };
  const keep = (list: (BNode | null)[]) => list.filter(Boolean) as BNode[];
  const edges = (nodes: BNode[], list: [string, string][]) => list.filter(([s, t]) => nodes.some(n => n.id === s) && nodes.some(n => n.id === t)).map(([s, t]) => e(s, t));

  if (kind === 'nav') {
    const nodes = keep([
      // État par défaut seulement : c'est le seul scanné pour les composants qui ont un axe State.
      comp('l1', 'Navigation Pill', { State: 'Default' }, { Title: 'Products' }, 0, 0),
      comp('l2', 'Navigation Pill', { State: 'Default' }, { Title: 'Pricing' }, 0, 220),
      comp('b1', 'Button', { Variant: 'Neutral', State: 'Default', Size: 'Medium' }, { Button: 'Sign in' }, 0, 520),
      comp('b2', 'Button', { Variant: 'Primary', State: 'Default', Size: 'Medium' }, { Button: 'Register' }, 0, 760),
      stack('links', 'Links', 330, 60, { gap: varId(lib, 'Space/200') }),
      stack('actions', 'Button Group', 330, 600, { gap: varId(lib, 'Space/300') }),
      stack('nav', 'Header', 640, 320, { justify: 'space-between', pad: varId(lib, 'Space/400'), ...surface }),
      screen('Landing', 1280),
    ]);
    return { nodes, edges: edges(nodes, [['l1', 'links'], ['l2', 'links'], ['b1', 'actions'], ['b2', 'actions'], ['links', 'nav'], ['actions', 'nav'], ['nav', 'screen']]) };
  }
  if (kind === 'form') {
    const nodes = keep([
      comp('f1', 'Input Field', { State: 'Default', 'Value Type': 'Placeholder' }, { Label: 'Work email', Value: 'name@company.com' }, 0, 0),
      comp('f2', 'Textarea Field', { State: 'Default', 'Value Type': 'Placeholder' }, { Label: 'Message', Value: 'How can we help?' }, 0, 260),
      comp('b1', 'Button', { Variant: 'Neutral', State: 'Default', Size: 'Medium' }, { Button: 'Cancel' }, 0, 560),
      comp('b2', 'Button', { Variant: 'Primary', State: 'Default', Size: 'Medium' }, { Button: 'Send' }, 0, 760),
      stack('act', 'Button Group', 330, 620, { justify: 'end', gap: varId(lib, 'Space/300') }),
      stack('form', 'Form', 640, 300, { dir: 'V', align: 'stretch', gap: varId(lib, 'Space/600'), pad: varId(lib, 'Space/600'), ...surface }),
      screen('Contact', 768),
    ]);
    return { nodes, edges: edges(nodes, [['f1', 'form'], ['f2', 'form'], ['b1', 'act'], ['b2', 'act'], ['act', 'form'], ['form', 'screen']]) };
  }
  const nodes = keep([
    comp('s1', 'Search', { State: 'Default', 'Value Type': 'Filled' }, { Value: 'Search orders' }, 0, 0),
    comp('t1', 'Tag', { Scheme: 'Positive', State: 'Default', Variant: 'Secondary' }, { '*': 'Live' }, 0, 240),
    comp('b1', 'Button', { Variant: 'Neutral', State: 'Default', Size: 'Small' }, { Button: 'Export' }, 0, 470),
    comp('b2', 'Button', { Variant: 'Primary', State: 'Default', Size: 'Small' }, { Button: 'Share' }, 0, 690),
    stack('act', 'Actions', 330, 420, { gap: varId(lib, 'Space/200') }),
    stack('bar', 'Action bar', 640, 260, { justify: 'space-between', pad: varId(lib, 'Space/400'), ...surface }),
    screen('Dashboard', 1280),
  ]);
  return { nodes, edges: edges(nodes, [['s1', 'bar'], ['t1', 'act'], ['b1', 'act'], ['b2', 'act'], ['act', 'bar'], ['bar', 'screen']]) };
}
