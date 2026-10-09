// Écrans / exemples d'une page (lecture seule) : frames de premier niveau (ou dans une Section) qui instancient des composants.
const PAGE_ID = '__PAGE_ID__';
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);
const frames = [];
const visit = n => { for (const c of n.children) { if (c.type === 'SECTION') visit(c); else if (c.type === 'FRAME') frames.push(c); } };
visit(page);
const screens = [];
for (const f of frames) {
  const uses = {};
  for (const ins of f.findAllWithCriteria({ types: ['INSTANCE'] })) {
    const mc = await ins.getMainComponentAsync(); if (!mc) continue;
    const owner = mc.parent?.type === 'COMPONENT_SET' ? mc.parent : mc;
    let p = owner; while (p && p.type !== 'PAGE') p = p.parent;
    if (!p || p.name === 'Icons' || p.name === 'Utilities') continue;
    // Seules les instances de premier niveau comptent : on ignore celles nichées dans une autre instance.
    let q = ins.parent, nested = false; while (q && q !== f) { if (q.type === 'INSTANCE') { nested = true; break; } q = q.parent; }
    if (nested) continue;
    const key = owner.id + '|' + owner.name; uses[key] = (uses[key] || 0) + 1;
  }
  if (Object.keys(uses).length) screens.push({ id: f.id, page: page.name, name: f.name, w: Math.round(f.width), h: Math.round(f.height), uses });
}
return { page: page.name, screens };
