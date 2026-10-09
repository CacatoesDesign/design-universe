import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { buildIndexes, libId } from './lib/library';
import type { Library, Modes } from './lib/types';
import { Explorer } from './views/explorer/Explorer';
import { FigmaConnect } from './components/FigmaConnect';
import { SoundToggle } from './components/SoundToggle';
import { Welcome } from './components/Welcome';
import { shouldWelcome } from './lib/hints';
import { sfx } from './lib/sound';
import { PanelModeContext, panelShortcut, type PanelMode } from './lib/panelMode';
import { fetchImages, FigmaApiError, PreviewsContext, tokenStore, whoAmI, type Previews } from './lib/figmaApi';

// Builder et Tokens chargés à la demande : l'Explorer (onglet d'ouverture) n'attend pas leur code.
const Builder = lazy(() => import('./views/builder/Builder').then(m => ({ default: m.Builder })));
const TokensView = lazy(() => import('./views/TokensView').then(m => ({ default: m.TokensView })));

type Tab = 'explorer' | 'builder' | 'tokens';
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } } };

export default function App({ initial }: { initial: Library }) {
  const [lib, setLib] = useState<Library>(initial);
  const [tab, setTab] = useState<Tab>((store.get('ds-tab') as Tab) || 'explorer');
  const [dark, setDark] = useState(store.get('ds-theme') === 'dark');
  const [modes, setModes] = useState<Modes>({});
  const [openId, setOpenId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const idx = useMemo(() => buildIndexes(lib), [lib]);
  const [token, setToken] = useState(tokenStore.get());
  const [figUser, setFigUser] = useState('');
  const [previews, setPreviews] = useState<Previews>({ urls: {}, status: 'off', message: '' });
  const [envToken, setEnvToken] = useState(false);
  const [panels, setPanels] = useState<PanelMode>(store.get('ds-panels') === 'floating' ? 'floating' : 'docked');
  const [toast, setToast] = useState<{ text: string; k: number } | null>(null);
  const [welcome, setWelcome] = useState(shouldWelcome);
  const togglePanels = useCallback(() => {
    const next = panels === 'floating' ? 'docked' : 'floating';
    setPanels(next);
    setToast({ text: next === 'floating' ? 'Floating panels' : 'Docked panels', k: Date.now() });
  }, [panels]);
  const panelCtx = useMemo(() => ({ mode: panels, toggle: togglePanels }), [panels, togglePanels]);
  useEffect(() => { document.documentElement.dataset.panels = panels; store.set('ds-panels', panels); }, [panels]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);
  // ⇧⌘L (⇧Ctrl L) : ancrer / détacher les panneaux, partout dans l'app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') { e.preventDefault(); togglePanels(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePanels]);

  // Aperçus live : écrans d'usage (réduits) + composants sans arbre de rendu, rendus par l'API Figma.
  const req = useRef(0);
  const loadPreviews = useCallback(async (tk: string) => {
    const n = ++req.current; // seule la dernière requête met à jour l'état
    setPreviews({ urls: {}, status: 'loading', message: '' }); // pas de réutilisation d'URLs d'un autre fichier
    try {
      let who: string;
      try {
        who = await whoAmI(tk); // sans token navigateur : celui du .env, ajouté par le proxy Vite
      } catch (e) {
        if (!tk && e instanceof FigmaApiError) { if (n === req.current) { setEnvToken(false); setPreviews({ urls: {}, status: 'off', message: '' }); } return; }
        throw e;
      }
      if (n === req.current) setEnvToken(!tk);
      if (n !== req.current) return;
      setFigUser(who);
      if (!lib.file.key) { if (n === req.current) setPreviews({ urls: {}, status: 'off', message: '' }); return; } // scan sans clé de fichier : pas d'aperçus
      const screens = lib.screens.map(s => s.id);
      const comps = Object.values(lib.components).filter(c => !c.variants.length).map(c => c.id);
      const urls = { ...(await fetchImages(lib.file.key, screens, 0.5, tk)), ...(await fetchImages(lib.file.key, comps, 1, tk)) };
      if (n === req.current) setPreviews({ urls, status: 'on', message: '' });
    } catch (e) {
      if (n === req.current) setPreviews({ urls: {}, status: 'error', message: e instanceof FigmaApiError ? e.message : `Unexpected error: ${(e as Error).message}` });
    }
  }, [lib]);
  useEffect(() => { void loadPreviews(token); }, [token, loadPreviews]);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; store.set('ds-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => store.set('ds-tab', tab), [tab]);

  const importLib = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as Library;
      if (j.schema !== 1 || !j.variables || !j.components) throw new Error('unexpected format (schema 1 expected, see scan/build-library.mjs)');
      setLib(j); setModes({}); setOpenId(undefined); setError('');
    } catch (e) { setError(`Import failed: ${(e as Error).message}`); }
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span className="brand-dot" />DS Universe</span>
        <div className="tabs" role="tablist">
          {(['explorer', 'builder', 'tokens'] as const).map(t => <button key={t} role="tab" aria-pressed={tab === t} onClick={() => { if (t !== tab) sfx('tick'); setTab(t); }}>{{ explorer: 'Explorer', builder: 'Builder', tokens: 'Tokens' }[t]}</button>)}
        </div>
        <span className="spacer" />
        {error && <span className="note" style={{ color: 'var(--coral-ink)' }}>{error}</span>}
        <div className="lib-meta"><b>{lib.file.name}</b><span>scanned {lib.file.scannedAt} · {Object.keys(lib.components).length} components · {Object.keys(lib.variables).length} variables</span></div>
        <button className="pill-btn" onClick={() => setWelcome(true)} title="Demo, scanning and import">Get started</button>
        <button className="pill-btn" onClick={() => file.current?.click()} title="Load a library.json produced by the scanner plugin">Import…</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={e => e.target.files?.[0] && importLib(e.target.files[0])} />
        <FigmaConnect previews={previews} user={figUser} hasToken={!!token} envToken={envToken}
          onConnect={t => { tokenStore.set(t); setToken(t); }} onRefresh={() => void loadPreviews(token)} onForget={() => { tokenStore.clear(); setToken(''); setFigUser(''); }} />
        <SoundToggle />
        <div className="seg">
          <button aria-pressed={!dark} onClick={() => { if (dark) sfx('tick'); setDark(false); }}>Light</button>
          <button aria-pressed={dark} onClick={() => { if (!dark) sfx('tick'); setDark(true); }}>Dark</button>
        </div>
      </header>
      <PanelModeContext.Provider value={panelCtx}>
      <PreviewsContext.Provider value={previews}>
      {tab === 'explorer' && <Explorer key={libId(lib) + (openId ?? '')} lib={lib} idx={idx} dark={dark} modes={modes} setModes={setModes} initial={openId} />}
      <Suspense fallback={<div className="view-loading" role="status" aria-live="polite"><span className="dot v" />Loading {tab === 'builder' ? 'Builder' : 'Tokens'}…</div>}>
        {tab === 'builder' && <Builder lib={lib} modes={modes} setModes={setModes} />}
        {tab === 'tokens' && <TokensView lib={lib} idx={idx} modes={modes} onOpen={id => { setOpenId(id); setTab('explorer'); }} />}
      </Suspense>
      </PreviewsContext.Provider>
      </PanelModeContext.Provider>
      {welcome && <Welcome libName={initial.file.name} onClose={() => setWelcome(false)} onImport={() => file.current?.click()} />}
      <div className="toast-zone" aria-live="polite">{toast && <span key={toast.k} className="toast">{toast.text}<span className="kbd-group">{panelShortcut}</span></span>}</div>
    </div>
  );
}
