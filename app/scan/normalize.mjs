// Scan brut (Plugin API, voir scan/figma/*.js) → library.json (format `Library`, src/lib/types.ts).
// Partagé par scan/build-sds.mjs (Node) et le plugin Figma (plugin/), sans dépendance.
//   vars       { collections: [{ id, name, modes: [[id, name]] }], rows: [[id, name, type, collectionId, codeWEB, [[mode, val]…] ou "mode=val|…" (anciens scans)]] }
//   pages      [{ components: [...], trees: {...}, icons: {...} }]   (sortie de scan-page.js)
//   screens    [{ id, page, name, w, h, uses: { "id|name": n } }]
//   iconsPage  { page, components, groups } | null
//   file       { key, name, scannedAt, via }
//   layers / layerOf(page)  colonnes de la vue Library (optionnel : sinon profondeur d'imbrication)
//   slotSurvey { componentId: { slotName: { pref, desc } } } (optionnel, anciens scans)
export function normalize({ vars, pages, screens = [], iconsPage = null, file, layers, layerOf, slotSurvey = {} }) {
  // Composants internes (préfixe _ ou .) : Figma ne les publie pas, ils restent hors de la lib.
  const internal = name => /^[_.]/.test(name);

  /* ---------- Variables ---------- */
  const TYPES = { C: 'COLOR', F: 'FLOAT', S: 'STRING', B: 'BOOLEAN' };
  const parseVal = raw => {
    if (raw.startsWith('@')) return { alias: raw.slice(1) };
    if (raw.startsWith('#')) return raw;
    try { return JSON.parse(raw); } catch { return raw; }
  };
  const collections = Object.fromEntries(vars.collections.map(c => [c.id, { id: c.id, name: c.name, modes: c.modes.map(([id, name]) => ({ id, name })), orphan: false }]));
  const variables = {};
  for (const [id, name, t, col, code, vals] of vars.rows) {
    const values = {};
    const pairs = Array.isArray(vals) ? vals : vals.split('|').map(part => { const i = part.indexOf('='); return i > 0 ? [part.slice(0, i), part.slice(i + 1)] : null; }).filter(Boolean);
    for (const [m, raw] of pairs) values[m] = parseVal(raw);
    variables[id] = { id, name, type: TYPES[t], collection: col, css: code ? code.replace(/^var\(--(.*?)(,.*)?\)$/, '$1') : '', values, local: true };
  }

  /* ---------- Composants, arbres, icônes ---------- */
  const parseVariantName = n => Object.fromEntries(n.split(',').map(s => s.trim().split('=')).filter(p => p.length === 2));
  const icons = {};
  const components = {};
  for (const j of pages) {
    Object.assign(icons, Object.fromEntries(Object.entries(j.icons || {}).filter(([, b]) => typeof b === 'string' && b.length)));
    for (const c of j.components) {
      if (internal(c.name)) continue;
      const t = j.trees?.[c.id];
      let variants = [];
      if (t && t.t) variants = [{ id: c.id, name: c.name, props: {}, tree: t }];
      else if (t) variants = Object.entries(t).map(([vid, tree]) => ({ id: vid, name: tree.n, props: parseVariantName(tree.n), tree }));
      const uses = Object.entries(c.uses || {}).map(([k, count]) => { const i = k.indexOf('|'); return { id: k.slice(0, i), name: k.slice(i + 1), count }; });
      components[c.id] = {
        id: c.id, kind: c.kind, page: c.page, name: c.name, description: c.desc || '', props: c.props, variantCount: c.variants, variants, uses,
        group: c.group || c.page, ...(layerOf ? { layer: layerOf(c.page) } : {}), key: c.key,
        // Slots natifs : du scan (pref.slot) ou, pour un scan antérieur, du relevé slotSurvey.
        slots: Object.entries(Object.fromEntries(Object.entries(c.pref || {}).filter(([, d]) => d.slot))).concat(Object.entries(slotSurvey[c.id] || {}))
          .reduce((acc, [name, d]) => (acc.some(x => x.name === name) ? acc : [...acc, { name, prefKeys: d.pref || [], desc: d.desc || '' }]), []),
      };
    }
  }

  // Instances dont le composant principal n'est plus sur aucune page (ancienne version supprimée du fichier) :
  // rattachées au composant vivant du même nom s'il est unique, sinon ignorées.
  const byName = {};
  for (const c of Object.values(components)) (byName[c.name] ??= []).push(c.id);
  const remap = u => (components[u.id] ? u : byName[u.name]?.length === 1 ? { ...u, id: byName[u.name][0] } : null);
  const stats = { remapped: 0, dropped: 0, slots: 0, prefs: 0 };
  for (const c of Object.values(components)) {
    const merged = {};
    for (const u of c.uses) {
      const r = remap(u);
      if (!r) { stats.dropped++; continue; }
      if (r.id !== u.id) stats.remapped++;
      if (r.id === c.id) continue;
      merged[r.id] = merged[r.id] ? { ...r, count: merged[r.id].count + r.count } : r;
    }
    c.uses = Object.values(merged);
  }

  // Instances préférées des slots : clés Figma → ids des composants scannés (les autres sont ignorées).
  const byKey = Object.fromEntries(Object.values(components).filter(c => c.key).map(c => [c.key, c.id]));
  for (const c of Object.values(components)) {
    c.slots = c.slots.map(({ name, prefKeys, desc }) => { const pref = prefKeys.map(k => byKey[k]).filter(Boolean); stats.slots++; stats.prefs += pref.length; return { name, pref, ...(desc ? { desc } : {}) }; });
    if (!c.slots.length) delete c.slots;
    delete c.key;
  }

  /* ---------- Écrans ---------- */
  const out = [];
  const seen = new Set();
  for (const s of screens) {
    if (seen.has(s.id) || components[s.id]) continue;
    seen.add(s.id);
    out.push({ ...s, uses: Object.entries(s.uses).map(([k, count]) => { const i = k.indexOf('|'); return remap({ id: k.slice(0, i), name: k.slice(i + 1), count }); }).filter(Boolean) });
  }

  const library = {
    schema: 1, file, collections, variables, components, screens: out, icons,
    iconsPage: iconsPage ? { page: iconsPage.page, components: iconsPage.components, groups: iconsPage.groups } : { page: '', components: 0, groups: {} },
    ...(layers ? { layers } : {}),
  };
  return { library, stats };
}
