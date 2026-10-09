// DS Universe Scanner : lit la lib Figma ouverte (lecture seule) et produit un library.json pour DS Universe.
// Assemblé dans ../code.js par ../build.mjs, après scan/figma/serialize.js (ser, ICONS) et scan/normalize.mjs (normalize).

const MAX_VARIANTS = 12, ALL_VARIANTS = 48, NODE_BUDGET = 700;
const cleanKey = k => k.replace(/#[\d:]+$/, '');
const isIconPage = name => /icon/i.test(name);
const pageOfNode = n => { let p = n; while (p && p.type !== 'PAGE') p = p.parent; return p; };
const ownerOf = mc => (mc.parent?.type === 'COMPONENT_SET' ? mc.parent : mc);
const progress = (text, ratio) => figma.ui.postMessage({ type: 'progress', text, ratio });

// Variantes retenues : toutes (jusqu'à 48) pour un composant choisi, sinon l'état par défaut, au plus 12.
function pickVariants(s, all) {
  if (s.type !== 'COMPONENT_SET') return [s];
  let vs = s.children.filter(c => c.type === 'COMPONENT');
  if (all) return vs.slice(0, ALL_VARIANTS);
  const defs = s.componentPropertyDefinitions;
  const stateKey = Object.keys(defs).find(k => defs[k].type === 'VARIANT' && /^(state|status|interaction)$/i.test(k));
  if (stateKey) { const def = defs[stateKey].defaultValue; const keep = vs.filter(v => v.variantProperties?.[stateKey] === def); if (keep.length) vs = keep; }
  // Variante par défaut toujours en tête, même sans axe d'état reconnu, avant de tronquer.
  const dv = s.defaultVariant; if (dv) vs = [dv, ...vs.filter(v => v !== dv)];
  return vs.slice(0, MAX_VARIANTS);
}

async function scanSet(s, iconPages, allVariants) {
  const page = pageOfNode(s);
  const defs = s.componentPropertyDefinitions;
  const props = {}, pref = {};
  for (const [k, d] of Object.entries(defs)) {
    props[cleanKey(k)] = d.type === 'VARIANT' ? d.variantOptions : d.type;
    const keys = (d.preferredValues || []).filter(p => p.type === 'COMPONENT' || p.type === 'COMPONENT_SET').map(p => p.key).slice(0, 40);
    if (d.type === 'SLOT') pref[cleanKey(k)] = { slot: 1, pref: keys, prefCount: (d.preferredValues || []).length, desc: d.description || '' };
    if (d.type === 'INSTANCE_SWAP') pref[cleanKey(k)] = { def: d.defaultValue, pref: keys, prefCount: (d.preferredValues || []).length };
  }
  // Relations « contient » : instances présentes dans les variantes, comptées une fois par variante.
  const uses = {};
  const variants = s.type === 'COMPONENT_SET' ? s.children : [s];
  for (const v of variants) {
    const seen = new Set();
    for (const ins of v.findAllWithCriteria({ types: ['INSTANCE'] })) {
      const mc = await ins.getMainComponentAsync(); if (!mc) continue;
      const owner = ownerOf(mc);
      if (owner.id === s.id || seen.has(owner.id)) continue;
      const p = pageOfNode(owner);
      if (p && isIconPage(p.name)) continue;
      seen.add(owner.id);
      const key = owner.id + '|' + owner.name; uses[key] = (uses[key] || 0) + 1;
    }
  }
  let section = s.parent; while (section && section.type !== 'SECTION' && section.type !== 'PAGE') section = section.parent;
  const comp = { id: s.id, kind: s.type === 'COMPONENT_SET' ? 'set' : 'component', page: page ? page.name : '', group: section && section.type === 'SECTION' ? section.name : '', name: s.name, desc: s.description || '', props, pref, variants: variants.length, key: s.key, uses };
  const opts = { iconPages, budget: { n: NODE_BUDGET } };
  let tree;
  if (s.type === 'COMPONENT_SET') { tree = {}; for (const v of pickVariants(s, allVariants)) { opts.budget.n = NODE_BUDGET; const t = await ser(v, true, opts); if (t) tree[v.id] = t; } }
  else { tree = await ser(s, true, opts); }
  return { comp, tree };
}

function scanVars() {
  return (async () => {
    const cols = await figma.variables.getLocalVariableCollectionsAsync();
    const strip = id => id.replace(/^VariableCollectionId:|^VariableID:/, '');
    const hexA = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (c.a !== undefined && c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase() : '');
    const T = { COLOR: 'C', FLOAT: 'F', STRING: 'S', BOOLEAN: 'B' };
    const vars = await figma.variables.getLocalVariablesAsync();
    const rows = vars.map(v => [strip(v.id), v.name, T[v.resolvedType], strip(v.variableCollectionId), v.codeSyntax?.WEB || '',
      // Paires [mode, valeur] : une chaîne qui contient « | » reste intacte (l'ancien format était délimité par « | »).
      Object.entries(v.valuesByMode).map(([m, x]) => [m, x && x.type === 'VARIABLE_ALIAS' ? '@' + strip(x.id) : v.resolvedType === 'COLOR' ? hexA(x) : JSON.stringify(x)])]);
    return { collections: cols.map(c => ({ id: strip(c.id), name: c.name, modes: c.modes.map(m => [m.modeId, m.name]) })), rows };
  })();
}

// Écrans : frames de premier niveau (ou dans une Section) qui instancient des composants de la lib.
async function scanScreens(page) {
  const frames = [];
  const visit = n => { for (const c of n.children) { if (c.type === 'SECTION') visit(c); else if (c.type === 'FRAME') frames.push(c); } };
  visit(page);
  const screens = [];
  for (const f of frames) {
    const uses = {};
    for (const ins of f.findAllWithCriteria({ types: ['INSTANCE'] })) {
      const mc = await ins.getMainComponentAsync(); if (!mc) continue;
      const owner = ownerOf(mc);
      const p = pageOfNode(owner);
      if (!p || isIconPage(p.name)) continue;
      let q = ins.parent, nested = false; while (q && q !== f) { if (q.type === 'INSTANCE') { nested = true; break; } q = q.parent; }
      if (nested) continue;
      const key = owner.id + '|' + owner.name; uses[key] = (uses[key] || 0) + 1;
    }
    if (Object.keys(uses).length) screens.push({ id: f.id, page: page.name, name: f.name, w: Math.round(f.width), h: Math.round(f.height), uses });
  }
  return screens;
}

function iconsSummary(page) {
  const comps = page.findAllWithCriteria({ types: ['COMPONENT'] });
  const groups = {};
  for (const c of comps) { let s = c.parent; while (s && s.type !== 'SECTION' && s.type !== 'FRAME' && s.type !== 'PAGE') s = s.parent; const g = s && s.type !== 'PAGE' ? s.name : page.name; groups[g] = (groups[g] || 0) + 1; }
  return { page: page.name, components: comps.length, groups };
}

const setsOnPage = page => page.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] }).filter(n => n.type === 'COMPONENT_SET' || n.parent.type !== 'COMPONENT_SET');

