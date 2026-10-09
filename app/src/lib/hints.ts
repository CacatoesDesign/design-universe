/** Indications d'usage : montrées une seule fois par navigateur, puis plus jamais. */
const KEY = 'ds-hints-seen';
const read = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; // valeur corrompue ou ancien format : ignorée
  } catch { return []; }
};
export const hintSeen = (id: string) => read().includes(id);
export const markHint = (id: string) => {
  const seen = read(); if (seen.includes(id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...seen, id])); } catch { /* stockage indisponible */ }
};

/** Accueil : une fois par navigateur. Les navigateurs pilotés (tests e2e) ne le voient pas, sauf avec ?welcome dans l'URL. */
export const shouldWelcome = () => {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('welcome')) return true;
  return !navigator.webdriver && !hintSeen('welcome');
};
