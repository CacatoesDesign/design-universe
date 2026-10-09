import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
const ok = (k, v) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500);
const selEdges = () => p.locator('.react-flow__edge.selected').count();
const selNodes = () => p.locator('.react-flow__node.selected').count();
const clickEdge = async id => { const path = p.locator(`.react-flow__edge[data-id="${id}"] path`).first(); const bb = await path.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(250); };
const eid = await p.locator('.react-flow__edge').first().getAttribute('data-id');
// Lien seul + Échap
await clickEdge(eid);
ok('edge selected', (await selEdges()) === 1);
await p.keyboard.press('Escape'); await W(200);
ok('Esc clears edge-only selection', (await selEdges()) === 0);
// Rectangle (nodes + liens) + Clear
const a = await p.locator('.react-flow__node[data-id="l1"]').boundingBox(), c = await p.locator('.react-flow__node[data-id="links"]').boundingBox();
await p.mouse.move(a.x - 20, a.y - 20); await p.mouse.down(); await p.mouse.move(c.x + c.width + 10, c.y + c.height + 260, { steps: 15 }); await p.mouse.up(); await W(300);
console.log('selected nodes', await selNodes(), 'edges', await selEdges());
await p.locator('.sel-bar').getByRole('button', { name: 'Clear' }).click(); await W(200);
ok('Clear clears nodes and edges', (await selNodes()) === 0 && (await selEdges()) === 0);
// Rectangle + Échap
await p.mouse.move(a.x - 20, a.y - 20); await p.mouse.down(); await p.mouse.move(c.x + c.width + 10, c.y + c.height + 260, { steps: 15 }); await p.mouse.up(); await W(300);
await p.keyboard.press('Escape'); await W(200);
ok('Esc clears nodes and edges', (await selNodes()) === 0 && (await selEdges()) === 0);
console.log('errors', errs); await b.close();