// Sélection → composants : un set, un composant, une variante (→ son set), une instance (→ son composant),
// ou un cadre / une section qui en contient.
async function setsFromSelection() {
  const out = new Map();
  for (const n of figma.currentPage.selection) {
    if (n.type === 'COMPONENT_SET') out.set(n.id, n);
    else if (n.type === 'COMPONENT') { const o = ownerOf(n); out.set(o.id, o); }
    else if (n.type === 'INSTANCE') { const mc = await n.getMainComponentAsync(); if (mc) { const o = ownerOf(mc); out.set(o.id, o); } }
    else if ('findAllWithCriteria' in n) for (const s of n.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] })) { const o = ownerOf(s); out.set(o.id, o); }
  }
  return [...out.values()];
}

async function run(scope, fileUrl) {
  for (const k of Object.keys(ICONS)) delete ICONS[k]; // icônes du scan précédent
  await figma.loadAllPagesAsync();
  const pagesAll = figma.root.children;
  const iconPages = pagesAll.filter(p => isIconPage(p.name)).map(p => p.name);
  let sets = [], screenPages = [];
  if (scope === 'selection') {
    sets = await setsFromSelection();
    if (!sets.length) throw new Error('Select a component, a component set, an instance, or a frame that contains components.');
  } else if (scope === 'page') {
    sets = setsOnPage(figma.currentPage); screenPages = [figma.currentPage];
  } else {
    for (const p of pagesAll) if (!isIconPage(p.name)) sets.push(...setsOnPage(p));
    screenPages = pagesAll.filter(p => !isIconPage(p.name));
  }
  if (!sets.length) throw new Error('No components found here.');

  progress('Reading variables…', 0);
  const vars = await scanVars();
  const components = [], trees = {};
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    progress(`Component ${i + 1} / ${sets.length} · ${s.name}`, (i + 1) / (sets.length + 1));
    const { comp, tree } = await scanSet(s, iconPages, scope === 'selection');
    components.push(comp); if (tree) trees[s.id] = tree;
  }
  const screens = [];
  for (const p of screenPages) { progress(`Screens on ${p.name}…`, 0.98); screens.push(...await scanScreens(p)); }
  const iconPage = pagesAll.find(p => isIconPage(p.name));

  // Clé du fichier : figma.fileKey (plugin de développement) ou l'URL collée dans le plugin. Sert aux aperçus PNG.
  const fromUrl = (fileUrl || '').match(/figma\.com\/(?:design|file)\/([A-Za-z0-9]+)/)?.[1];
  const key = figma.fileKey || fromUrl || '';
  const { library, stats } = normalize({
    vars, pages: [{ components, trees, icons: ICONS }], screens, iconsPage: iconPage ? iconsSummary(iconPage) : null,
    file: { key, name: figma.root.name, scannedAt: new Date().toISOString().slice(0, 10), via: `DS Universe Scanner (${scope})` },
  });
  const rendered = Object.values(library.components).filter(c => c.variants.length).length;
  return { library, summary: { components: Object.keys(library.components).length, rendered, variables: Object.keys(library.variables).length, screens: library.screens.length, icons: Object.keys(library.icons).length, dropped: stats.dropped, key: !!key } };
}

figma.showUI(__html__, { width: 360, height: 460, themeColors: true });
const sendSelection = () => figma.ui.postMessage({ type: 'selection', count: figma.currentPage.selection.length, page: figma.currentPage.name, file: figma.root.name, hasKey: !!figma.fileKey });
figma.on('selectionchange', sendSelection);
figma.on('currentpagechange', sendSelection);
sendSelection();
figma.ui.onmessage = async msg => {
  if (msg.type !== 'scan') return;
  try {
    const { library, summary } = await run(msg.scope, msg.fileUrl);
    figma.ui.postMessage({ type: 'done', json: JSON.stringify(library), summary, name: figma.root.name });
  } catch (e) {
    figma.ui.postMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
  }
};
