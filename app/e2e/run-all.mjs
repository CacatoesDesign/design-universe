// Lance toute la suite de non-régression, un script après l'autre, et résume les échecs.
// Usage (depuis app/) : npm run build && npx vite preview --port 4175 --strictPort, puis node e2e/run-all.mjs [script…]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = process.env.E2E_SHOTS || 'e2e/shots';
mkdirSync(shots, { recursive: true });
const all = readdirSync(here).filter(f => f.endsWith('.mjs') && f !== 'run-all.mjs').map(f => f.replace(/\.mjs$/, ''));
const list = process.argv.length > 2 ? process.argv.slice(2) : all;
let failed = 0;
for (const t of list) {
  const r = spawnSync('node', [join(here, t + '.mjs')], { encoding: 'utf8', timeout: 170_000, env: { ...process.env, E2E_SHOTS: shots } });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const bad = out.split('\n').filter(l => /^FAIL|Error/.test(l));
  if (r.status !== 0 && !bad.length) bad.push(`exit ${r.status ?? r.signal}`);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${t}${bad.length ? '\n    ' + bad.slice(0, 3).join('\n    ') : ''}`);
  if (bad.length) failed++;
}
console.log(`\n${list.length - failed}/${list.length} scripts sans échec`);
process.exit(failed ? 1 : 0);
