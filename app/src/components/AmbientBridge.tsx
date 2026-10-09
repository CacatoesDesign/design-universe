import { useRef } from 'react';
import { useOnViewportChange, type Viewport } from '@xyflow/react';
import { setAmbientParallax } from '../lib/ambient';

/** À placer dans <ReactFlow> : transmet le déplacement du graphe à la lumière ambiante (parallaxe). */
export function AmbientBridge() {
  const start = useRef<Viewport | null>(null);
  useOnViewportChange({
    onChange: vp => {
      start.current ??= vp;
      setAmbientParallax((vp.x - start.current.x) * 0.02, (vp.y - start.current.y) * 0.02);
    },
  });
  return null;
}
