// Scan d'une page (lecture seule). Remplacer PAGE_ID ; SET_IDS = null pour toute la page, ou une liste d'ids pour un lot.
// Sortie : { page, components: [...], trees: { setId: { variantId: FNode } | FNode }, icons, screens }
const PAGE_ID = '__PAGE_ID__';
const SET_IDS = __SET_IDS__;
const MAX_VARIANTS = 12, NODE_BUDGET = 700;
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);
const all = page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] }).filter(n => n.type === 'COMPONENT_SET' || n.parent.type !== 'COMPONENT_SET');
const sets = SET_IDS ? all.filter(s => SET_IDS.includes(s.id)) : all;
const opts = { iconPages: ['Icons'], budget: { n: NODE_BUDGET } };
const cleanKey = k => k.replace(/#[\d:]+$/, '');
// Variantes retenues : State (ou Status) par défaut si l'axe existe, au plus MAX_VARIANTS.
const pickVariants = s => {
  if (s.type !== 'COMPONENT_SET') return [s];
  const defs = s.componentPropertyDefinitions;
  const stateKey = Object.keys(defs).find(k => defs[k].type === 'VARIANT' && /^(state|status|interaction)$/i.test(k));
  let vs = s.children.filter(c => c.type === 'COMPONENT');
  if (stateKey) { const def = defs[stateKey].defaultValue; const keep = vs.filter(v => v.variantProperties?.[stateKey] === def); if (keep.length) vs = keep; }
  const dv = s.defaultVariant; if (dv && !vs.includes(dv)) vs.unshift(dv);
  return vs.slice(0, MAX_VARIANTS);
};
const components = [], trees = {};
for (const s of sets) {
  const defs = s.componentPropertyDefinitions;
  const props = {}, pref = {};
  for (const [k, d] of Object.entries(defs)) {
    props[cleanKey(k)] = d.type === 'VARIANT' ? d.variantOptions : d.type;
    // Slots natifs : instances préférées (clés de composants) et description, s'il y en a.
    if (d.type === 'SLOT') pref[cleanKey(k)] = { slot: 1, pref: (d.preferredValues || []).filter(p => p.type === 'COMPONENT' || p.type === 'COMPONENT_SET').map(p => p.key).slice(0, 40), prefCount: (d.preferredValues || []).length, desc: d.description || '' };
    if (d.type === 'INSTANCE_SWAP') pref[cleanKey(k)] = { def: d.defaultValue, pref: (d.preferredValues || []).filter(p => p.type === 'COMPONENT' || p.type === 'COMPONENT_SET').map(p => p.key).slice(0, 40), prefCount: (d.preferredValues || []).length };
  }
  // Relations « contient » : instances présentes dans toutes les variantes, comptées une fois par variante.
  const uses = {};
  const variants = s.type === 'COMPONENT_SET' ? s.children : [s];
  for (const v of variants) {
    const seen = new Set();
    for (const ins of v.findAllWithCriteria({ types: ['INSTANCE'] })) {
      const mc = await ins.getMainComponentAsync(); if (!mc) continue;
      const owner = mc.parent?.type === 'COMPONENT_SET' ? mc.parent : mc;
      if (owner.id === s.id || seen.has(owner.id)) continue;
      let p = owner; while (p && p.type !== 'PAGE') p = p.parent;
      if (p && p.name === 'Icons') continue;
      seen.add(owner.id);
      const key = owner.id + '|' + owner.name; uses[key] = (uses[key] || 0) + 1;
    }
  }
  let section = s.parent; while (section && section.type !== 'SECTION' && section.type !== 'PAGE') section = section.parent;
  components.push({ id: s.id, kind: s.type === 'COMPONENT_SET' ? 'set' : 'component', page: page.name, group: section && section.type === 'SECTION' ? section.name : '', name: s.name, desc: s.description || '', props, pref, variants: variants.length, key: s.key, uses });
  const picked = pickVariants(s);
  if (s.type === 'COMPONENT_SET') { trees[s.id] = {}; for (const v of picked) { opts.budget.n = NODE_BUDGET; const t = await ser(v, true, opts); if (t) trees[s.id][v.id] = t; } }
  else { opts.budget.n = NODE_BUDGET; const t = await ser(s, true, opts); if (t) trees[s.id] = t; }
}
return { page: page.name, pageId: PAGE_ID, count: all.length, ids: all.map(s => s.id), components, trees, icons: ICONS };
