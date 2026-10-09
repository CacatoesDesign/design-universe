import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !/403|Failed to load resource/.test(m.text()) && errs.push(m.text()));
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Button', exact: true }).first().click(); await p.waitForTimeout(1200);
const bar = p.locator('.comp-wrap .zoombar');
const pct = async () => (await bar.locator('.pct').innerText()).trim();
const box = async () => { const r = await p.locator('.comp-center').boundingBox(); return Math.round(r.width); };
console.log('initial', await pct(), await box());
await bar.getByRole('button', { name: /^Zoom in/ }).click(); await p.waitForTimeout(200);
console.log('after +', await pct(), await box());
await p.keyboard.press('+'); await p.waitForTimeout(200); console.log('key +', await pct());
// pinch (ctrl+wheel) centered on stage
const st = await p.locator('.comp-wrap').boundingBox();
await p.mouse.move(st.x + st.width/2 + 100, st.y + st.height/2);
await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.keyboard.up('Control'); await p.waitForTimeout(300);
console.log('pinch', await pct(), 'level crumb', await p.locator('.crumbs button[aria-current="true"]').innerText());
// drag pan
const c0 = await p.locator('.comp-center').boundingBox();
const selBefore = await p.locator(".sel-box").count(); await p.mouse.move(st.x + st.width/2, st.y + st.height/2); await p.mouse.down(); await p.mouse.move(st.x + st.width/2 + 100, st.y + st.height/2 + 60, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100); console.log("sel unchanged after drag", selBefore === await p.locator(".sel-box").count());
const c1 = await p.locator('.comp-center').boundingBox();
console.log('pan dx/dy', Math.round(c1.x - c0.x), Math.round(c1.y - c0.y));
// select a zone after zoom: hit aligns?
const hit = p.locator('.zone-hit').first(); await hit.click({ force: true }); await p.waitForTimeout(900);
console.log('callout', await p.locator('.callout').count(), 'selbox', await p.locator('.sel-box').count());
await p.screenshot({ path: (process.env.E2E_SHOTS || 'e2e/shots') + '/zoom-comp.png' });
await p.keyboard.press('0'); await p.waitForTimeout(200); console.log('fit', await pct());
await p.keyboard.press('1'); await p.waitForTimeout(200); console.log('100%', await pct());
await p.keyboard.press('0');
// plain wheel still changes level
await p.mouse.move(st.x + st.width/2, st.y + st.height/2); await p.mouse.wheel(0, 200); await p.waitForTimeout(1000);
console.log('after wheel level', await p.locator('.crumbs button[aria-current="true"]').innerText());
console.log('errors', errs);
await b.close();
