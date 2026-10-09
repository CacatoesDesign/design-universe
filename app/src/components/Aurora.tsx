import { useEffect, useRef } from 'react';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fond « Aurora » de la maquette : halos rose / violet flous, grain, assombrissement
 * selon la profondeur (jusqu'à 7 % au niveau Component) et léger décalage à chaque changement de zone.
 */
export function Aurora({ depth, zone, dark, hover }: { depth: number; zone: number; dark: boolean; hover?: boolean }) {
  const a = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced()) return;
    const anims = ([[a, [[0, 0, 1], [6, -4, 1.1], [-4, 5, 1.04]], 19000], [b, [[0, 0, 1.05], [-6, 4, 0.96], [4, -5, 1.1]], 23000]] as const).map(([r, kf, dur]) =>
      r.current?.animate(kf.map(([x, y, s]) => ({ transform: `translate(${x}%, ${y}%) scale(${s})` })), { duration: dur, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
    return () => anims.forEach(x => x?.cancel());
  }, []);
  // depth : 0 Component, 1 Pattern, 2 Usage, 3 Library
  const LV = [[4, -3, 1.1, -6], [-11, 8, 1.0, 12], [10, -9, 0.9, -12], [-6, 10, 0.86, 6]][Math.min(depth, 3)];
  const Z = [[0, 0], [3.2, -2], [-2.6, 2.8], [3.6, 1.8], [-3.2, -2.6], [2, 3.4], [-3.6, -1.3], [2.8, -3.2]][zone % 8];
  const hv = hover ? 0.035 : 0;
  const ax = LV[0] + Z[0], ay = LV[1] + Z[1], hz = zone ? (zone % 2 ? 4 : -4) : 0;
  const pink = dark
    ? 'radial-gradient(40% 50% at 20% 22%, rgba(214,82,140,0.42), transparent 70%), radial-gradient(55% 45% at 58% 96%, rgba(176,64,120,0.36), transparent 70%)'
    : 'radial-gradient(40% 50% at 20% 22%, rgba(244,160,196,0.62), transparent 70%), radial-gradient(55% 45% at 58% 96%, rgba(236,128,160,0.42), transparent 70%)';
  const violet = dark
    ? 'radial-gradient(40% 55% at 82% 24%, rgba(124,92,230,0.42), transparent 70%), radial-gradient(32% 36% at 46% 54%, rgba(90,70,170,0.28), transparent 70%)'
    : 'radial-gradient(40% 55% at 82% 24%, rgba(178,152,244,0.55), transparent 70%), radial-gradient(32% 36% at 46% 54%, rgba(240,234,255,0.9), transparent 70%)';
  return (
    <>
      <div className="aurora-layer" style={{ transform: `translate(${ax}%, ${ay}%) scale(${LV[2] + hv})`, filter: `hue-rotate(${LV[3] + hz}deg)` }}><div ref={a} style={{ background: pink }} /></div>
      <div className="aurora-layer" style={{ transform: `translate(${-ax * 0.8}%, ${-ay * 0.8}%) scale(${2 - LV[2] + hv})`, filter: `hue-rotate(${-LV[3] * 0.7 - hz}deg)` }}><div ref={b} style={{ background: violet }} /></div>
      <div className="aurora-dim" style={{ opacity: [0.07, 0.035, 0, 0][Math.min(depth, 3)] }} />
      <svg className="grain" width="100%" height="100%" style={{ opacity: dark ? 0.32 : 0.45 }}>
        <filter id="cc-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#cc-grain)" />
      </svg>
    </>
  );
}
