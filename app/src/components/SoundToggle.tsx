import { setSound, useSound, useSoundAvailable } from '../lib/sound';

/** Musique et sons d'interface : coupés par défaut, le choix reste dans le navigateur. */
export function SoundToggle() {
  const on = useSound();
  if (!useSoundAvailable()) return null;
  return (
    <button className="pill-btn sound-btn" aria-pressed={on} onClick={() => setSound(!on)} title={on ? 'Mute music and sounds' : 'Play music and sounds'}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
        {on ? <><path className="wave" d="M10.6 5.8a3 3 0 0 1 0 4.4" /><path className="wave w2" d="M12.4 4a5.5 5.5 0 0 1 0 8" /></> : <path d="M11 6l3.5 4M14.5 6L11 10" />}
      </svg>
      Sound
    </button>
  );
}
