import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const W = ms => p.waitForTimeout(ms);
const ok = (k, v) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1200);
// Show(isOpen) contenant un Router numérique (count : 1 → b1, défaut → b2)
await p.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:'));
  const s = JSON.parse(localStorage.getItem(k));
  s.nodes.push({ id: 'sh', type: 'show', position: { x: 160, y: 900 }, data: { kind: 'show', name: 'Show', cond: { subject: { src: 'var', id: 'vo' }, op: 'eq', value: 'true' } } });
  s.nodes.push({ id: 'rt', type: 'switch', position: { x: 0, y: 1100 }, data: { kind: 'switch', name: 'Router', subject: { src: 'var', id: 'vc' }, cases: [{ id: 'c1', value: '1' }] } });
  s.edges = s.edges.filter(e => e.source !== 'b1' && e.source !== 'b2');
  s.edges.push({ id: 'e1', source: 'b1', target: 'rt', targetHandle: 'c1', type: 'grad' }, { id: 'e2', source: 'b2', target: 'rt', targetHandle: 'default', type: 'grad' },
    { id: 'e3', source: 'rt', target: 'sh', targetHandle: 'in', type: 'grad' }, { id: 'e4', source: 'sh', target: 'actions', type: 'grad' });
  localStorage.setItem(k, JSON.stringify(s));
  localStorage.setItem(k.replace('builder', 'logic'), JSON.stringify({ vars: [
    { id: 'vo', name: 'isOpen', type: 'boolean', options: [], def: 'false' },
    { id: 'vc', name: 'count', type: 'number', options: [], def: '1.0' }], values: {}, bp: 'desktop' }));
});
await p.reload(); await W(1200); await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500);
ok('numeric router: 1.0 matches case 1', (await p.locator('.react-flow__node[data-id="rt"] .branch[data-on="true"] .bl').textContent()) === '1');
await p.locator('.react-flow__node[data-id="screen"]').click(); await W(500);
let t = await p.locator('.screen-preview').innerText();
ok('show false hides nested router (no Sign in, no Register)', !t.includes('Sign in') && !t.includes('Register'));
await p.locator('.inspector').getByRole('button', { name: 'JSX', exact: true }).click(); await W(200);
const jsx = await p.locator('.inspector pre.code').first().innerText();
ok('nested logic in parens', jsx.includes('{isOpen && (count === 1 ? ('));
console.log(jsx.split('\n').filter(l => /isOpen|count|: \(|\)\)/.test(l)).join('\n'));
// Éditeur : true/false du défaut ne soumet pas ; noms en collision refusés
await p.locator('.sim-panel').getByRole('button', { name: '+ Variable' }).click();
const ed = p.locator('.sim-edit');
await ed.getByLabel('Name').fill('hasCart');
await ed.getByRole('group', { name: 'Default value' }).getByRole('button', { name: 'true' }).click(); await W(200);
ok('default toggle keeps editor open', (await ed.count()) === 1);
ok('default now true', (await ed.getByRole('group', { name: 'Default value' }).getByRole('button', { name: 'true' }).getAttribute('aria-pressed')) === 'true');
await ed.getByLabel('Name').fill('is open');
ok('collision is open ~ isOpen refused', (await ed.getByRole('button', { name: 'Save' }).isDisabled()) && (await ed.locator('.note').innerText()).includes('isOpen'));
await ed.getByLabel('Name').fill('default');
ok('reserved name refused', await ed.getByRole('button', { name: 'Save' }).isDisabled());
await ed.getByLabel('Name').fill('hasCart');
await ed.getByRole('button', { name: 'Save' }).click(); await W(200);
const saved = await p.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-logic-v1:')); return JSON.parse(localStorage.getItem(k)).vars.find(v => v.name === 'hasCart'); });
ok('saved with default true', saved?.def === 'true');
console.log('errors', errs); await b.close();
