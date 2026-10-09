/** Rapprochement de caméra : léger zoom et glissement vers la cible, en douceur. */
export const NUDGE = { zoom: 1.08, pull: 0.15, ms: 560 };
/** Délai avant de quitter la vue : laisse le rapprochement s'amorcer. */
export const NAV_DELAY = 280;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Hors React Flow : transform CSS d'un calque « caméra » rapproché du point (px, py) d'une scène W × H. */
export function nudgeTransform(px: number, py: number, w: number, h: number) {
  if (reducedMotion()) return null;
  return `translate(${((w / 2 - px) * NUDGE.pull).toFixed(1)}px, ${((h / 2 - py) * NUDGE.pull).toFixed(1)}px) scale(${NUDGE.zoom})`;
}
