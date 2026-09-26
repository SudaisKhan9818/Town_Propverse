'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import dynamic from 'next/dynamic';
import InfoPanel from './InfoPanel';
import type { Selection } from './useSelection';

// Lazy-load TownScene — keeps WebGL off the main thread until needed
const TownScene = dynamic(() => import('./TownScene'), { ssr: false });

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TownCanvas({ visible, onClose }: Props) {
  const [walkModeEnabled, setWalkModeEnabled] = useState(false);
  const [walkLocked, setWalkLocked] = useState(false);
  const [walkLockRequest, setWalkLockRequest] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ x: number; z: number } | null>(null);
  const [selectionResetKey, setSelectionResetKey] = useState(0);

  const closePanel = useCallback(() => {
    setSelected(null);
    setFocusTarget(null);
    setSelectionResetKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (visible && event.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  const closeTown = () => {
    setWalkModeEnabled(false);
    setWalkLocked(false);
    closePanel();
    onClose();
  };

  const handleSelectionChange = useCallback((selection: Selection | null, center: { x: number; z: number } | null) => {
    setSelected(selection);
    if (!selection) setFocusTarget(null);
  }, []);

  const handleFocusRequest = useCallback((center: { x: number; z: number }) => {
    setWalkModeEnabled(false);
    setWalkLocked(false);
    setFocusTarget(center);
  }, []);

  const closeFocus = useCallback(() => setFocusTarget(null), []);

  // Don't mount the Canvas at all when hidden.
  // This prevents: pointer-events blocking page, THREE.Clock deprecation on load,
  // and WebGL context waste. Canvas is created fresh on first "Explore" click.
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#F5EFE2',
      }}
    >
      {/* HUD close button */}
      <button
        onClick={closeTown}
        aria-label="Close 3D Town View"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 101,
          padding: '10px 24px',
          background: '#C47A4B',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: '0.82rem',
          letterSpacing: '0.09em',
          textTransform: 'uppercase' as const,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}
      >
        ✕  Close 3D View
      </button>

      {/* HUD label */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 101,
          padding: '8px 16px',
          background: 'rgba(28,26,23,0.72)',
          color: '#F5EFE2',
          borderRadius: 6,
          fontFamily: 'sans-serif',
          fontSize: '0.72rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
        }}
      >
        PropVerse / Town 01 — Phase 1+2
      </div>

      <button
        className="walk-mode-toggle"
        type="button"
        onClick={() => {
          if (walkModeEnabled) {
            setWalkModeEnabled(false);
            setWalkLocked(false);
          } else {
            closePanel();
            setWalkModeEnabled(true);
            setWalkLockRequest((request) => request + 1);
          }
        }}
        aria-pressed={walkModeEnabled}
        style={{ position: 'absolute', top: 20, right: 170, zIndex: 101, padding: '10px 18px', background: walkModeEnabled ? '#1C1A17' : '#C47A4B', color: '#F5EFE2', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}
      >
        {walkModeEnabled ? 'Close Walk Mode' : 'Walk Mode'}
      </button>

      {focusTarget && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); closeFocus(); }}
          style={{ position: 'absolute', top: 66, right: 20, zIndex: 101, padding: '9px 18px', background: '#1C1A17', color: '#F5EFE2', border: '1px solid rgba(245,239,226,0.35)', borderRadius: 6, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}
        >
          Close Focus View
        </button>
      )}

      <Canvas
        shadows={false}
        dpr={[1, 1.25]}
        frameloop="demand"
        camera={{ position: [0, 120, 180], fov: 45 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <TownScene
            walkModeEnabled={walkModeEnabled}
            onWalkModeChange={setWalkModeEnabled}
            onWalkLockChange={setWalkLocked}
            onSelectionChange={handleSelectionChange}
            onFocusRequest={handleFocusRequest}
            focusTarget={focusTarget}
            selectionResetKey={selectionResetKey}
            walkLockRequest={walkLockRequest}
          />
        </Suspense>
      </Canvas>

      <InfoPanel selected={selected} onClose={closePanel} onFocus={(position) => setFocusTarget({ ...position })} />

      {walkLocked && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '50%', top: '50%', width: 7, height: 7, transform: 'translate(-50%, -50%)', zIndex: 101, borderRadius: '50%', background: '#F5EFE2', boxShadow: '0 0 0 1px rgba(28,26,23,0.6)' }}
        />
      )}

      {walkModeEnabled && (
        <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 101, padding: '8px 14px', borderRadius: 999, background: 'rgba(28,26,23,0.78)', color: '#F5EFE2', fontFamily: 'sans-serif', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          WASD move · Shift run · ESC exit
        </div>
      )}
    </div>
  );
}
