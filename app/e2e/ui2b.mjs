import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.locator('.search').fill('Pricing Card'); // pages repliées : la recherche les déplie
await p.locator('.side-item', { hasText: 'Pricing Card' }).first().click(); await W(1200);
console.log('sans variantes : crans désactivés', await p.locator('.dr-step:disabled .dr-name').allInnerTexts());
await p.locator('.search').fill('Button'); // pages repliées : la recherche les déplie
await p.locator('.side-item', { hasText: /^Button\s*18/ }).click(); await W(800);
await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await W(1500);
await p.locator('.level[data-state="active"] .react-flow__node-more').evaluate(e => e.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await W(500);
console.log('Usage déplié : compactes', await p.locator('.level[data-state="active"] .fnode.compact').count());
await p.keyboard.press('ArrowUp'); await W(1500);
console.log('Library : carte courante via classe', await p.locator('.level[data-state="active"] .react-flow__node-lib .fnode.current').count());
const other = p.locator('.level[data-state="active"] .react-flow__node-lib .fnode:not(.current) .hd');
const n = await other.count(); let k = 0; for (let i = 0; i < n; i++) { const bb = await other.nth(i).boundingBox(); if (bb && bb.x > 300 && bb.y > 120 && bb.x + bb.width < 1400 && bb.y + bb.height < 880) { k = i; break; } }
const name = await other.nth(k).locator('.nm').innerText(); await other.nth(k).click(); await W(1800);
console.log('nouveau composant', name, '· niveau', await p.locator('.dr-step[aria-current="step"] .dr-name').innerText(), '· Usage replié (more présent)', await p.locator('.level[data-state="active"] .react-flow__node-more').count(), '· compactes', await p.locator('.level[data-state="active"] .fnode.compact').count());
console.log('errors', errs); await b.close();
