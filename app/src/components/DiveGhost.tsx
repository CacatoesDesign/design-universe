import { useEffect, useRef } from 'react';

export type Dive = { from: { x: number; y: number; w: number; h: number }; label: string; dir: 'in' | 'out'; k: number };

/**
 * « Fantôme » de plongée : la carte cliquée grandit jusqu'au cadre du niveau suivant (dir 'in'),
 * ou le cadre se replie vers la carte d'origine au retour (dir 'out'). 640 ms, même courbe que la transition .level ; il s'efface quand le niveau
 * cible apparaît. Coordonnées relatives à la scène.
 */
export function DiveGhost({ dive, stage, onDone }: { dive: Dive; stage: { w: number; h: number }; onDone: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current; if (!node) return;
    const f = dive.from;
    const to = { x: stage.w * 0.22, y: stage.h * 0.28, w: stage.w * 0.56, h: stage.h * 0.44 };
    const box = (r: typeof f, radius: number, opacity: number) => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: `${radius}px`, opacity });
    const frames = dive.dir === 'in'
      ? [box(f, 14, 1), { ...box(to, 8, 1), offset: 0.55 }, { ...box(to, 6, 1), offset: 0.75 }, box(to, 6, 0)]
      : [box(to, 6, 0), { ...box(to, 8, 1), offset: 0.25 }, box(f, 14, 0)];
    const a = node.animate(frames, { duration: 640, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    a.onfinish = onDone;
    return () => a.cancel();
  }, [dive, stage, onDone]);
  return <div ref={el} className="dive-ghost" aria-hidden="true"><span>{dive.label}</span></div>;
}
