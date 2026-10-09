import { chromium } from 'playwright-core';
const o = (process.env.E2E_SHOTS || 'e2e/shots');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('403')) errs.push(m.text()); });
p.on('dialog', d => d.accept());
const W = ms => p.waitForTimeout(ms);
const ok = (k, v) => console.log((v ? 'OK  ' : 'FAIL') + ' ' + k);

await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1200);

// Graphe de départ : Navbar + If (isLoggedIn) entre « Log in » et « My account », Show (breakpoint ≠ mobile) sur « Book now ».
await p.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:'));
  const s = JSON.parse(localStorage.getItem(k));
  const b1 = s.nodes.find(n => n.id === 'b1');
  s.nodes.push({ id: 'acc', type: 'component', position: { x: -300, y: 520 }, data: { ...b1.data, texts: { '0': 'My account' } } });
  s.nodes.push({ id: 'if1', type: 'if', position: { x: 160, y: 560 }, data: { kind: 'if', name: 'If logged in', cond: { subject: { src: 'var', id: 'v1' }, op: 'eq', value: 'true' } } });
  s.nodes.push({ id: 'sh1', type: 'show', position: { x: 160, y: 860 }, data: { kind: 'show', name: 'Hide on mobile', cond: { subject: { src: 'bp' }, op: 'neq', value: 'mobile' } } });
  s.edges = s.edges.filter(e => e.source !== 'b1' && e.source !== 'b2');
  s.edges.push({ id: 'a>if1', source: 'acc', target: 'if1', targetHandle: 'then', type: 'grad' });
  s.edges.push({ id: 'b1>if1', source: 'b1', target: 'if1', targetHandle: 'else', type: 'grad' });
  s.edges.push({ id: 'if1>actions', source: 'if1', target: 'actions', type: 'grad' });
  s.edges.push({ id: 'b2>sh1', source: 'b2', target: 'sh1', targetHandle: 'in', type: 'grad' });
  s.edges.push({ id: 'sh1>actions', source: 'sh1', target: 'actions', type: 'grad' });
  localStorage.setItem(k, JSON.stringify(s));
  localStorage.setItem(k.replace('builder', 'logic'), JSON.stringify({ vars: [{ id: 'v1', name: 'isLoggedIn', type: 'boolean', options: [], def: 'false' }], values: {}, bp: 'desktop' }));
});
await p.reload(); await W(1200);
await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1500);

ok('2 logic nodes', await p.locator('.bnode.logic').count() === 2);
const ifNode = p.locator('.react-flow__node[data-id="if1"]');
ok('else shown by default', await ifNode.locator('.branch[data-on="true"] .bl').textContent() === 'else');
const idleEdge = await p.locator('.react-flow__edge[data-id="a>if1"]').count();
ok('then edge rendered', idleEdge === 1);
await p.screenshot({ path: o + '/logic-canvas.png' });

// Aperçu de l'écran
await p.locator('.react-flow__node[data-id="screen"]').click(); await W(500);
const prev = () => p.locator('.screen-preview').innerText();
let t = await prev();
ok('preview: Sign in + Register, no My account', t.includes('Sign in') && t.includes('Register') && !t.includes('My account'));

// Simulateur : isLoggedIn = true
await p.locator('.sim-panel').getByRole('group', { name: 'Value of isLoggedIn' }).getByRole('button', { name: 'true' }).click(); await W(400);
t = await prev();
ok('logged in: My account, no Sign in', t.includes('My account') && !t.includes('Sign in'));
ok('then branch on', await ifNode.locator('.branch[data-on="true"] .bl').textContent() === 'then');

// Breakpoint mobile : « Book now » masqué, l'Écran passe à 390
await p.locator('.sim-panel').getByRole('group', { name: 'Breakpoint' }).getByRole('button', { name: 'Mobile' }).click(); await W(400);
t = await prev();
ok('mobile: no Register', !t.includes('Register'));
ok('screen width 390', await p.locator('.inspector select').filter({ has: p.locator('option[value="390"]') }).first().inputValue() === '390');
await p.screenshot({ path: o + '/logic-mobile.png' });

