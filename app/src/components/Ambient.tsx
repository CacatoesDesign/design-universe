import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../lib/camera';
import { onAmbientParallax, onAmbientTarget, type AmbientTarget } from '../lib/ambient';

/**
 * Lumière « Ambient », posée sur l'Aurora (qui porte le fond et le grain) : UNE lumière chaude qui glisse vers ce qu'on regarde
 * (zone sélectionnée, node survolé) en 2,4 s. Au repos elle dérive de ±30 px ; une parallaxe de 4 px au plus suit
 * le déplacement du canvas. Mouvement réduit : lumière fixe.
 */
export function Ambient({ depth, dark }: { depth: number; dark: boolean }) {
  const box = useRef<HTMLDivElement>(null), glow = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<AmbientTarget>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [para, setPara] = useState({ dx: 0, dy: 0 });

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => onAmbientTarget(t => {
    const r = box.current?.getBoundingClientRect();
    setTarget(t && r ? { x: t.x - r.left, y: t.y - r.top } : null);
  }), []);
  useEffect(() => onAmbientParallax(({ dx, dy }) => setPara({ dx: Math.max(-4, Math.min(4, dx)), dy: Math.max(-4, Math.min(4, dy)) })), []);
  // Dérive lente, seulement au repos : dès qu'une cible existe, la lumière se pose dessus (seule animation continue de l'Explorer).
  const atRest = target === null;
  useEffect(() => {
    if (!atRest || reducedMotion() || !glow.current) return;
    const a = glow.current.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(-30px, 12px)', offset: 0.25 }, { transform: 'translate(30px, -14px)', offset: 0.75 }, { transform: 'translate(0, 0)' }], { duration: 28000, iterations: Infinity, easing: 'ease-in-out' });
    return () => a.cancel();
  }, [atRest]);

  const R = (dark ? 520 : 420) * (1 - Math.min(depth, 3) * 0.06); // un peu plus serrée en profondeur
  const t = target ?? { x: size.w * 0.58, y: size.h * 0.44 };
  return (
    <div ref={box} className="ambient" aria-hidden="true">
      <div className="amb-para" style={{ transform: `translate(${-para.dx}px, ${-para.dy}px)` }}>
        <div className="amb-halo" style={{ width: R * 2, height: R * 2, transform: `translate(${t.x - R}px, ${t.y - R}px)` }}>
          <div ref={glow} className="amb-glow" />
        </div>
      </div>
    </div>
  );
}
