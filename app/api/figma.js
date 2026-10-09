// Fonction Vercel : relais /figma-api/* → api.figma.com pour les aperçus PNG d'un déploiement (équivalent du proxy Vite).
// Seul le token envoyé par le navigateur (bouton Figma de l'app) est relayé : un déploiement public ne prête jamais
// le token de son auteur. Seules les deux routes utilisées par l'app passent.
const ALLOWED = [/^v1\/me$/, /^v1\/images\/[A-Za-z0-9]+$/];

export default async function handler(req, res) {
  const path = [].concat(req.query.path ?? []).join('/');
  if (req.method !== 'GET' || !ALLOWED.some(r => r.test(path))) return res.status(404).json({ err: 'Not found' });
  const token = req.headers['x-figma-token'];
  if (!token || Array.isArray(token)) return res.status(403).json({ err: 'Add a Figma token with the Figma button in the app.' });
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) if (k !== 'path') for (const x of [].concat(v)) q.append(k, x);
  const r = await fetch(`https://api.figma.com/${path}${q.size ? `?${q}` : ''}`, { headers: { 'X-Figma-Token': token } });
  res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') ?? 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(await r.text());
}
