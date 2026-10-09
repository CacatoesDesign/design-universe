import { createContext, useContext } from 'react';

/**
 * Aperçus live via l'API REST Figma (GET /v1/images/:file_key), appelée depuis le navigateur.
 * En dev et en preview, les requêtes passent par le proxy Vite (/figma-api), même origine : pas de souci CORS.
 * Token : celui du fichier .env (FIGMA_TOKEN, ajouté par le proxy côté serveur) ou, à défaut, un token saisi
 * dans l'app (localStorage du navigateur). Dans les deux cas il n'est envoyé qu'à Figma.
 */
const BASE = '/figma-api';
const TOKEN_KEY = 'ds-graph-figma-token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* stockage indisponible */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* stockage indisponible */ } },
};

export class FigmaApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

async function call(path: string, token: string) {
  let res: Response;
  try {
    // Sans token navigateur, le proxy Vite ajoute celui du .env (FIGMA_TOKEN).
    res = await fetch(BASE + path, { headers: token ? { 'X-Figma-Token': token } : {} });
  } catch {
    throw new FigmaApiError("Can't reach Figma: the /figma-api relay is missing (it exists in `npm run dev`, `npm run preview` and on Vercel via api/figma.js).");
  }
  if (res.status === 403) throw new FigmaApiError('Token rejected by Figma (invalid, expired, or no access to this file).', 403);
  if (res.status === 404) throw new FigmaApiError('File not found with this token.', 404);
  if (res.status === 429) throw new FigmaApiError('Figma rate limit reached, try again in a minute.', 429);
  if (!res.ok) throw new FigmaApiError(`Figma error ${res.status}.`, res.status);
  return res.json();
}

/** Vérifie le token et retourne le nom de l'utilisateur Figma (GET /v1/me). */
export async function whoAmI(token: string): Promise<string> {
  const me = await call('/v1/me', token);
  return me.handle ?? me.email ?? 'Figma account';
}

/** URLs PNG rendues par Figma pour une liste de nodes, par lots pour limiter la taille des requêtes. */
export async function fetchImages(fileKey: string, ids: string[], scale: number, token: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const q = new URLSearchParams({ ids: batch.join(','), format: 'png', scale: String(scale) });
    const r = await call(`/v1/images/${fileKey}?${q}`, token);
    if (r.err) throw new FigmaApiError(`Figma: ${r.err}`);
    for (const [id, url] of Object.entries(r.images ?? {})) if (typeof url === 'string') out[id] = url;
  }
  return out;
}

export interface Previews { urls: Record<string, string>; status: 'off' | 'loading' | 'on' | 'error'; message: string }
export const PreviewsContext = createContext<Previews>({ urls: {}, status: 'off', message: '' });
export const usePreviews = () => useContext(PreviewsContext);
