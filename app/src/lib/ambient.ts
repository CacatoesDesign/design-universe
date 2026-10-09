/**
 * Bus minimal pour la lumière ambiante : la vue active indique où regarder (coordonnées écran)
 * et de combien le canvas a bougé (parallaxe). Évite de faire transiter ces valeurs par l'état React.
 */
export type AmbientTarget = { x: number; y: number } | null;
const TARGET = 'ds-ambient-target', PARALLAX = 'ds-ambient-parallax';

let pending: number | undefined;
const emit = (t: AmbientTarget) => window.dispatchEvent(new CustomEvent<AmbientTarget>(TARGET, { detail: t }));
export const setAmbientTarget = (t: AmbientTarget) => { clearTimeout(pending); emit(t); };
/** Relâche la cible après un court délai : un survol qui passe d'un node à l'autre ne fait pas revenir la lumière au repos. */
export const releaseAmbientTarget = (ms = 180) => { clearTimeout(pending); pending = window.setTimeout(() => emit(null), ms); };
export const setAmbientParallax = (dx: number, dy: number) => window.dispatchEvent(new CustomEvent<{ dx: number; dy: number }>(PARALLAX, { detail: { dx, dy } }));
export const onAmbientTarget = (fn: (t: AmbientTarget) => void) => { const h = (e: Event) => fn((e as CustomEvent<AmbientTarget>).detail); window.addEventListener(TARGET, h); return () => window.removeEventListener(TARGET, h); };
export const onAmbientParallax = (fn: (p: { dx: number; dy: number }) => void) => { const h = (e: Event) => fn((e as CustomEvent<{ dx: number; dy: number }>).detail); window.addEventListener(PARALLAX, h); return () => window.removeEventListener(PARALLAX, h); };
