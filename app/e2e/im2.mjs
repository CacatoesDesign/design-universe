import { chromium } from 'playwright-core';
const o = (process.env.E2E_SHOTS || 'e2e/shots');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const run = async (reduced) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms);
  const tag = reduced ? '[réduit]' : '[normal]';
  const rest = () => p.evaluate(() => ({
    smilLoops: document.querySelectorAll('animate[repeatCount="indefinite"], animateTransform[repeatCount="indefinite"], animateMotion[repeatCount="indefinite"]').length,
    pulses: [...document.querySelectorAll('.level[data-state="active"] .pulse-dot, .builder .pulse-dot')].filter(c => +c.getAttribute('opacity') > 0).length,
    running: document.getAnimations().filter(a => a.playState === 'running' && !a.effect?.target?.classList?.contains('amb-glow')).length,
  }));
  await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await W(2500);
  console.log(tag, 'Usage au repos', JSON.stringify(await rest()));
  const n = p.locator('.level[data-state="active"] .react-flow__node-ctx').nth(1); const nb = await n.boundingBox();
  await p.mouse.move(nb.x + nb.width / 2, nb.y + 20); await W(400);
  console.log(tag, 'survol : dim', await p.locator('.level[data-state="active"] .react-flow__node.dim').count(), '· focus', await p.locator('.level[data-state="active"] .react-flow__node.focus').count(), '·', JSON.stringify(await rest()));
  if (!reduced) await p.screenshot({ path: o + '/im2-usage.png' });
  await p.mouse.move(nb.x + nb.width / 2, nb.y + 60); await W(300);
  console.log(tag, 'même node, pas de nouvelle impulsion', JSON.stringify(await rest()));
  await p.mouse.move(300, 880); await W(600);
  console.log(tag, 'sortie : dim', await p.locator('.level[data-state="active"] .react-flow__node.dim').count());
  await p.keyboard.press('ArrowUp'); await W(1800);
  const ln = p.locator('.level[data-state="active"] .react-flow__node-lib .fnode.current, .level[data-state="active"] .react-flow__node-lib .fnode').first(); const lb = await ln.boundingBox();
  await p.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await W(500);
  console.log(tag, 'Library survol : dim', await p.locator('.level[data-state="active"] .react-flow__node.dim').count(), '·', JSON.stringify(await rest()));
  if (!reduced) await p.screenshot({ path: o + '/im2-library.png' });
  await p.getByRole('tab', { name: 'Builder' }).click(); await W(1500);
  console.log(tag, 'Builder au repos', JSON.stringify(await rest()));
  const bn = await p.locator('.builder .react-flow__node').first().boundingBox();
  await p.mouse.move(bn.x + bn.width / 2, bn.y + bn.height / 2); await W(400);
  console.log(tag, 'Builder survol : dim', await p.locator('.builder .react-flow__node.dim').count(), '·', JSON.stringify(await rest()));
  console.log(tag, 'errors', errs); await ctx.close();
};
await run(false); await run(true); await b.close();
