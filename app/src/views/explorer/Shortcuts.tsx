import { useEffect, useRef, useState } from 'react';
import { panelShortcut } from '../../lib/panelMode';

const ROWS: [string[], string][] = [
  [['←', '→'], 'previous / next zone'],
  [['↑', '↓'], 'level up / down'],
  [['scroll'], 'change level'],
  [['pinch', '+', '−'], 'zoom'],
  [['0'], 'fit to screen'],
  [['1'], 'zoom 100%'],
  [['Esc'], 'close / deselect'],
  [[panelShortcut], 'docked / floating panels'],
  [['?'], 'show this help'],
];

/** Raccourcis : rangés derrière « ? » (bouton ou touche ?) au lieu d'occuper l'écran. */
export function Shortcuts() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      if (e.key === '?') { e.preventDefault(); setOpen(o => !o); }
    };
    const close = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey); window.addEventListener('pointerdown', close);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', close); };
  }, []);
  // Aide ouverte : Échap la ferme et s'arrête là (phase de capture), sans fermer le panneau ni désélectionner.
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [open]);
  return (
    <div className="shortcuts-box" ref={box}>
      <button className="help-btn" aria-expanded={open} aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)" onClick={() => setOpen(!open)}>?</button>
      {open && (
        <div className="sc-pop" role="dialog" aria-label="Keyboard shortcuts">
          {ROWS.map(([keys, label]) => (
            <div key={label} className="sc-row"><span className="keys">{keys.map(k => <span key={k} className="kbd">{k}</span>)}</span><span>{label}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
