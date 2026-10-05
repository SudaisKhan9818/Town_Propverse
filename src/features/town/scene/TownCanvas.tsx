'use client';

// ═══════════════════════════════════════════════════════════════════
// TownCanvas — public entry point of the 3D town (see ../index.ts).
// Full-screen overlay: WebGL canvas + HUD + details card + loader.
// The heavy scene module is code-split and only loads when shown.
// ═══════════════════════════════════════════════════════════════════

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { COLORS, FONTS } from '@/src/shared/theme/tokens';
import { useTownStore } from '../store/town-store';
import TownHud from '../ui/TownHud';
import TownLoader from '../ui/TownLoader';
import PlotDetailsCard from '../ui/PlotDetailsCard';
import { useTwinIoT } from '@/src/twin/useTwinIoT';
import TwinBlueprintView, { type SectionName } from '@/src/twin/TwinBlueprintView';
import TwinGrafanaPanel from '@/src/twin/TwinGrafanaPanel';
import TwinMqttPanel from '@/src/twin/TwinMqttPanel';

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
  /** Kept for caller compatibility; the Twin view is now controlled here. */
  twinMode?: boolean;
}

function TwinXRayView({ presentationMode }: { presentationMode: boolean }) {
  const { liveData, historyData, logs, applyAutoHeal, fixPole, togglePole, dimPole, bulkControl } = useTwinIoT();
  const [selectedPole, setSelectedPole] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<SectionName>('ALL');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectPole = (poleId: string) => setSelectedPole(poleId || null);
  const captureTwin = () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const link = document.createElement('a');
    link.download = `PropVerse_Twin_HR_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  };

  return (
    <div className="relative h-screen w-full bg-[#000000]">
      <TwinBlueprintView
        liveData={liveData}
        historyData={historyData}
        logs={logs}
        selectedPole={selectedPole}
        sectionFilter={sectionFilter}
        onSelectPole={selectPole}
        onTogglePole={togglePole}
        onDimPole={dimPole}
        onAutoHeal={applyAutoHeal}
        presentationMode={presentationMode}
        onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
        }}
      />
      {!presentationMode && <div className="pointer-events-none absolute inset-0 z-[220]">
        <div className="pointer-events-auto absolute inset-x-0 top-0 h-[calc(100dvh-clamp(220px,28vh,340px)-88px)] w-full lg:inset-x-auto lg:right-0 lg:h-full lg:w-[380px]">
          <TwinGrafanaPanel
            liveData={liveData}
            historyData={historyData}
            logs={logs}
            selectedPole={selectedPole}
            sectionFilter={sectionFilter}
            onSectionChange={setSectionFilter}
            onSelectPole={selectPole}
            onBulkControl={bulkControl}
            onFixPole={fixPole}
            onAutoHeal={applyAutoHeal}
            onCapture={captureTwin}
          />
        </div>
        <TwinMqttPanel logs={logs} onSelectPole={selectPole} />
      </div>}
    </div>
  );
}

export default function TownCanvas({ visible, onClose }: Props) {
  const [viewMode, setViewMode] = useState<'real' | 'twin'>('real');
  const [hrMode, setHrMode] = useState(false);
  const close = useCallback(() => {
    useTownStore.getState().reset();
    onClose();
  }, [onClose]);

  useEffect(() => {
    useTownStore.getState().reset();
    document.body.style.cursor = '';
    setHrMode(false);
  }, [viewMode]);

  // ESC: close the card first, then leave focus. (Walk mode handles its
  // own ESC through pointer-lock release.)
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'h' && viewMode === 'twin') {
        setHrMode((current) => !current);
        return;
      }
      if (event.key === 'Escape' && hrMode) {
        setHrMode(false);
        return;
      }
      if (event.key !== 'Escape') return;
      const { cameraMode, selectedUnit, deselect, setCameraMode } = useTownStore.getState();
      if (cameraMode === 'walk') return;
      if (selectedUnit) deselect();
      else if (cameraMode === 'focus') setCameraMode('orbit');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hrMode, viewMode, visible]);

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

  const isTwinView = viewMode === 'twin';

  return (
    <div
      className="fixed inset-0 z-[100] h-screen w-full overflow-hidden"
      style={{ background: `linear-gradient(${COLORS.skyTop}, ${COLORS.skyHorizon})`, fontFamily: FONTS.sans }}
    >
      <style>{OVERLAY_CSS}</style>
      {isTwinView ? (
        <TwinXRayView presentationMode={hrMode} />
      ) : (
        <Canvas
          key={viewMode}
          shadows
          dpr={[1, 1.5]}
          performance={{ min: 0.5 }}
          frameloop="demand"
          camera={{ position: [140, 150, 240], fov: 42, near: 1, far: 2200 }}
          gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
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
            <TownScene key={viewMode} />
          </Suspense>
        </Canvas>
      )}
      {!isTwinView && <>
        <TownHud onClose={close} />
        <TownLoader />
        <PlotDetailsCard />
      </>}
      {!hrMode && <button
        type="button"
        onClick={() => setViewMode(isTwinView ? 'real' : 'twin')}
        className="absolute left-1/2 top-5 z-[230] -translate-x-1/2 rounded-full border border-cyan-300/40 bg-black/70 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-xl transition hover:border-cyan-200 hover:bg-cyan-950/80"
      >
        {isTwinView ? 'BACK TO REAL TOWN' : 'ENTER TWIN IOT MODEL'}
      </button>}
    </div>
  );
}
