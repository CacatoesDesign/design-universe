import { useMemo, useState } from 'react';
import type { Component, Library, Screen } from '../../lib/types';
import { sfx } from '../../lib/sound';

type Kind = 'components' | 'compositions' | 'screens';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'compositions', label: 'Compositions' },
  { id: 'screens', label: 'Screens' },
];
const kindOf = (c: Component): Kind => (c.layer === 'Compositions' ? 'compositions' : 'components');

type Item = { key: string; name: string; group: string; count?: number; comp?: Component; screen?: Screen };

/** Colonne de gauche de l'Explorer : filtre par type, puis une page Figma repliable par groupe. */
export function ComponentList({ lib, current, screenId, onOpenComp, onOpenScreen }: {
  lib: Library; current: Component; screenId?: string;
  onOpenComp: (id: string) => void; onOpenScreen: (s: Screen) => void;
}) {
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<Set<Kind>>(() => new Set(KINDS.map(k => k.id)));
  const [open, setOpen] = useState<Set<string>>(() => new Set([current.page]));

  // Le composant ouvert ailleurs (niveau Library, relations…) déplie sa page.
  const [seenPage, setSeenPage] = useState(current.page);
  if (seenPage !== current.page) { setSeenPage(current.page); setOpen(o => new Set(o).add(current.page)); }

  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (!n.delete(v)) n.add(v); return n; };

  const counts = useMemo(() => {
    const n: Record<Kind, number> = { components: 0, compositions: 0, screens: lib.screens.length };
    for (const c of Object.values(lib.components)) n[kindOf(c)]++;
    return n;
  }, [lib]);

  const pages = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (...s: string[]) => !needle || s.some(x => x.toLowerCase().includes(needle));
    const map: Record<string, Item[]> = {};
    for (const c of Object.values(lib.components)) {
      if (kinds.has(kindOf(c)) && hit(c.name, c.page, c.group ?? '')) (map[c.page] ??= []).push({ key: c.id, name: c.name, group: c.group ?? c.page, count: c.variants.length ? c.variantCount : undefined, comp: c });
    }
    if (kinds.has('screens')) for (const s of lib.screens) if (hit(s.name, s.page)) (map[s.page] ??= []).push({ key: s.id, name: s.name, group: s.page, screen: s });
    return Object.entries(map);
  }, [lib, kinds, q]);

  return (
    <nav className="sidebar">
      <input className="search" placeholder="Search components…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="side-filter" role="group" aria-label="Show">
        {KINDS.map(k => (
          <button key={k.id} aria-pressed={kinds.has(k.id)}
            onClick={() => { if (kinds.has(k.id) && kinds.size === 1) return; sfx('tick'); setKinds(toggle(kinds, k.id)); }}>
            {k.label}<span className="ct">{counts[k.id]}</span>
          </button>
        ))}
      </div>
      {pages.map(([page, items]) => {
        const expanded = !!q || open.has(page);
        const groups = [...new Set(items.map(i => i.group))];
        return (
          <div className="side-group" key={page}>
            <button className="side-page" aria-expanded={expanded} onClick={() => { if (q) return; sfx('tick'); setOpen(toggle(open, page)); }}>
              <span className="chev" aria-hidden />
              <span className="nm">{page}</span>
              <span className="ct">{items.length}</span>
            </button>
            {expanded && groups.map(g => (
              <div className="side-sub" key={g}>
                {groups.length > 1 && <span className="side-title">{g}</span>}
                {items.filter(i => i.group === g).map(i => (
                  <button key={i.key} className="side-item" aria-current={i.comp ? i.comp.id === current.id : i.screen?.id === screenId}
                    title={i.comp && !i.comp.variants.length ? 'Render tree not scanned: relations and usages only' : undefined}
                    onClick={() => (i.comp ? onOpenComp(i.comp.id) : onOpenScreen(i.screen!))}>
                    <span className="nm">{i.name}</span>
                    {i.screen ? <span className="no-tree">screen</span> : i.count ? <span className="ct">{i.count}</span> : <span className="no-tree">graph</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      {pages.length === 0 && <span className="note" style={{ padding: '0 8px' }}>No match.</span>}
      {lib.iconsPage.components > 0 && <div className="side-group">
        <span className="side-title">Icons</span>
        <span className="note" style={{ padding: '0 8px' }}>{lib.iconsPage.components} components on page {lib.iconsPage.page} (Outline / Solid), used as instances.</span>
      </div>}
    </nav>
  );
}
