import { useEffect, useId, useRef } from 'react';
import { reducedMotion } from '../lib/camera';

// Impulsions en vol, hors du cycle de vie du composant : React Flow peut remonter ses liens (fin de survol, etc.),
// l'impulsion reprend alors là où elle en était au lieu d'être coupée ou rejouée.
const flights = new Map<string, { key: number | string; t0: number }>();
const played = new Map<string, Set<number | string>>();
const DUR = 900;
type Ref<T> = { current: T };
/** Boucle d'affichage : lit l'impulsion en vol du lien et place le point le long du tracé (getPointAtLength). */
function fly(key: string, line: Ref<SVGPathElement | null>, dot: Ref<SVGCircleElement | null>, glow: Ref<SVGCircleElement | null>, raf: Ref<number>) {
  cancelAnimationFrame(raf.current);
  const show = (o: number) => { dot.current?.setAttribute('opacity', String(o)); glow.current?.setAttribute('opacity', String(o * 0.18)); };
  const frame = (now: number) => {
    const f = flights.get(key), path = line.current;
    if (!f || !path) { show(0); return; }
    const t = (now - f.t0) / DUR;
    if (t >= 1) { show(0); flights.delete(key); return; }
    if (t >= 0) {
      const pt = path.getPointAtLength((1 - (1 - t) ** 3) * path.getTotalLength());
      for (const c of [dot.current, glow.current]) { c?.setAttribute('cx', String(pt.x)); c?.setAttribute('cy', String(pt.y)); }
      show(t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1);
    } else show(0);
    raf.current = requestAnimationFrame(frame);
  };
  raf.current = requestAnimationFrame(frame);
}

/** Décalage de phase stable par lien, pour que les comètes ne partent pas toutes ensemble. */
const phase = (k: string) => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 2800) / 1000; };

/**
 * Connecteur de la maquette : trait en dégradé corail → rose → violet, comète qui circule le long du trait
 * et anneau qui pulse à l'arrivée. `hot` accélère et illumine le lien, avec le halo flou à distorsion « chaleur »
 * (filtre coûteux : réservé aux liens survolés, un halo simple le remplace au repos).
 * `pulse` (clé) : chaque clé jamais jouée lance un point de 6 px qui parcourt le lien une seule fois, de la source à la cible
 * (enfant → parent), en 900 ms. L'impulsion lancée va au bout même si l'appelant remet `pulse` à 0 entre-temps. `hot` épaissit et éclaire le trait ; `dim` l'efface au second plan.
 * Le tracé initial (`drawn`) se dessine une fois à l'apparition.
 */
