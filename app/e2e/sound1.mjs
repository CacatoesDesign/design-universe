import { chromium } from 'playwright-core';
// Son : coupé par défaut ; activé, la musique suit le niveau de l'Explorer et le choix survit au rechargement.
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const audio = []; p.on('response', r => { if (r.url().includes('/audio/') && r.request().method() === 'GET') audio.push(`${r.url().split('/audio/')[1]} ${r.status()}`); });
// Compte les sons courts (< 1 s) réellement démarrés.
await p.addInitScript(() => { const st = AudioBufferSourceNode.prototype.start; window.__sfx = 0; AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer && this.buffer.duration < 1) window.__sfx++; return st.apply(this, a); }; });
const W = ms => p.waitForTimeout(ms);
const sfxCount = () => p.evaluate(() => window.__sfx);
const music = () => p.evaluate(() => document.documentElement.dataset.music ?? '');
const ok = (c, m) => console.log(c ? 'ok  ' : 'FAIL', m);
await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
const btn = p.getByRole('button', { name: 'Sound', exact: true });
// Dépôt sans fichiers audio (version publique) : pas de bouton Sound, rien d'autre à tester.
const hasAudio = await p.evaluate(async () => { const r = await fetch('/audio/sfx-select.wav', { method: 'HEAD' }); return r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/'); });
if (!hasAudio) { ok(await btn.count() === 0, 'sans fichiers audio : pas de bouton Sound'); console.log('errors', errs); if (errs.length) console.log('FAIL erreurs page'); await b.close(); process.exit(0); }
ok(await btn.getAttribute('aria-pressed') === 'false', 'coupé par défaut');
ok(!audio.length, `aucun fichier audio chargé tant que le son est coupé (${audio.length})`);
await btn.click(); await W(2500);
ok(await btn.getAttribute('aria-pressed') === 'true', 'bouton activé');
ok(await music() === 'music-d.mp3', `niveau Component → partie D (${await music()})`);
for (const [key, want] of [['ArrowUp', 'music-c.mp3'], ['ArrowUp', 'music-b.mp3'], ['ArrowUp', 'music-a.mp3'], ['ArrowDown', 'music-b.mp3']]) {
  await p.keyboard.press(key); await W(2200);
  ok(await music() === want, `${key} → ${want} (${await music()})`);
}
let n = await sfxCount();
await p.locator('.search').fill('Button'); // pages repliées : la recherche les déplie
await p.locator('.side-item', { hasText: /^Button\s*\d/ }).first().click(); await W(2500);
ok(await sfxCount() > n, 'ouvrir un composant depuis la barre latérale joue le son de plongée');
ok(await music() === 'music-d.mp3', `retour au composant → D (${await music()})`);
n = await sfxCount();
await p.locator('.zone-hit[title^="Label"]').first().click(); await W(300);
ok(await sfxCount() === n + 1, `clic sur une zone : un son joué (${await sfxCount() - n})`);
n = await sfxCount(); await p.keyboard.press('ArrowRight'); await W(200);
ok(await sfxCount() === n + 1, 'zone suivante au clavier : un son');
n = await sfxCount(); await p.getByRole('tab', { name: 'Builder' }).click(); await W(1500);
ok(await sfxCount() === n + 1, 'onglet Builder : un son');
n = await sfxCount(); await p.locator('.palette-item').first().dblclick(); await W(400);
ok(await sfxCount() > n, 'composant ajouté au Builder : un son');
n = await sfxCount(); await p.getByRole('tab', { name: 'Explorer' }).click(); await W(1500);
ok(await sfxCount() === n + 1, 'retour à l\'Explorer : un son');
console.log('audio:', audio.join(', '));
await p.reload(); await W(1200);
ok(await btn.getAttribute('aria-pressed') === 'true', 'choix gardé après rechargement');
await btn.click(); await W(900);
ok(await btn.getAttribute('aria-pressed') === 'false' && await music() === '', 'coupé : musique arrêtée');
console.log('errors', errs); if (errs.length) console.log('FAIL erreurs page'); await b.close();
