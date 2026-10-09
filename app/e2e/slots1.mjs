import { chromium } from 'playwright-core';
const o = (process.env.E2E_SHOTS || 'e2e/shots');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('403')) errs.push(m.text()); });
p.on('dialog', d => d.accept());
const W = ms => p.waitForTimeout(ms);
const ok = (k, v) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k);
const builder = async () => { await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500); };

await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await builder();
// Canvas : Card (Slot) (slot vide dans Figma) dans un Stack, Card (slot avec contenu Figma), un Écran.
await p.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:'));
  for (const x of Object.keys(localStorage)) if (x.startsWith('ds-graph-slot-picks-v1:') || x.startsWith('ds-graph-patterns-v1:')) localStorage.removeItem(x);
  const s = {
    nodes: [
      { id: 'card', type: 'component', position: { x: 0, y: 0 }, data: { kind: 'component', compId: '6062:16211', vprops: {}, texts: {} } },
      { id: 'card2', type: 'component', position: { x: 0, y: 420 }, data: { kind: 'component', compId: '2142:11380', vprops: {}, texts: {} } },
      { id: 'st', type: 'stack', position: { x: 360, y: 100 }, data: { kind: 'stack', name: 'Promo', dir: 'V', justify: 'start', align: 'start' } },
      { id: 'screen', type: 'screen', position: { x: 700, y: 200 }, data: { kind: 'screen', name: 'Home', width: 1280 } },
    ],
    edges: [
      { id: 'card>st', source: 'card', target: 'st', type: 'grad' },
      { id: 'st>screen', source: 'st', target: 'screen', type: 'grad' },
      { id: 'card2>screen', source: 'card2', target: 'screen', type: 'grad' },
    ],
  };
  localStorage.setItem(k, JSON.stringify(s));
});
await p.reload(); await W(1200); await builder();

const card = p.locator('.react-flow__node[data-id="card"]');
ok('card: slot row', await card.locator('.branch.slot').count() === 1);
ok('card: empty, choose components', (await card.locator('.branch.slot .bnow').textContent()) === 'empty · choose components');
ok('card2: Figma content', (await p.locator('.react-flow__node[data-id="card2"] .branch.slot .bnow').textContent()) === 'Figma content');
ok('slot handle present', await card.locator('.react-flow__handle[data-handleid="slot:Slot"]').count() === 1);

await card.click(); await W(500);
const insp = p.locator('.inspector');
ok('inspector: Empty in Figma', await insp.getByText('Empty in Figma').count() === 1);
ok('picker open by default', await insp.locator('details.slot-picker[open]').count() === 1);
await insp.getByRole('searchbox', { name: 'Search components for slot Slot' }).fill('button');
await W(200);
const labels = await insp.locator('.slot-picker label').allTextContents();
ok('search filters (' + labels.length + ')', labels.length > 0 && labels.every(l => /button/i.test(l)));
// Coche « Button » (nom exact) et « Button Group ».
for (const name of ['Button', 'Button Group']) {
  const i = labels.findIndex(l => l.replace(/Buttons$/, '').trim() === name);
  await insp.locator('.slot-picker label').nth(i).click(); await W(150);
}
const chips = await insp.locator('.slot-chips button').allTextContents();
ok('chips: ' + chips.join(', '), chips.length === 2 && chips.includes('+ Button'));
ok('note: your components', await insp.getByText('Your components for this slot · click to add').count() === 1);
await insp.locator('.slot-chips button', { hasText: /^\+ Button$/ }).click(); await W(600);
ok('node row: 1 item', (await card.locator('.branch.slot .bnow').textContent()) === '1 item');
ok('slot edge created', await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:')); return JSON.parse(localStorage.getItem(k)).edges.filter(e => e.target === 'card' && e.targetHandle === 'slot:Slot').length; }) === 1);
ok('inspector: replaces Figma content', await insp.getByText('1 item · replaces Figma content').count() === 1);
ok('instance code shows slot prop', (await insp.locator('.code').last().textContent()).includes('slot={…}'));
await p.screenshot({ path: o + '/slots-canvas.png' });

// Écran : aperçu + code
await p.locator('.react-flow__node[data-id="screen"]').click(); await W(600);
const slotEl = p.locator('.screen-preview [data-slot="Slot"]');
ok('preview: slot filled', await slotEl.count() === 1 && (await slotEl.innerText()).trim().length > 0);
ok('preview: Card default Body2 kept', (await p.locator('.screen-preview [data-slot]').count()) === 1);
await p.screenshot({ path: o + '/slots-screen.png' });
await insp.getByRole('button', { name: 'JSX', exact: true }).click(); await W(200);
const jsx = await insp.locator('pre.code').textContent();
ok('jsx: <CardSlot slot={', /<CardSlot slot=\{\s*<>\s*<Button/.test(jsx));
await insp.getByRole('button', { name: 'Files', exact: true }).click(); await W(200);
await insp.locator('summary', { hasText: /^CardSlot\.tsx/ }).click(); await W(200);
const files = await insp.locator('details[open] pre.code').first().textContent();
ok('component: slot?: ReactNode', files.includes('slot?: ReactNode') && files.includes("import type { ReactNode } from 'react';"));
await insp.locator('summary', { hasText: /^Card\.tsx/ }).click(); await W(200);
const cardTsx = await insp.locator('details[open] pre.code').nth(2).textContent();
ok('Card: body2 default content kept', cardTsx.includes('{body2 ?? ('));

// Pattern avec slot rempli : enregistrer, instancier, détacher.
await p.locator('.react-flow__node[data-id="st"]').click(); await W(400);
await insp.getByRole('button', { name: '◇ Save' }).click(); await W(400);
ok('pattern saved', await p.locator('.palette-item.pattern').count() === 1);
ok('pattern preview has slot content', await p.locator('.palette-item.pattern [data-slot="Slot"]').count() === 1);
await p.locator('.palette-item.pattern').dblclick(); await W(800);
const pid = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:')); return JSON.parse(localStorage.getItem(k)).nodes.find(n => n.type === 'pattern')?.id; });
await p.locator('.inspector').getByRole('button', { name: 'Detach' }).click(); await W(600);
const after = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:')); const s = JSON.parse(localStorage.getItem(k)); return { slotEdges: s.edges.filter(e => e.targetHandle === 'slot:Slot').length, patterns: s.nodes.filter(n => n.type === 'pattern').length }; });
ok('detach recreates slot link (' + JSON.stringify(after) + ')', !!pid && after.slotEdges === 2 && after.patterns === 0);

// Choix mémorisé après rechargement
await p.reload(); await W(1200); await builder();
await p.locator('.react-flow__node[data-id="card"]').click(); await W(400);
ok('picks persisted', (await p.locator('.inspector .slot-chips button').allTextContents()).includes('+ Button'));
ok('no console errors', errs.length === 0); if (errs.length) console.log(errs.slice(0, 5));
await b.close();
