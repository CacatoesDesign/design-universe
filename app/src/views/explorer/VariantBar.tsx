import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Icône par axe connu (nom d'axe Figma, insensible à la casse). Axe inconnu : son initiale.
const AXIS_ICON: Record<string, string> = {
  variant: 'M5 8.5a3.5 3.5 0 1 0 0-.01M11 8.5a3.5 3.5 0 1 0 0-.01',
  type: 'M5 8.5a3.5 3.5 0 1 0 0-.01M11 8.5a3.5 3.5 0 1 0 0-.01',
  state: 'M4 3l8 4.2-3.4.9 2.2 3.8-1.4.8-2.2-3.8L4.7 11z',
  size: 'M3 6V3h3M13 10v3h-3M3 3l4 4M13 13l-4-4',
};
// Valeurs de taille abrégées ; le nom complet reste dans l'infobulle et le libellé accessible.
const SHORT: Record<string, string> = { xsmall: 'XS', 'extra small': 'XS', small: 'S', medium: 'M', large: 'L', xlarge: 'XL', 'extra large': 'XL' };

function AxisIcon({ name }: { name: string }) {
  const d = AXIS_ICON[name.toLowerCase()];
  return (
    <span className="axis-ic" title={name} aria-hidden>
      {d ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg> : name[0]}
    </span>
  );
}

/** Un axe de variantes. Replié : icône + valeur courante. Déplié : icône + segments, curseur qui glisse vers la valeur choisie. */
function Axis({ name, values, current, isOk, onPick, open, onToggle }: {
  name: string; values: string[]; current: string; isOk: (v: string) => boolean; onPick: (v: string) => void; open: boolean; onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) { setThumb(null); return; }
    const place = () => { const b = el.querySelector<HTMLElement>('button[aria-pressed="true"]'); if (b) setThumb({ x: b.offsetLeft, w: b.offsetWidth }); };
    place();
    const ro = new ResizeObserver(place); // re-mesure au chargement des polices
    ro.observe(el); return () => ro.disconnect();
  }, [current, values, open]);
  const label = SHORT[current?.toLowerCase()] ?? current;
  return (
    <div className="axis" role="group" aria-label={name} data-open={open}>
      <button className="axis-toggle" aria-expanded={open} title={open ? `Close ${name}` : `${name}: ${current}`} onClick={onToggle}>
        <AxisIcon name={name} />
        {!open && <span className="axis-val">{label}</span>}
      </button>
      {open && (
        <div className="vseg" ref={ref}>
          {thumb && <span className="thumb" style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }} />}
          {values.map(v => {
            const short = SHORT[v.toLowerCase()];
            return <button key={v} title={`${name}: ${v}`} aria-label={short ? v : undefined} aria-pressed={current === v} disabled={!isOk(v)} onClick={() => onPick(v)}>{short ?? v}</button>;
          })}
        </div>
      )}
    </div>
  );
}

/** Barre des variantes, repliée par défaut (icône + valeur par axe) ; un clic sur une icône déplie cet axe seul. */
export function VariantBar({ axes, current, isOk, onPick, collapse = false }: {
  axes: Record<string, string[]>; current: Record<string, string>;
  isOk: (axis: string, v: string) => boolean; onPick: (axis: string, v: string) => void;
  /** Panneau Properties ouvert : la barre se replie. */ collapse?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [wasCollapsed, setWasCollapsed] = useState(collapse);
  if (collapse !== wasCollapsed) { setWasCollapsed(collapse); if (collapse) setOpen(null); }
  const bar = useRef<HTMLDivElement>(null);
  // Clic hors de la barre ou Échap : tout se replie.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(null); };
    // En capture et sans propagation : Échap ferme la barre seule, sans désélectionner la zone (raccourci global d'Explorer).
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(null); } };
    document.addEventListener('pointerdown', down, true); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true); };
  }, [open]);
  return (
    <div ref={bar} className="variant-bar inline" data-open={!!open}>
      {Object.entries(axes).map(([k, vals]) => <Axis key={k} name={k} values={vals} current={current[k]} open={open === k}
        onToggle={() => setOpen(open === k ? null : k)} isOk={v => isOk(k, v)} onPick={v => onPick(k, v)} />)}
    </div>
  );
}
