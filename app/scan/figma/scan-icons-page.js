// Page Icons (lecture seule) : nombre de composants et groupes (préfixe de nom avant le dernier /).
const page = await figma.getNodeByIdAsync('__PAGE_ID__');
await figma.setCurrentPageAsync(page);
const comps = page.findAllWithCriteria({ types: ['COMPONENT'] });
const groups = {};
for (const c of comps) { let s = c.parent; while (s && s.type !== 'SECTION' && s.type !== 'FRAME' && s.type !== 'PAGE') s = s.parent; const g = s && s.type !== 'PAGE' ? s.name : 'Icons'; groups[g] = (groups[g] || 0) + 1; }
return { page: page.name, components: comps.length, groups };