// Code
await p.locator('.inspector').getByRole('button', { name: 'JSX', exact: true }).click(); await W(200);
const jsx = await p.locator('.inspector pre.code').first().innerText();
console.log(jsx.split('\n').slice(0, 40).join('\n'));
ok('code: props interface', /export interface LandingProps \{[\s\S]*isLoggedIn\?: boolean;/.test(jsx));
ok('code: default', jsx.includes('isLoggedIn = false'));
ok('code: ternary', jsx.includes('{isLoggedIn ? ('));
ok('code: show', jsx.includes("{bp !== 'mobile' && ("));
ok('code: hook', jsx.includes('const bp = useBreakpoint();') && jsx.includes("from './hooks/useBreakpoint'"));
await p.locator('.inspector').getByRole('button', { name: 'Files', exact: true }).click(); await W(200);
ok('files: hook file', (await p.locator('.inspector summary', { hasText: 'hooks/useBreakpoint.ts' }).count()) === 1);
await p.locator('.sim-panel').getByRole('group', { name: 'Breakpoint' }).getByRole('button', { name: 'Desktop' }).click(); await W(300);

// Nouvelle variable enum via le simulateur
await p.locator('.sim-panel').getByRole('button', { name: '+ Variable' }).click();
await p.locator('.sim-edit').getByLabel('Name').fill('role');
await p.locator('.sim-edit').getByLabel('Type').selectOption('enum');
await p.locator('.sim-edit').getByLabel('Values').fill('admin, user');
await p.locator('.sim-edit').getByRole('button', { name: 'Save' }).click(); await W(300);
ok('role var added', (await p.locator('.sim-panel button.sim-k', { hasText: 'role' }).count()) === 1);

// Router par rôle
await p.getByRole('button', { name: '+ Router' }).click(); await W(900);
const insp = p.locator('.inspector');
await insp.getByLabel('Test').selectOption({ label: 'role' }); await W(200);
await insp.getByRole('button', { name: '+ Case' }).click(); await W(200);
const router = p.locator('.react-flow__node-switch');
const labels = await router.locator('.branch .bl').allTextContents();
ok('router cases admin/user/default ' + labels.join(','), labels.join(',') === 'admin,user,default');
ok('router: default shown (role=admin? first)', (await router.locator('.branch[data-on="true"] .bl').textContent()) === 'admin');
await p.screenshot({ path: o + '/logic-router.png' });

// Replier le simulateur (il couvre le coin haut-gauche du canvas), le choix est retenu
await p.getByRole('button', { name: 'Collapse the simulator' }).click(); await W(200);
ok('sim collapsed pill', (await p.locator('.sim-closed').count()) === 1);
// Relier la sortie du Router à l'entrée « Links » à la souris
await p.locator('.react-flow__controls, .zoombar').first().getByRole('button', { name: /Fit/ }).click().catch(() => {}); await W(400);
const src = await router.locator('.react-flow__handle.source').boundingBox();
const tgt = await p.locator('.react-flow__node[data-id="links"] .react-flow__handle.target').boundingBox();
await p.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await p.mouse.down();
await p.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height / 2, { steps: 12 }); await p.mouse.up(); await W(300);
const rid = await router.getAttribute('data-id');
ok('router connected to Links', (await p.locator(`.react-flow__edge[data-id^="xy-edge__${rid}"]`).count()) === 1);
// Relier « l2 » à l'entrée « admin » du Router, puis le remplacer par « l1 » (une seule entrée par poignée)
const drag = async (fromSel, toSel) => {
  await p.locator('.zoombar').getByRole('button', { name: /Fit/ }).click(); await W(400);
  const a = await p.locator(fromSel).boundingBox(), c = await p.locator(toSel).boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
  await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 }); await p.mouse.up(); await W(300);
};
const caseH = await router.locator('.branch').first().locator('.react-flow__handle').getAttribute('data-handleid');
await drag('.react-flow__node[data-id="l2"] .react-flow__handle.source', `.react-flow__node[data-id="${rid}"] .react-flow__handle[data-handleid="${caseH}"]`);
await drag('.react-flow__node[data-id="l1"] .react-flow__handle.source', `.react-flow__node[data-id="${rid}"] .react-flow__handle[data-handleid="${caseH}"]`);
const into = await p.evaluate(rid => { const k = Object.keys(localStorage).find(x => x.startsWith('ds-graph-builder-v1:')); return JSON.parse(localStorage.getItem(k)).edges.filter(e => e.target === rid).map(e => e.source + '@' + e.targetHandle); }, rid);
ok('one input per handle: ' + into.join(','), into.length === 1 && into[0].startsWith('l1@'));

// Pattern : refusé s'il contient de la logique
await p.locator('.react-flow__node[data-id="actions"]').click(); await W(500);
await p.locator('.inspector').getByLabel('Pattern name').fill('Auth actions');
await p.locator('.inspector').getByRole('button', { name: /Save/ }).click(); await W(200);
ok('pattern refused', (await p.locator('.inspector .note', { hasText: "can't contain" }).count()) === 1);

// Persistance
await p.reload(); await W(1200); await p.getByRole('tab', { name: 'Builder', exact: true }).click(); await W(1200);
ok('persisted: sim stays collapsed', (await p.locator('.sim-closed').count()) === 1);
await p.locator('.sim-closed').click(); await W(200);
ok('persisted: role + router', (await p.locator('.sim-panel button.sim-k', { hasText: 'role' }).count()) === 1 && (await p.locator('.react-flow__node-switch').count()) === 1);
await p.locator('.react-flow__node[data-id="if1"]').click(); await W(500);
await p.screenshot({ path: o + '/logic-if-inspector.png' });
await p.getByRole('button', { name: 'Dark', exact: true }).click(); await W(500);
await p.screenshot({ path: o + '/logic-dark.png' });
await p.getByRole('button', { name: 'Light', exact: true }).click();
console.log('errors', errs);
await b.close();
