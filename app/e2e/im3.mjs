import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const run = async (reduced) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms); const tag = reduced ? '[réduit]' : '[normal]';
  await p.goto((process.env.E2E_URL || 'http://localhost:4175') + '/'); await W(1200);
  // échantillonne les échelles des niveaux pendant une transition
  const sample = async (action) => {
    await p.evaluate(() => { window.__s = []; window.__g = 0; const t0 = performance.now(); const tick = () => { for (const l of document.querySelectorAll('.level')) { const m = new DOMMatrix(getComputedStyle(l).transform); if (getComputedStyle(l).opacity > 0.02) window.__s.push(m.a); } if (document.querySelector('.dive-ghost')) window.__g++; if (performance.now() - t0 < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await action(); await W(1000);
    return p.evaluate(() => ({ min: Math.min(...window.__s).toFixed(3), max: Math.max(...window.__s).toFixed(3), ghostFrames: window.__g }));
  };
  console.log(tag, 'Component → Pattern (↑)', JSON.stringify(await sample(() => p.keyboard.press('ArrowUp'))));
  console.log(tag, 'Pattern → Usage (↑)', JSON.stringify(await sample(() => p.keyboard.press('ArrowUp'))));
  const card = p.locator('.level[data-state="active"] .react-flow__node-ctx .hd').first();
  console.log(tag, 'Usage → Pattern (clic carte)', JSON.stringify(await sample(async () => { const bb = await card.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(300); })));
  console.log(tag, 'niveau', await p.locator('.dr-step[aria-current="step"] .dr-name').innerText());
  console.log(tag, 'retour Pattern → Usage (↑)', JSON.stringify(await sample(() => p.keyboard.press('ArrowUp'))));
  console.log(tag, 'errors', errs); await ctx.close();
};
await run(false); await run(true); await b.close();
