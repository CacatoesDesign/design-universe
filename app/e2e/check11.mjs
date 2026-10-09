import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !/403|Failed to load resource/.test(m.text()) && errs.push(m.text()));
const W = ms => p.waitForTimeout(ms);
const vp = sel => p.locator(sel).first().evaluate(e => getComputedStyle(e).transform);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1500);
// Component
await p.getByRole('button', { name: 'Button', exact: true }).first().click(); await W(1200);
console.log('comp cam before', await vp('.comp-wrap .camera'));
await p.locator('.zone-hit').nth(2).click(); await W(150);
const mid = await vp('.comp-wrap .camera'); await W(700);
const sb = await p.locator('.sel-box').first().boundingBox(), zh = await p.locator('.zone-hit').nth(2).boundingBox();
console.log('comp mid', mid, 'end', await vp('.comp-wrap .camera'), 'selbox aligned', Math.abs(sb.x-zh.x)<1 && Math.abs(sb.y-zh.y)<1);
await p.locator('.zone-hit').nth(4).click(); await W(700); console.log('comp 2nd click (no extra move)', await vp('.comp-wrap .camera'));
await p.keyboard.press('Escape'); await W(700); console.log('comp after Esc', await vp('.comp-wrap .camera'));
// Pattern
await p.keyboard.press('ArrowUp'); await W(1200);
console.log('pattern before', await vp('.pattern-wrap .camera'));
await p.locator('.pattern-frame .pf-label').click(); await W(700); console.log('pattern after click', await vp('.pattern-wrap .camera'));
await p.keyboard.press('Escape'); await W(700); console.log('pattern after close', await vp('.pattern-wrap .camera'));
// Usage
await p.keyboard.press('ArrowUp'); await W(1500);
const lv = '.level[data-state="active"] .react-flow__viewport';
const u0 = await vp(lv); console.log('usage before', u0);
const ctx = p.locator('.level[data-state="active"] .react-flow__node-ctx');
const n = await ctx.count(); let target = null;
for (let i = 0; i < n; i++) if (await ctx.nth(i).locator('.badge.coral').count()) { target = ctx.nth(i); break; }
if (target) {
  { const bb = await target.locator('.hd').boundingBox(); await p.mouse.click(bb.x + bb.width/2, bb.y + bb.height/2); } await W(800); console.log('usage after screen click', await vp(lv), 'screen panel', await p.locator('text=Open in Figma').count());
  await p.keyboard.press('Escape'); await W(800); const u2 = await vp(lv); console.log('usage after close', u2, 'restored', u2 === u0);
} else console.log('no screen ctx');
// Library
await p.keyboard.press('ArrowUp'); await W(1500);
const l0 = await vp(lv); { const hs = p.locator('.level[data-state="active"] .react-flow__node-lib .fnode .hd'); const n = await hs.count(); let k = 0; for (let i = 0; i < n; i++) { const bb = await hs.nth(i).boundingBox(); if (bb && bb.x > 300 && bb.y > 120 && bb.x + bb.width < 1400 && bb.y + bb.height < 880) { k = i; break; } } await hs.nth(k).click(); }; await W(150);
console.log('library moved', (await vp('.level[data-state="above"] .react-flow__viewport, ' + lv)) !== l0);
await W(1200); console.log('crumb', await p.locator('.crumbs button[aria-current="true"]').innerText());
// Builder
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500);
const bv = '.builder .react-flow__viewport';
const b0 = await vp(bv); console.log('builder before', b0);
await p.locator('.builder .react-flow__node').first().click(); await W(900);
console.log('builder after click', await vp(bv), 'inspector', await p.locator('.inspector').count());
await p.locator('.builder .react-flow__node').nth(1).click(); await W(900); console.log('builder 2nd click', await vp(bv));
await p.locator('.builder .react-flow__pane').click({ position: { x: 20, y: 20 } }); await W(900);
const b2 = await vp(bv); console.log('builder after deselect', b2, 'inspector', await p.locator('.inspector').count());
console.log('errors', errs);
await b.close();
