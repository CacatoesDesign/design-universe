import { useState, type CSSProperties, type ReactNode } from 'react';
import { getBezierPath, Handle, Position, type EdgeProps } from '@xyflow/react';
import { Connector } from '../../components/Connector';
import { FigmaRender } from '../../render/FigmaRender';
import { usePreviews } from '../../lib/figmaApi';
import type { FNode, Library } from '../../lib/types';

export function GradientEdge(p: EdgeProps) {
  const [d] = getBezierPath({ sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition });
  const data = (p.data ?? {}) as { hot?: boolean; dim?: boolean; pulse?: number | string; pulseDelay?: number; delay?: number };
  return <Connector d={d} x1={p.sourceX} y1={p.sourceY} x2={p.targetX} y2={p.targetY} hot={!!data.hot} dim={!!data.dim} pulse={data.pulse ?? 0} pulseDelay={data.pulseDelay ?? 0} pid={`${p.id}:${p.source}>${p.target}`} delay={data.delay ?? 0} drawn />;
}

/** Aperçu d'un arbre Figma mis à l'échelle pour tenir dans une boîte. */
export function Preview({ lib, tree, w, h, max = 1 }: { lib: Library; tree: FNode; w: number; h: number; max?: number }) {
  const k = Math.min(max, (w - 16) / tree.w, (h - 16) / tree.h);
  return (
    <div className="preview" style={{ width: w, height: h }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: 'center', flex: 'none' }}><FigmaRender node={tree} opts={{ lib }} /></div>
    </div>
  );
}

export const In = () => <Handle type="target" position={Position.Left} />;
export const Out = () => <Handle type="source" position={Position.Right} />;

/** Icône « split » de Lucide (licence ISC), comme dans la maquette. */
export const RouterIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(90deg)' }}>
    <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
  </svg>
);

/** Sources d'aperçu d'un node, par ordre de préférence : rendu live Figma, puis PNG statique public/previews. */
export const previewSources = (id: string, live?: string) => [live, `/previews/${id.replace(/:/g, '-')}.png`].filter(Boolean) as string[];

/** Image qui essaie chaque source tour à tour et n'affiche `fallback` que si toutes échouent. */
export function FallbackImg({ sources, fallback, style, alt = '' }: { sources: string[]; fallback: ReactNode; style?: CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = sources.find(s => !failed.includes(s));
  if (!src) return <>{fallback}</>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(f => [...f, src])} style={style} />;
}

/** Vignette Figma : rendu live via l'API (token), sinon PNG statique, sinon repli. */
export function Thumb({ id, w, h, fallback }: { id: string; w: number; h: number; fallback: ReactNode }) {
  const live = usePreviews().urls[id];
  const sources = previewSources(id, live);
  return (
    <FallbackImg key={sources.join('|')} sources={sources} fallback={fallback}
      style={{ width: w, height: h, objectFit: 'cover', objectPosition: 'top center', display: 'block', borderRadius: 10, background: '#FFF9F0' }} />
  );
}
