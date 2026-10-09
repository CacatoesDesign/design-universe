import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
const ghostDuring = async (action) => { await p.evaluate(() => { window.__g = 0; const t0 = performance.now(); const tick = () => { if (document.querySelector('.dive-ghost')) window.__g++; if (performance.now() - t0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); await action(); await W(1000); return p.evaluate(() => window.__g); };
const lvl = () => p.locator('.dr-step[aria-current="step"] .dr-name').innerText();
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await W(1600);
// plongées : Usage → Pattern (clic carte) → Component (clic instance)
const card = await p.locator('.level[data-state="active"] .react-flow__node-ctx .hd').first().boundingBox();
console.log('plongée Usage→Pattern', await ghostDuring(async () => { await p.mouse.click(card.x + card.width / 2, card.y + card.height / 2); await W(300); }), await lvl());
const ring = p.locator('.level[data-state="active"] .inst-ring').first();
console.log('plongée Pattern→Component', await ghostDuring(async () => { await ring.click(); await W(300); }), await lvl());
// saut direct au sommet par le rail, puis Usage par le rail, puis ↑
await p.locator('.dr-step', { hasText: 'Library' }).click(); await W(1500); console.log('saut', await lvl());
await p.locator('.dr-step', { hasText: 'Usage' }).click(); await W(1500); console.log('rail', await lvl());
console.log('↑ depuis Usage (aucune plongée récente) : frames de fantôme', await ghostDuring(() => p.keyboard.press('ArrowUp')), await lvl());
console.log('errors', errs); await b.close();
