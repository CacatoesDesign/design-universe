// Rescan ciblé des états (lecture seule). Coller serialize.js en tête, remplacer PAGE_ID et SET_IDS.
// Sérialise les variantes d'un set dont l'état (axe State / Status / Interaction) n'est pas celui par défaut :
// scan-page.js ne garde que l'état par défaut. Sortie : { trees: { setId: { variantId: FNode } }, icons }
// ALL = true : sérialise aussi l'état par défaut (pour réécrire un set entier après un changement du sérialiseur).
// Fusion dans scan/sds/page-*.json : node scan/merge-states.mjs <page-file> <sortie.json>
const PAGE_ID = '__PAGE_ID__';
const SET_IDS = __SET_IDS__;
const ALL = __ALL__;
const NODE_BUDGET = 700;
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);
const opts = { iconPages: ['Icons'], budget: { n: NODE_BUDGET } };
const trees = {};
for (const id of SET_IDS) {
  const s = await figma.getNodeByIdAsync(id);
  if (!s || s.type !== 'COMPONENT_SET') continue;
  const defs = s.componentPropertyDefinitions;
  const stateKey = Object.keys(defs).find(k => defs[k].type === 'VARIANT' && /^(state|status|interaction)$/i.test(k));
  if (!stateKey) continue;
  const def = defs[stateKey].defaultValue;
  trees[s.id] = {};
  for (const v of s.children) {
    if (v.type !== 'COMPONENT' || (!ALL && v.variantProperties?.[stateKey] === def)) continue;
    opts.budget.n = NODE_BUDGET;
    const t = await ser(v, true, opts); if (t) trees[s.id][v.id] = t;
  }
}
return JSON.stringify({ trees, icons: ICONS });
