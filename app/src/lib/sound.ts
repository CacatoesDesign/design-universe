/**
 * Son de l'Explorer (Web Audio) : musique de fond en 4 parties, une par niveau, et sons d'interface.
 * Coupé par défaut ; le choix est gardé dans le navigateur. Fichiers dans public/audio (voir README).
 */
import { useSyncExternalStore } from 'react';

// Musique attendue : 76 BPM, 4 temps, mesures comptées depuis le premier temps. À adapter à vos fichiers (voir public/audio/README.md).
const BEAT = 60 / 76, BAR = 4 * BEAT;
const LEAD = 0.2;   // chaque extrait commence 0,2 s avant sa première mesure
const XF = 0.03;    // fondu à chaque tour de boucle : la jonction brute claque
const FADE_IN = 2 * BEAT, FADE_OUT = BAR; // changement de niveau

type Part = { file: string; first: number; entry: number; loop: [number, number] };
// Index = niveau de l'Explorer (0 Component … 3 Library) : plus on plonge, plus la musique se densifie.
const PARTS: Part[] = [
  { file: 'music-d.mp3', first: 40, entry: 40, loop: [48, 64] }, // Component : sommet, charleston et percussions
  { file: 'music-c.mp3', first: 24, entry: 24, loop: [28, 36] }, // Pattern : groove complet
  { file: 'music-b.mp3', first: 12, entry: 12, loop: [16, 24] }, // Usage : la basse entre
  { file: 'music-a.mp3', first: 0, entry: 4, loop: [4, 12] },    // Library : nappe seule (mesure 0 au tout premier lancement)
];
const pos = (p: Part, bar: number) => LEAD + (bar - p.first) * BAR; // secondes dans l'extrait

export type Sfx = 'select' | 'pick' | 'open' | 'close' | 'dive' | 'rise' | 'option' | 'tick' | 'grab' | 'drop' | 'link' | 'save';
const SFX_FILE: Record<Sfx, string> = {
  select: 'sfx-select.wav', pick: 'sfx-pick.wav', open: 'sfx-open.wav', close: 'sfx-close.wav', dive: 'sfx-pick.wav', rise: 'sfx-pick.wav',
  option: 'sfx-option.wav', // zone choisie au clavier ou dans le menu
  tick: 'sfx-tick.wav',     // onglets, Light / Dark, modes
  grab: 'sfx-grab.wav', drop: 'sfx-drop.wav', // Builder : les deux pops de « Glass UI Pops »
  link: 'sfx-link.wav',     // Builder : lien entre deux nodes
  save: 'sfx-save.wav',     // Builder : pattern enregistré
};
const SFX_RATE: Partial<Record<Sfx, number>> = { dive: 1.19, rise: 0.84 }; // une tierce au-dessus en plongeant, en dessous en remontant
const MUSIC_GAIN = 0.32, SFX_GAIN = 0.55;

const url = (f: string) => `${import.meta.env.BASE_URL}audio/${f}`;
const KEY = 'ds-sound';
const read = () => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };

let on = read();
let ctx: AudioContext | null = null, master: GainNode, music: GainNode, fx: GainNode;
let level = 0, started = false, seq = 0;
const listeners = new Set<() => void>();
const files = new Map<string, Promise<ArrayBuffer>>();
const decoded = new Map<string, AudioBuffer>();
const lastPlay = new Map<Sfx, number>();

const fetchFile = (f: string) => {
  let p = files.get(f);
  if (!p) { p = fetch(url(f)).then(r => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.arrayBuffer(); }); files.set(f, p); p.catch(() => files.delete(f)); }
  return p;
};
async function buffer(f: string) {
  const hit = decoded.get(f); if (hit) return hit;
  const b = await ctx!.decodeAudioData((await fetchFile(f)).slice(0)); // décodage détache le tampon : on garde l'original
  decoded.set(f, b);
  return b;
}

/** Une partie qui boucle sur ses mesures, chaque tour étant une nouvelle source fondue sur 30 ms. */
class Voice {
  readonly part: Part; readonly buf: AudioBuffer; readonly out: GainNode;
  srcs = new Set<AudioBufferSourceNode>(); timer = 0; when = 0; off = 0;
  constructor(part: Part, buf: AudioBuffer) { this.part = part; this.buf = buf; this.out = ctx!.createGain(); this.out.connect(music); }
  start(when: number, off: number) { this.when = when; this.off = off; this.segment(when, off, false); }
  private segment(when: number, off: number, fadeIn: boolean) {
    const c = ctx!, [ls, le] = this.part.loop.map(b => pos(this.part, b)), dur = le - off;
    const g = c.createGain(), s = c.createBufferSource();
    s.buffer = this.buf; s.connect(g); g.connect(this.out);
    g.gain.setValueAtTime(fadeIn ? 0 : 1, when);
    if (fadeIn) g.gain.linearRampToValueAtTime(1, when + XF);
    g.gain.setValueAtTime(1, when + dur);
    g.gain.linearRampToValueAtTime(0, when + dur + XF);
    s.start(when, off); s.stop(when + dur + XF + 0.01);
    this.srcs.add(s); s.onended = () => this.srcs.delete(s);
    // Programme le tour suivant un peu avant la fin de celui-ci.
    this.timer = window.setTimeout(() => this.segment(when + dur, ls, true), Math.max(0, (when + dur - c.currentTime - 1.5) * 1000));
  }
  /** Position musicale en temps depuis la première mesure de l'extrait (boucle comprise). */
  beats(t: number) {
    const [ls, le] = this.part.loop.map(b => pos(this.part, b));
    let p = this.off + Math.max(0, t - this.when);
    if (p >= le) p = ls + ((p - ls) % (le - ls));
    return (p - LEAD) / BEAT;
  }
  stop(at: number, fade: number) {
    clearTimeout(this.timer);
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setTargetAtTime(0, at, fade / 4);
    for (const s of this.srcs) s.stop(at + fade + 0.05);
    window.setTimeout(() => this.out.disconnect(), (at + fade + 0.2 - ctx!.currentTime) * 1000);
  }
}
let voice: Voice | null = null;

