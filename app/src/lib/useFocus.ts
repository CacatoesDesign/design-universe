import { useCallback, useEffect, useRef, useState } from 'react';

/** Clés d'impulsion uniques pour toute la session (les liens retiennent les clés déjà jouées). */
let seq = 0;
export const nextPulse = () => ++seq;

/**
 * Focus de survol pour les graphes : `enter(id)` focalise tout de suite, `leave()` relâche après un court délai
 * (passer d'un node à l'autre ne repasse pas par « rien »). `pulse` s'incrémente à chaque nouveau focus :
 * c'est la clé qui déclenche l'impulsion unique sur les liens concernés.
 */
export function useFocus(delay = 160) {
  const [focus, setFocus] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const cur = useRef<string | null>(null);
  const enter = useCallback((id: string) => {
    clearTimeout(timer.current);
    if (cur.current === id) return;
    cur.current = id; setFocus(id); setPulse(nextPulse());
  }, []);
  const leave = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { cur.current = null; setFocus(null); }, delay);
  }, [delay]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { focus, pulse, enter, leave };
}
