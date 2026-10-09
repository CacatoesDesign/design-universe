import { chromium } from 'playwright-core';
const o = (process.env.E2E_SHOTS || 'e2e/shots');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const run = async (reduced) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms);
  await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
  const halo = () => p.locator('.amb-halo').evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const glowAnims = () => p.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.classList?.contains('amb-glow')).length);
  console.log(reduced ? '[réduit]' : '[normal]', 'dérive', await glowAnims());
  await p.locator('.zp-btn').click(); await p.locator('.zp-pop button').nth(4).click(); await W(2800);
  const z = await p.locator('.sel-box').first().boundingBox(); const h = await halo();
  // la dérive (±30 px) s'ajoute au transform de .amb-glow, pas à .amb-halo : on compare le halo seul
  console.log('écart halo / zone', Math.round(Math.hypot(h.x - (z.x + z.width / 2), h.y - (z.y + z.height / 2))), 'px');
  if (!reduced) {
    await p.screenshot({ path: o + '/im1-light.png' });
    await p.getByRole('button', { name: 'Dark', exact: true }).click(); await W(800); await p.screenshot({ path: o + '/im1-dark.png' });
    await p.getByRole('button', { name: 'Light', exact: true }).click();
    await p.keyboard.press('Escape'); await W(2800); const h2 = await halo(); console.log('repos', Math.round(h2.x), Math.round(h2.y));
    await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await W(1500);
    const n = p.locator('.level[data-state="active"] .react-flow__node-ctx').first(); const nb = await n.boundingBox();
    await p.mouse.move(nb.x + nb.width / 2, nb.y + 20); await W(2800); const h3 = await halo();
    console.log('survol node écart', Math.round(Math.hypot(h3.x - (nb.x + nb.width / 2), h3.y - (nb.y + nb.height / 2))), 'px');
    const bg = await p.evaluate(() => [...document.querySelectorAll('.stage *')].filter(e => /radial-gradient/.test(getComputedStyle(e).backgroundImage)).length);
    console.log('fonds en dégradé radial dans la scène', bg);
  }
  console.log('errors', errs); await ctx.close();
};
await run(false); await run(true); await b.close();