/** Passe à la partie du niveau courant : départ sur le temps suivant, à la même place dans la mesure, puis fondu croisé. */
async function playLevel() {
  const n = ++seq, part = PARTS[level];
  if (voice?.part === part) return;
  let buf: AudioBuffer;
  try { buf = await buffer(part.file); } catch { return; }
  if (n !== seq || !on || !ctx || voice?.part === part) return;
  const now = ctx.currentTime + 0.06;
  let when = now, off = pos(part, started || part !== PARTS[3] ? part.entry : 0);
  if (voice) {
    const b = voice.beats(now), next = Math.ceil(b + 0.01);
    when = now + (next - b) * BEAT;
    off = pos(part, part.entry) + (next % 4) * BEAT;
    voice.stop(when, FADE_OUT);
  }
  const v = new Voice(part, buf);
  v.out.gain.setValueAtTime(0, when);
  v.out.gain.linearRampToValueAtTime(1, when + (voice || started ? FADE_IN : 2.5));
  v.start(when, off);
  voice = v; started = true;
  // Libère les parties décodées qui ne jouent plus (une partie décodée pèse 15 à 30 Mo).
  for (const f of decoded.keys()) if (f !== part.file && !f.startsWith('sfx')) window.setTimeout(() => { if (voice?.part.file !== f) decoded.delete(f); }, (FADE_OUT + 1) * 1000);
  document.documentElement.dataset.music = part.file;
}

function ensureCtx() {
  if (ctx) return ctx;
  ctx = new AudioContext({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  music = ctx.createGain(); music.gain.value = MUSIC_GAIN; music.connect(master);
  fx = ctx.createGain(); fx.gain.value = SFX_GAIN; fx.connect(master);
  return ctx;
}

async function wake() {
  if (!on) return;
  const c = ensureCtx();
  try { await c.resume(); } catch { return; }
  if (!on || c.state !== 'running') return;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(1, c.currentTime, 0.08);
  for (const f of new Set(Object.values(SFX_FILE))) void buffer(f).catch(() => undefined);
  void playLevel();
}

function sleep(stopMusic: boolean) {
  if (!ctx) return;
  const c = ctx;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(0, c.currentTime, 0.12);
  window.setTimeout(() => {
    if (on && !document.hidden) return;
    if (stopMusic && voice) { voice.stop(c.currentTime, 0.05); voice = null; seq++; delete document.documentElement.dataset.music; }
    void c.suspend();
  }, 700);
}

const emit = () => { document.documentElement.dataset.sound = on ? 'on' : 'off'; listeners.forEach(l => l()); };

export function setSound(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* indisponible */ }
  emit();
  if (v) void wake(); else sleep(true);
}

/** Niveau de l'Explorer (0 Component … 3 Library) : la musique suit. */
export function setMusicLevel(l: number) {
  level = Math.max(0, Math.min(3, l));
  if (on && ctx?.state === 'running') void playLevel();
}

export function sfx(name: Sfx) {
  if (!on || !ctx || ctx.state !== 'running') return;
  const b = decoded.get(SFX_FILE[name]); if (!b) return;
  const t = performance.now();
  if (t - (lastPlay.get(name) ?? 0) < 45) return; // touche maintenue, double déclenchement
  lastPlay.set(name, t);
  const s = ctx.createBufferSource();
  s.buffer = b; s.playbackRate.value = SFX_RATE[name] ?? 1;
  s.detune.value = (Math.random() * 2 - 1) * 25; // jamais deux fois exactement le même son
  s.connect(fx); s.start();
}

// Fichiers audio absents (dépôt public : les sons ne sont pas redistribuables) : pas de bouton Sound.
let avail: boolean | null = null;
const availListeners = new Set<() => void>();
const probe = () => {
  if (avail !== null || typeof fetch === 'undefined') return;
  avail = false;
  fetch(url(SFX_FILE.select), { method: 'HEAD' })
    .then(r => { avail = r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/'); })
    .catch(() => { avail = false; })
    .finally(() => availListeners.forEach(l => l()));
};
export const useSoundAvailable = () => useSyncExternalStore(l => { probe(); availListeners.add(l); return () => availListeners.delete(l); }, () => !!avail);

export const useSound = () => useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => on);

// Son activé lors d'une visite précédente : le navigateur exige un geste avant de jouer.
if (typeof window !== 'undefined') {
  document.documentElement.dataset.sound = on ? 'on' : 'off';
  const gesture = () => { if (on && ctx?.state !== 'running') void wake(); };
  window.addEventListener('pointerdown', gesture, true);
  window.addEventListener('keydown', gesture, true);
  document.addEventListener('visibilitychange', () => { if (!on) return; if (document.hidden) sleep(false); else void wake(); });
}
