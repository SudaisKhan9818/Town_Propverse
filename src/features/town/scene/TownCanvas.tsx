'use client';

// ═══════════════════════════════════════════════════════════════════
// TownCanvas — public entry point of the 3D town (see ../index.ts).
// Full-screen overlay: WebGL canvas + HUD + details card + loader.
// The heavy scene module is code-split and only loads when shown.
// ═══════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { useTownStore } from '../store/town-store';
import { DPR_RANGE } from './PerformanceSystem';
import TownHud from '../ui/TownHud';
import TownLoader from '../ui/TownLoader';
import PlotDetailsCard from '../ui/PlotDetailsCard';

const TownScene = dynamic(() => import('./TownScene'), { ssr: false });

const OVERLAY_CSS = `
@keyframes pv-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
.pv-shimmer {
  background: linear-gradient(90deg, ${COLORS.cream} 25%, ${COLORS.paper} 50%, ${COLORS.cream} 75%);
  background-size: 200% 100%;
  animation: pv-shimmer 1.3s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .pv-shimmer { animation: none } }
`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TownCanvas({ visible, onClose }: Props) {
  const close = useCallback(() => {
    useTownStore.getState().reset();
    onClose();
  }, [onClose]);

  // ESC: close the card first, then leave focus. (Walk mode handles its
  // own ESC through pointer-lock release.)
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const { cameraMode, selectedUnit, deselect, setCameraMode } = useTownStore.getState();
      if (cameraMode === 'walk') return;
      if (selectedUnit) deselect();
      else if (cameraMode === 'focus') setCameraMode('orbit');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      document.body.style.cursor = '';
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ background: `linear-gradient(${COLORS.skyTop}, ${COLORS.skyHorizon})`, fontFamily: FONTS.sans }}
    >
      <style>{OVERLAY_CSS}</style>
      <Canvas
        shadows="percentage"
        dpr={[DPR_RANGE[0], Math.min(DPR_RANGE[1], typeof window === 'undefined' ? 1 : window.devicePixelRatio)]}
        frameloop="demand"
        camera={{ position: [140, 150, 240], fov: 42, near: 1, far: 2200 }}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        onPointerMissed={(event) => {
          // Sky click: same as clicking empty ground.
          if (event.type !== 'click') return;
          const { cameraMode, deselect, setCameraMode } = useTownStore.getState();
          if (cameraMode === 'walk') return;
          deselect();
          if (cameraMode === 'focus') setCameraMode('orbit');
        }}
      >
        <Suspense fallback={null}>
          <TownScene />
        </Suspense>
      </Canvas>
      <TownHud onClose={close} />
      <TownLoader />
      <PlotDetailsCard />
    </div>
  );
}
