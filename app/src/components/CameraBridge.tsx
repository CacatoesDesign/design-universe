import { useEffect } from 'react';
import { useCameraNudge, type CameraApi } from '../lib/useCameraNudge';

/** À placer dans <ReactFlow> : transmet la caméra au composant parent (hors du provider). */
export function CameraBridge({ onReady }: { onReady: (cam: CameraApi | null) => void }) {
  const cam = useCameraNudge();
  useEffect(() => { onReady(cam); return () => onReady(null); }, [onReady, cam]);
  return null;
}
