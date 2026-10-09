import { useEffect, useRef } from 'react';
import { markHint } from '../lib/hints';

/** Accueil au premier lancement : explorer la démo, importer sa lib, ou apprendre à la scanner. Rouvrable avec « Get started ». */
export function Welcome({ libName, onClose, onImport }: { libName: string; onClose: () => void; onImport: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = () => { markHint('welcome'); onClose(); };
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>('button[data-primary]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return (
    <div className="welcome-scrim" onClick={close}>
      <div ref={box} className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={e => e.stopPropagation()}>
        <span className="eyebrow">DS Universe</span>
        <h1 id="welcome-title">Explore a design system as a living graph</h1>
        <p className="lead">From one component to the whole library: variants, Figma variables, alias chains, generated CSS, and where each piece is used.</p>
        <div className="welcome-cards">
          <section>
            <span className="num">1</span>
            <h2>Explore the demo</h2>
            <p>{libName} is already loaded. Click a zone of a component, then scroll to travel between levels.</p>
            <button className="pill-btn primary" data-primary onClick={close}>Start exploring</button>
          </section>
          <section>
            <span className="num">2</span>
            <h2>Scan your Figma file</h2>
            <ol>
              <li>In Figma desktop: <b>Plugins → Development → Import plugin from manifest…</b> and pick <code>plugin/manifest.json</code> from this repo.</li>
              <li>Select <b>one component</b> and click <b>Scan selection</b>. Try a page or the whole file later.</li>
              <li>Download the <code>library.json</code>.</li>
            </ol>
          </section>
          <section>
            <span className="num">3</span>
            <h2>Import it here</h2>
            <p>Load the <code>library.json</code> produced by the plugin. It stays in your browser.</p>
            <button className="pill-btn" onClick={() => { close(); onImport(); }}>Import library…</button>
          </section>
        </div>
        <p className="foot">Live PNG previews are optional: add a Figma token with the <b>Figma</b> button in the top bar.</p>
      </div>
    </div>
  );
}
