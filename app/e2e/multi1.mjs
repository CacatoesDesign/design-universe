import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
const ok = (k, v) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500);
const vp = () => p.locator('.react-flow__viewport').evaluate(e => e.style.transform);
const sel = () => p.locator('.react-flow__node.selected').count();
const box = async id => p.locator(`.react-flow__node[data-id="${id}"]`).boundingBox();
const n0 = await p.locator('.react-flow__node').count();
// Rectangle autour de l1 et l2 (colonne de gauche), départ dans le vide
const a = await box('l1'), c = await box('l2');
const t0 = await vp();
await p.mouse.move(a.x - 30, a.y - 30); await p.mouse.down();
await p.mouse.move(c.x + 40, c.y + c.height / 2, { steps: 15 }); await p.mouse.up(); await W(300);
ok('drag on empty canvas selects (no pan)', (await sel()) >= 2 && (await vp()) === t0);
ok('selection bar shows count', (await p.locator('.sel-bar').innerText()).includes(String(await sel())));
await p.screenshot({ path: (process.env.E2E_SHOTS || 'e2e/shots') + '/multi-select.png' });
// Shift + clic ajoute un node
const before = await sel();
await p.locator('.react-flow__node[data-id="nav"] .hd').click({ modifiers: ['Shift'] }); await W(300);
ok('shift-click adds', (await sel()) === before + 1);
// Échap
await p.keyboard.press('Escape'); await W(200);
ok('Esc clears', (await sel()) === 0 && (await p.locator('.sel-bar').count()) === 0);
// Espace + glisser = pan
const s1 = await vp(); const m = await box('screen');
await p.mouse.move(m.x + m.width + 80, m.y + 200);
await p.keyboard.down('Space'); await W(100);
await p.mouse.down(); await p.mouse.move(m.x + m.width - 120, m.y + 120, { steps: 10 }); await p.mouse.up();
await p.keyboard.up('Space'); await W(200);
ok('space + drag pans, no selection', (await vp()) !== s1 && (await sel()) === 0);
// Molette / deux doigts = pan, zoom inchangé
const z = s => +(/scale\(([\d.]+)\)/.exec(s)?.[1] ?? 1);
const s2 = await vp();
await p.mouse.move(800, 500); await p.mouse.wheel(0, 120); await W(300);
const s3 = await vp();
ok('wheel pans (zoom unchanged)', s3 !== s2 && z(s3) === z(s2));
// Pincement trackpad (ctrl + wheel) = zoom
await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await W(300);
ok('ctrl/pinch + wheel zooms', z(await vp()) !== z(s3));
// Suppression : rectangle autour des boutons b1, b2 puis Delete
await p.locator('.zoombar').getByRole('button', { name: /Fit/ }).click(); await W(500);
const b1 = await box('b1'), b2 = await box('b2');
await p.mouse.move(b1.x - 20, b1.y - 20); await p.mouse.down(); await p.mouse.move(b2.x + 30, b2.y + b2.height / 2, { steps: 12 }); await p.mouse.up(); await W(300);
const k = await sel();
await p.locator('.sel-bar').getByRole('button', { name: 'Delete' }).click(); await W(400);
ok(`Delete button removes ${k} nodes`, k >= 2 && (await p.locator('.react-flow__node').count()) === n0 - k);
const dangling = await p.evaluate(() => { const key = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:')); const s = JSON.parse(localStorage.getItem(key)); const ids = new Set(s.nodes.map(n => n.id)); return s.edges.filter(e => !ids.has(e.source) || !ids.has(e.target)).length; });
ok('no dangling edges', dangling === 0);
// Clavier : sélection rectangle + Backspace
const l1 = await box('l1'), l2 = await box('l2');
await p.mouse.move(l1.x - 20, l1.y - 20); await p.mouse.down(); await p.mouse.move(l2.x + 30, l2.y + l2.height / 2, { steps: 12 }); await p.mouse.up(); await W(300);
const k2 = await sel(), n1 = await p.locator('.react-flow__node').count();
await p.keyboard.press('Backspace'); await W(400);
ok('Backspace removes selection', k2 >= 2 && (await p.locator('.react-flow__node').count()) === n1 - k2);
// Clic simple : inspecteur toujours là
await p.locator('.react-flow__node[data-id="screen"]').click(); await W(400);
ok('single click opens inspector', (await p.locator('.inspector').count()) === 1);
console.log('errors', errs); await b.close();
