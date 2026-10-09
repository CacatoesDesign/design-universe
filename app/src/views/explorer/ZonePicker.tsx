import { useEffect, useRef, useState } from 'react';
import type { Zone } from '../../lib/library';

/**
 * Sélecteur compact de zone, dans la barre du haut : remplace la barre des zones du bas. ← → restent actifs.
 * Ouvert, il garde le clavier pour lui (capture) : ↑ ↓ Début Fin parcourent les zones, Entrée choisit,
 * Échap ferme ; le focus revient au bouton. L'Explorer ne voit pas ces touches tant que le menu est ouvert.
 */
export function ZonePicker({ zones, sel, onSelect, mismatch }: { zones: Zone[]; sel: string | null; onSelect: (k: string) => void; mismatch: (z: Zone) => string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null);
  const i = zones.findIndex(z => z.key === sel);
  const cur = i >= 0 ? zones[i] : null;
  const warns = zones.filter(z => mismatch(z)).length;
  const curWarn = cur ? mismatch(cur) : null;

  const close = (refocus: boolean) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const pick = (k: string) => { onSelect(k); close(true); };

  useEffect(() => {
    if (!open) return;
    const items = () => [...(pop.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    (items()[Math.max(0, i)] ?? items()[0])?.focus();
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const keys = (e: KeyboardEvent) => {
      const list = items(); const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const go = (n: number) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
      if (e.key === 'ArrowDown') go(at + 1);
      else if (e.key === 'ArrowUp') go(at - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(list.length - 1);
      else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
      else if (e.key === 'Tab') setOpen(false);
      else return; // Entrée / Espace : le bouton focalisé gère le clic
      e.stopPropagation(); // ni changement de niveau, ni fermeture du panneau
    };
    window.addEventListener('pointerdown', outside); window.addEventListener('keydown', keys, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', keys, true); };
  }, [open, i]);

  return (
    <div className="zone-picker" ref={box}>
      <button ref={trigger} className="zp-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={curWarn ?? 'Component zones (← →)'}>
        {cur ? <><span className="ix">{String(i + 1).padStart(2, '0')}</span>{cur.label}</> : <>{zones.length} zones</>}
        {(cur ? !!curWarn : warns > 0) && <span className="warn" aria-label={cur ? 'mismatch on this zone' : `${warns} mismatch(es)`} />}
        <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="zp-pop" role="menu" ref={pop} aria-label="Component zones">
          {zones.map((z, n) => (
            <button key={z.key} role="menuitemradio" aria-checked={z.key === sel} tabIndex={-1} onClick={() => pick(z.key)} title={mismatch(z) ?? z.figmaProp}>
              <span className="ix">{String(n + 1).padStart(2, '0')}</span>
              <span className="nm">{z.label}</span>
              {mismatch(z) && <span className="warn" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
