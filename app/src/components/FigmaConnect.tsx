import { useState } from 'react';
import type { Previews } from '../lib/figmaApi';

export function FigmaConnect({ previews, user, hasToken, envToken, onConnect, onRefresh, onForget }: {
  previews: Previews; user: string; hasToken: boolean; envToken: boolean;
  onConnect: (token: string) => void; onRefresh: () => void; onForget: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const dot = { on: '#2E9B5A', loading: '#E0A030', error: 'var(--coral)', off: 'var(--mute)' }[previews.status];
  const count = Object.keys(previews.urls).length;
  return (
    <div style={{ position: 'relative' }}>
      <button className="pill-btn" aria-pressed={open} onClick={() => setOpen(!open)} title="Live previews from Figma">
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot, marginRight: 7, verticalAlign: 1 }} />Figma
      </button>
      {open && (
        <div className="fig-pop" role="dialog" aria-label="Figma connection">
          <span className="sec-t">Live Figma previews</span>
          {envToken && !hasToken ? (
            <>
              <span className="note">
                {previews.status === 'loading' && 'Figma is rendering previews…'}
                {previews.status === 'on' && `Token from .env file${user ? ` (${user})` : ''} · ${count} previews loaded.`}
                {previews.status === 'error' && previews.message}
              </span>
              <button className="pill-btn" style={{ alignSelf: 'flex-start' }} onClick={onRefresh} disabled={previews.status === 'loading'}>Refresh</button>
            </>
          ) : hasToken ? (
            <>
              <span className="note">
                {previews.status === 'loading' && 'Figma is rendering previews…'}
                {previews.status === 'on' && `Connected${user ? ` (${user})` : ''} · ${count} previews loaded.`}
                {previews.status === 'error' && previews.message}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="pill-btn" onClick={onRefresh} disabled={previews.status === 'loading'}>Refresh</button>
                <button className="pill-btn" onClick={() => { onForget(); setToken(''); }}>Forget token</button>
              </div>
            </>
          ) : (
            <>
              <span className="note">Set <span className="mono">FIGMA_TOKEN</span> in <span className="mono">app/.env</span> and restart <span className="mono">npm run dev</span>, or paste a token here (kept in this browser). Either way, it is only sent to the Figma API.</span>
              <form onSubmit={e => { e.preventDefault(); if (token.trim()) onConnect(token.trim()); }} style={{ display: 'flex', gap: 8 }}>
                <input className="search" type="password" autoComplete="off" aria-label="Figma personal access token" placeholder="figd_…" value={token} onChange={e => setToken(e.target.value)} />
                <button className="pill-btn" type="submit" disabled={!token.trim()}>Connect</button>
              </form>
              {previews.status === 'error' && <span className="note" style={{ color: 'var(--coral-ink)' }}>{previews.message}</span>}
              <a className="link-btn" href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens" target="_blank" rel="noreferrer">Create a Figma personal access token ↗</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
