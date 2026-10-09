import { panelShortcut, usePanelMode } from '../lib/panelMode';

/** Bouton d'en-tête de panneau : détacher (flottant) ou ancrer. */
export function PanelModeButton() {
  const { mode, toggle } = usePanelMode();
  const floating = mode === 'floating';
  const label = `${floating ? 'Dock panel' : 'Undock panel'} (${panelShortcut})`;
  return (
    <button className="x-btn ghost" onClick={toggle} aria-label={label} title={label} aria-pressed={floating}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        {floating
          ? <><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M10 2.5v11" /></>
          : <><rect x="2" y="2.5" width="12" height="11" rx="2" strokeOpacity=".45" /><rect x="8.5" y="4.5" width="4" height="7" rx="1.2" /></>}
      </svg>
    </button>
  );
}
