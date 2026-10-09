import type { FNode, Library } from './types';
import { libId } from './library';

/** Calques slot d'un arbre de variante, au niveau du composant (pas ceux des instances imbriquées). */
export function slotNodes(tree: FNode) {
  const out: { name: string; empty: boolean; dir: 'H' | 'V'; layers: number }[] = [];
  const walk = (n: FNode, root: boolean) => {
    if (n.t === 'Slo' && !out.some(s => s.name === n.n)) out.push({ name: n.n, empty: !n.c?.length, dir: n.lay?.[0] === 'H' ? 'H' : 'V', layers: n.c?.length ?? 0 });
    if (root || !n.ref) n.c?.forEach(c => walk(c, false));
  };
  walk(tree, true);
  return out;
}

export const slotHandle = (name: string) => 'slot:' + name;
export const slotOfHandle = (h?: string | null) => (h?.startsWith('slot:') ? h.slice(5) : null);

/** Choix de l'utilisateur, par slot : composants proposés quand Figma n'en déclare pas. */
export type SlotPicks = Record<string, string[]>;
export const pickKey = (compId: string, slot: string) => `${compId}/${slot}`;
const storeKey = (lib: Library) => `ds-graph-slot-picks-v1:${libId(lib)}`;
export const loadPicks = (lib: Library): SlotPicks => {
  try { const j = JSON.parse(localStorage.getItem(storeKey(lib)) ?? '{}'); return j && typeof j === 'object' ? j : {}; } catch { return {}; }
};
export const savePicks = (lib: Library, p: SlotPicks) => { try { localStorage.setItem(storeKey(lib), JSON.stringify(p)); } catch { /* stockage indisponible */ } };

/**
 * Composants proposés pour remplir un slot : d'abord les « preferred instances » de Figma,
 * sinon les composants choisis par l'utilisateur pour ce slot. Rien : il faut en choisir.
 */
export function suggestions(lib: Library, compId: string, slot: string, picks: SlotPicks): { source: 'figma' | 'picks' | 'none'; ids: string[] } {
  const def = lib.components[compId]?.slots?.find(s => s.name === slot);
  const ok = (id: string) => !!lib.components[id]?.variants.length;
  const pref = (def?.pref ?? []).filter(ok);
  if (pref.length) return { source: 'figma', ids: pref };
  const mine = (picks[pickKey(compId, slot)] ?? []).filter(ok);
  return mine.length ? { source: 'picks', ids: mine } : { source: 'none', ids: [] };
}
