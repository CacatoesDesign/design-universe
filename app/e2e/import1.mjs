import { chromium } from 'playwright-core';
// Import d'un scan du plugin limité à un composant (e2e/fixtures/one-component.json) : pas de couches, pas de page d'icônes.
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
const ok = (c, m) => console.log(c ? 'ok  ' : 'FAIL', m);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.locator('input[type=file][accept="application/json"]').setInputFiles(new URL('./fixtures/one-component.json', import.meta.url).pathname); await W(1500);
ok((await p.locator('.lib-meta b').innerText()) === 'One component', 'lib importée');
ok(await p.locator('.side-item').count() === 1, `un composant dans la barre latérale (${await p.locator('.side-item').count()})`);
ok(!(await p.locator('.sidebar').innerText()).includes('components on page'), 'pas de ligne Icons sans page d\'icônes');
ok(await p.locator('.level[data-state="active"] .comp-surface').count() === 1, 'composant rendu');
await p.locator('.variant-pill .axis[aria-label="State"] .axis-toggle').click(); await W(300);
ok(await p.locator('.variant-pill .vseg button').count() === 3, 'les 3 états sont disponibles');
for (let i = 0; i < 3; i++) { await p.keyboard.press('ArrowUp'); await W(1300); }
ok(await p.locator('.level[data-state="active"] .react-flow__node-lib').count() === 1, 'niveau Library : un node');
console.log('errors', errs); if (errs.length) console.log('FAIL erreurs page');
await b.close();
