import { chromium } from 'playwright-core';
const o = (process.env.E2E_SHOTS || 'e2e/shots');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
// Interface en anglais : on cherche les restes de français dans le texte visible.
const FR = /(Propriétés|Précédente|Suivante|Correspondance|Résolution|CSS généré|Clique|Choisis|Voir les|niveaux?\b|Fermer|Clair|Sombre|Aiguillage|contextes?\b|Fond\b|Couleur|Taille|Graisse|Police|Arrondi|Bordure|Espacement|Rechercher|Modèles|Mise en page|Enregistrer|Vider|Importer|Exporter|Aucune?\b|aucune?\b|non liée?|\bdonne\b|\bécrans?\b|Écran)/; // pas de mots courts (les, des…) : les textes de la lib Figma sont en français
const texts = [];
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.locator('.search').fill('Navigation Pill'); // pages repliées : la recherche les déplie
await p.locator('.side-item', { hasText: /^Navigation Pill\s*\d/ }).click(); await W(1000);
await p.locator('.zone-hit').nth(2).click(); await W(900);
await p.getByRole('button', { name: 'Properties', exact: true }).click(); await W(1500);
texts.push(['component', await p.locator('.app').innerText()]);
await p.screenshot({ path: o + '/ui3-panel.png' });
const more = p.locator('.text-link.more'); if (await more.count()) { await more.click(); await W(200); console.log('relations dépliées:', (await p.locator('.relations').innerText()).slice(0, 160)); }
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('ArrowUp'); await W(1200);
texts.push(['pattern', await p.locator('.app').innerText()]);
await p.keyboard.press('ArrowUp'); await W(1500); texts.push(['usage', await p.locator('.app').innerText()]);
await p.keyboard.press('ArrowUp'); await W(1500); texts.push(['library', await p.locator('.app').innerText()]);
await p.getByRole('tab', { name: 'Builder' }).click(); await W(1200);
texts.push(['builder', await p.locator('.app').innerText()]);
p.once('dialog', d => { console.log('confirm:', d.message()); d.dismiss(); });
await p.locator('.more-menu summary').click(); await W(200); await p.getByRole('button', { name: 'Clear canvas…' }).click(); await W(300);
console.log('nodes après refus:', await p.locator('.builder .react-flow__node').count());
for (const [k, t] of texts) { const m = t.match(new RegExp(FR.source, 'g')); console.log(k, 'français restant:', m ? [...new Set(m)].join(', ') : 0); }
console.log('errors', errs); await b.close();
