import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await p.waitForTimeout(1200);
await p.locator('.zone-hit').nth(2).click(); await p.waitForTimeout(3200); // premier clic : caméra + halo
const z = await p.locator('.sel-box').first().boundingBox();
const h = await p.locator('.amb-halo').evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
console.log('premier clic (avec caméra) : écart halo / zone', Math.round(Math.hypot(h.x - (z.x + z.width / 2), h.y - (z.y + z.height / 2))), 'px');
await b.close();
