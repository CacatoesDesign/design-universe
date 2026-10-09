import { useEffect, useRef } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';

interface Controls { pct: number; onIn: () => void; onOut: () => void; onReset: () => void; onFit: () => void }

/**
 * Barre de zoom accessible : boutons libellés (aria-label + title),
 * niveau de zoom annoncé, et raccourcis clavier + / − / 0 (ajuster) / 1 (100 %).
 * `enabled` coupe les raccourcis quand la vue n'est pas active.
 */
export function ZoomControls({ pct, onIn, onOut, onReset, onFit, position = 'bottom-left', enabled = true }: Controls & { position?: 'bottom-left' | 'bottom-right' | 'inline'; enabled?: boolean }) {
  // Handlers lus via une ref : le listener clavier n'est pas réabonné à chaque rendu.
  const h = useRef({ onIn, onOut, onReset, onFit });
  useEffect(() => { h.current = { onIn, onOut, onReset, onFit }; });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      if (e.altKey) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); h.current.onIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); h.current.onOut(); }
      else if (e.key === '0' && !mod) { e.preventDefault(); h.current.onFit(); }
      else if (e.key === '1' && !mod) { e.preventDefault(); h.current.onReset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  return (
    <div className={`zoombar ${position}`} role="toolbar" aria-label="Canvas zoom" onClick={e => e.stopPropagation()}>
      <button onClick={onOut} aria-label="Zoom out (− key)" title="Zoom out (−)">−</button>
      <button className="pct" onClick={onReset} aria-label={`Zoom ${pct}%, reset to 100% (1 key)`} title="Reset to 100% (1)">
        <span aria-live="polite">{pct}%</span>
      </button>
      <button onClick={onIn} aria-label="Zoom in (+ key)" title="Zoom in (+)">+</button>
      <span className="sep" aria-hidden="true" />
      <button className="fit" onClick={onFit} aria-label="Fit to screen (0 key)" title="Fit to screen (0)">Fit</button>
    </div>
  );
}

/** Variante pour les canvas React Flow. */
export function ZoomBar({ position = 'bottom-left' }: { position?: 'bottom-left' | 'bottom-right' }) {
  const rf = useReactFlow();
  const { zoom } = useViewport();
  return (
    <ZoomControls position={position} pct={Math.round(zoom * 100)}
      onIn={() => rf.zoomIn({ duration: 180 })} onOut={() => rf.zoomOut({ duration: 180 })}
      onReset={() => rf.zoomTo(1, { duration: 200 })} onFit={() => rf.fitView({ padding: 0.15, duration: 250 })} />
  );
}
