/** Rail de profondeur : les 4 niveaux de l'Explorer, du plus large (Library) au plus fin (Component). */
const NAMES = ['Component', 'Pattern', 'Usage', 'Library'] as const;
const ORDER = [3, 2, 1, 0];
const STEP = 52; // px entre deux crans

export function DepthRail({ level, counts, disabled, onGo }: { level: number; counts: string[]; disabled: (l: number) => boolean; onGo: (l: number) => void }) {
  const at = ORDER.indexOf(level);
  return (
    <nav className="depth-rail" aria-label="Exploration levels" onClick={e => e.stopPropagation()}>
      <span className="dr-line" aria-hidden="true" />
      <span className="dr-knob" aria-hidden="true" style={{ transform: `translateY(${at * STEP}px)` }} />
      {ORDER.map(l => (
        <button key={l} className="dr-step" aria-current={l === level ? 'step' : undefined} disabled={disabled(l)} onClick={() => onGo(l)} title={`${NAMES[l]} (↑ ↓)`}>
          <span className="dr-dot" aria-hidden="true" />
          <span className="dr-txt"><span className="dr-name">{NAMES[l]}</span><span className="dr-ct">{counts[l]}</span></span>
        </button>
      ))}
    </nav>
  );
}
