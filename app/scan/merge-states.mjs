// Fusionne la sortie de scan/figma/scan-states.js dans une page du scan (scan/sds/page-*.json).
// Usage : node scan/merge-states.mjs scan/sds/page-buttons-1.json sortie1.json [sortie2.json…]
// Ajoute ou remplace les variantes des sets déjà scannés, et ajoute les icônes rencontrées. Idempotent.
import { readFileSync, writeFileSync } from 'node:fs';

const [pageFile, ...outs] = process.argv.slice(2);
const page = JSON.parse(readFileSync(pageFile, 'utf8'));
let added = 0, replaced = 0;
for (const f of outs) {
  const { trees, icons } = JSON.parse(readFileSync(f, 'utf8'));
  for (const [setId, variants] of Object.entries(trees)) {
    if (!page.trees[setId] || page.trees[setId].t) throw new Error(`${setId} : set absent de ${pageFile}`);
    for (const [vid, tree] of Object.entries(variants)) { if (page.trees[setId][vid]) replaced++; else added++; page.trees[setId][vid] = tree; }
  }
  for (const [k, svg] of Object.entries(icons || {})) if (svg && !page.icons[k]) page.icons[k] = svg;
}
writeFileSync(pageFile, JSON.stringify(page));
console.log(`${added} variantes ajoutées, ${replaced} remplacées dans ${pageFile}`);