export function Connector({ d, x1, y1, x2, y2, hot = false, dim = false, drawn = true, delay = 0, pulse = 0, pulseDelay = 0, pid }: {
  d: string; x1: number; y1: number; x2: number; y2: number; hot?: boolean; dim?: boolean; drawn?: boolean; delay?: number; pulse?: number | string; pulseDelay?: number;
  /** Identifiant stable du lien (sinon local au composant) : sert à retrouver une impulsion en vol après remontage. */ pid?: string;
}) {
  const id = useId().replace(/:/g, '');
  const key = pid ?? id;
  const still = reducedMotion();
  const raf = useRef(0);
  const line = useRef<SVGPathElement>(null), dot = useRef<SVGCircleElement>(null), glow = useRef<SVGCircleElement>(null);

  // Nouvelle clé jamais jouée sur ce lien : on lance une impulsion.
  useEffect(() => {
    if (!pulse || still) return;
    const seen = played.get(key) ?? new Set(); played.set(key, seen);
    if (seen.has(pulse)) return;
    seen.add(pulse);
    flights.set(key, { key: pulse, t0: performance.now() + pulseDelay * 1000 });
    fly(key, line, dot, glow, raf);
  }, [pulse, pulseDelay, still, key]);
  // Montage (ou remontage) : reprend une impulsion en vol ; démontage : arrête l'affichage, pas l'impulsion.
  useEffect(() => {
    if (flights.has(key)) fly(key, line, dot, glow, raf);
    const r = raf;
    return () => cancelAnimationFrame(r.current);
  }, [key]);

  const dur = hot ? '1.1s' : '2.8s';
  const begin = `-${phase(key)}s`;

  return (
    <g style={{ opacity: dim ? 0.25 : 1, transition: 'opacity .3s ease-out' }}>
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor="var(--g0)" /><stop offset="0.5" stopColor="var(--g1)" /><stop offset="1" stopColor="var(--g2)" />
        </linearGradient>
        {!still && hot && <filter id={`h${id}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b" />
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.09" numOctaves="2" seed="4" result="n">
            <animate attributeName="baseFrequency" values="0.03 0.09;0.04 0.12;0.03 0.09" dur="4s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="b" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="h" />
          <feMerge><feMergeNode in="h" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>}
      </defs>
      <path d={d} fill="none" stroke={`url(#g${id})`} strokeWidth={hot ? 12 : 7} strokeLinecap="round" opacity={hot ? 0.3 : 0.1} style={{ transition: 'opacity .26s, stroke-width .26s' }} />
      <path ref={line} d={d} pathLength={1} fill="none" stroke={`url(#g${id})`} strokeWidth={hot ? 2.25 : 1.5} strokeLinecap="round" strokeDasharray="1" strokeDashoffset={drawn || still ? 0 : 1}
        style={{ transition: still ? 'none' : `stroke-dashoffset 520ms ease-out ${delay}ms, stroke-width .3s` }} />
      {!still && !dim && (
        <g style={{ opacity: drawn ? 1 : 0, transition: `opacity 400ms ease-out ${delay + 480}ms` }} pointerEvents="none">
          <path key={dur + 'a'} d={d} pathLength={1} fill="none" stroke={`url(#g${id})`} strokeWidth={hot ? 2.25 : 1.75} strokeLinecap="round" strokeDasharray="0.32 0.68" opacity={hot ? 0.45 : 0.25}>
            <animate attributeName="stroke-dashoffset" from="1.16" to="0.16" dur={dur} begin={begin} repeatCount="indefinite" />
          </path>
          {!hot && <path d={d} pathLength={1} fill="none" stroke={`url(#g${id})`} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.16 0.84" opacity={0.16}>
            <animate attributeName="stroke-dashoffset" from="1" to="0" dur={dur} begin={begin} repeatCount="indefinite" />
          </path>}
          <path key={dur + 'b'} d={d} pathLength={1} fill="none" stroke={`url(#g${id})`} strokeWidth={hot ? 3.25 : 2.5} strokeLinecap="round" strokeDasharray="0.16 0.84" opacity={hot ? 0.9 : 0.6} filter={hot ? `url(#h${id})` : undefined}>
            <animate attributeName="stroke-dashoffset" from="1" to="0" dur={dur} begin={begin} repeatCount="indefinite" />
          </path>
          <path key={dur + 'c'} d={d} pathLength={1} fill="none" stroke={`url(#g${id})`} strokeWidth={hot ? 4.5 : 3.5} strokeLinecap="round" strokeDasharray="0.025 0.975" filter={hot ? `url(#h${id})` : undefined}>
            <animate attributeName="stroke-dashoffset" from="-0.135" to="-1.135" dur={dur} begin={begin} repeatCount="indefinite" />
          </path>
          <circle key={dur + 'r'} cx={x2} cy={y2} r="4.5" fill="none" stroke="var(--g2)" strokeWidth="1.25">
            <animate attributeName="r" values="4.5;13" dur={dur} begin={begin} repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.7;0" dur={dur} begin={begin} repeatCount="indefinite" />
          </circle>
        </g>
      )}
      <circle cx={x1} cy={y1} r="3" fill="var(--g0)" />
      <circle cx={x2} cy={y2} r="3.5" fill="var(--g2)" />
      {!still && <>
        <circle ref={glow} r="7" fill="var(--g2)" opacity="0" pointerEvents="none" />
        <circle ref={dot} className="pulse-dot" r="3" fill="var(--g2)" opacity="0" pointerEvents="none" />
      </>}
    </g>
  );
}

export const curve = (x1: number, y1: number, x2: number, y2: number, vertical = false) =>
  vertical ? `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}` : `M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
