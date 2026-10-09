import { useCallback, useMemo, useRef } from 'react';
import { useReactFlow, useStoreApi, type Viewport } from '@xyflow/react';
import { NUDGE, easeInOut, reducedMotion } from './camera';

/**
 * Canvas React Flow : au premier clic sur un node de la vue, la caméra s'approche un peu du node ;
 * `release` la ramène au cadrage d'avant (désélection). `forget` abandonne le retour si l'utilisateur a bougé la vue lui-même.
 */
export function useCameraNudge() {
  const rf = useReactFlow();
  const store = useStoreApi();
  const saved = useRef<Viewport | null>(null);

  const nudge = useCallback((id: string) => {
    if (saved.current || reducedMotion()) return;
    const n = rf.getInternalNode(id); if (!n) return;
    const { width, height } = store.getState();
    const vp = rf.getViewport();
    const p = n.internals.positionAbsolute;
    const fx = p.x + (n.measured.width ?? 0) / 2, fy = p.y + (n.measured.height ?? 0) / 2;
    // Position écran actuelle du centre du node, rapprochée du centre du canvas.
    const sx = fx * vp.zoom + vp.x, sy = fy * vp.zoom + vp.y;
    const tx = sx + (width / 2 - sx) * NUDGE.pull, ty = sy + (height / 2 - sy) * NUDGE.pull;
    const zoom = Math.min(rf.getZoom() * NUDGE.zoom, 3);
    saved.current = vp;
    rf.setViewport({ zoom, x: tx - fx * zoom, y: ty - fy * zoom }, { duration: NUDGE.ms, ease: easeInOut });
  }, [rf, store]);

  const release = useCallback(() => {
    const vp = saved.current; if (!vp) return;
    saved.current = null;
    rf.setViewport(vp, { duration: NUDGE.ms, ease: easeInOut });
  }, [rf]);

  const forget = useCallback(() => { saved.current = null; }, []);

  return useMemo(() => ({ nudge, release, forget }), [nudge, release, forget]);
}

export type CameraApi = ReturnType<typeof useCameraNudge>;
