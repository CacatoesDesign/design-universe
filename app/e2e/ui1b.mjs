import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
await p.addInitScript(() => { try { localStorage.setItem('ds-hints-seen', '{}'); } catch {} });
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
console.log('stockage corrompu → rendu OK', await p.locator('.zp-btn').count());
await p.locator('.zp-btn').click(); await W(200);
console.log('focus dans le menu', await p.evaluate(() => document.activeElement?.getAttribute('role')));
await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await W(100);
console.log('↓↓ niveau toujours Component', await p.locator('.crumbs button[aria-current="true"]').innerText(), '· focus', await p.evaluate(() => document.activeElement?.textContent));
await p.keyboard.press('Enter'); await W(400);
console.log('Entrée → zone', (await p.locator('.zp-btn').innerText()).replace(/\n/g, ' '), '· focus bouton', await p.evaluate(() => document.activeElement?.classList.contains('zp-btn')));
await p.getByRole('button', { name: 'Properties', exact: true }).click(); await W(600);
await p.locator('.zp-btn').click(); await W(200); await p.keyboard.press('Escape'); await W(300);
console.log('Échap menu : panneau toujours ouvert', await p.locator('.panel[data-open="true"]').count(), '· sélection', await p.locator('.sel-box').count());
await p.keyboard.press('?'); await W(200); await p.keyboard.press('Escape'); await W(300);
console.log('Échap aide : aide fermée', await p.locator('.sc-pop').count(), '· panneau toujours ouvert', await p.locator('.panel[data-open="true"]').count());
// zone en écart : pastille visible une fois sélectionnée
await p.keyboard.press('Escape'); await W(300);
await p.locator('.zp-btn').click(); await W(200);
const warnIdx = await p.locator('.zp-pop button').evaluateAll(bs => bs.findIndex(b => b.querySelector('.warn')));
if (warnIdx >= 0) { await p.locator('.zp-pop button').nth(warnIdx).click(); await W(300); console.log('zone en écart sélectionnée → pastille', await p.locator('.zp-btn .warn').count()); }
console.log('errors', errs); await b.close();
