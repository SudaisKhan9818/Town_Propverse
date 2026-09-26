'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import dynamic from 'next/dynamic';
import PremiumPlotCard from './PremiumPlotCard';
import type { UnitData } from './TownScene';

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
  const [focusTarget, setFocusTarget] = useState<{ x: number; z: number } | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Prevent double-firing of walk mode toggle
  const walkToggleInFlight = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasPopup = !!selectedUnit && !walkModeEnabled;

  // ESC key closes card first, then focus (not walk mode — WalkMode.tsx handles that internally)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!visible || walkModeEnabled) return;
      if (event.key === 'Escape') {
        if (selectedUnit) {
          setSelectedUnit(null);
        } else {
          setFocusTarget(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, walkModeEnabled, selectedUnit]);

  const closeTown = useCallback(() => {
    setWalkModeEnabled(false);
    setWalkLocked(false);
    setFocusTarget(null);
    setSelectedUnit(null);
    onClose();
  }, [onClose]);

  const handleFocusRequest = useCallback((center: { x: number; z: number }) => {
    setWalkModeEnabled(false);
    setWalkLocked(false);
    setFocusTarget({ ...center });
  }, []);

  const closeFocus = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    setFocusTarget(null);
  }, []);

  const toggleWalkMode = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (walkToggleInFlight.current) return;
    walkToggleInFlight.current = true;
    setTimeout(() => { walkToggleInFlight.current = false; }, 400);

    // Auto-close unit card on walk mode toggle
    setSelectedUnit(null);

    if (walkModeEnabled) {
      setWalkModeEnabled(false);
      setWalkLocked(false);
    } else {
      setFocusTarget(null);
      setWalkModeEnabled(true);
      setWalkLockRequest((r) => r + 1);
    }
  }, [walkModeEnabled]);

  // Don't mount the Canvas at all when hidden.
  if (!visible) return null;

  const buttonsOnLeft = isMobile || hasPopup;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#F5EFE2',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* ── TOP-LEFT LABEL ── */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 12 : 16,
          left: isMobile ? 12 : 16,
          zIndex: 201,
          padding: '8px 16px',
          background: 'rgba(28,26,23,0.80)',
          backdropFilter: 'blur(8px)',
          color: '#F5EFE2',
          borderRadius: 8,
          fontSize: '0.70rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase' as const,
          fontWeight: 600,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        PropVerse · Town 01 — Phase 1 + 2
      </div>

      {/* ── DYNAMIC CONTROLS CONTAINER (WALK MODE & CLOSE) ── */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 50 : 16,
          left: buttonsOnLeft ? (isMobile ? 12 : 220) : 'auto',
          right: buttonsOnLeft ? 'auto' : 16,
          zIndex: 201,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Walk Mode Toggle */}
        <button
          id="btn-walk-mode"
          type="button"
          onClick={toggleWalkMode}
          aria-pressed={walkModeEnabled}
          style={{
            padding: '10px 20px',
            background: walkModeEnabled
              ? 'linear-gradient(135deg,#1C1A17 0%,#2e2b26 100%)'
              : 'linear-gradient(135deg,#a05c28 0%,#C47A4B 100%)',
            color: '#F5EFE2',
            border: walkModeEnabled
              ? '1px solid rgba(245,239,226,0.30)'
              : '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.76rem',
            letterSpacing: '0.10em',
            textTransform: 'uppercase' as const,
            boxShadow: walkModeEnabled
              ? '0 2px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 4px 18px rgba(196,122,75,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span style={{ fontSize: '0.9em' }}>{walkModeEnabled ? '⊠' : '⊞'}</span>
          {walkModeEnabled ? 'Exit Walk' : 'Walk Mode'}
        </button>

        {/* Close 3D View */}
        <button
          id="btn-close-town"
          type="button"
          onClick={closeTown}
          aria-label="Close 3D Town View"
          style={{
            padding: '10px 22px',
            background: 'linear-gradient(135deg,#a05c28 0%,#C47A4B 100%)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.76rem',
            letterSpacing: '0.10em',
            textTransform: 'uppercase' as const,
            boxShadow: '0 4px 18px rgba(196,122,75,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span style={{ fontSize: '0.85em', opacity: 0.85 }}>✕</span>
          Close 3D View
        </button>
      </div>

      {/* ── FOCUS VIEW CLOSE (below top-right controls) ── */}
      {focusTarget && (
        <button
          id="btn-close-focus"
          type="button"
          onClick={(e) => closeFocus(e)}
          style={{
            position: 'absolute',
            top: 64,
            right: 16,
            zIndex: 201,
            padding: '9px 20px',
            background: 'rgba(28,26,23,0.88)',
            backdropFilter: 'blur(8px)',
            color: '#F5EFE2',
            border: '1px solid rgba(245,239,226,0.30)',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.09em',
            textTransform: 'uppercase' as const,
            boxShadow: '0 4px 18px rgba(0,0,0,0.40)',
            transition: 'all 0.18s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            pointerEvents: 'auto',
          }}
        >
          <span style={{ fontSize: '0.8em', opacity: 0.75 }}>⟵</span>
          Close Focus View
        </button>
      )}

      {/* ── CANVAS ── */}
      <Canvas
        shadows={false}
        dpr={[0.85, 1]}
        frameloop="demand"
        camera={{ position: [0, 120, 180], fov: 45, near: 0.1, far: 500 }}
        performance={{ min: 0.5, max: 1, debounce: 250 }}
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <TownScene
            walkModeEnabled={walkModeEnabled}
            onWalkModeChange={setWalkModeEnabled}
            onWalkLockChange={(locked) => {
              setWalkLocked(locked);
              if (!locked && walkModeEnabled) setWalkModeEnabled(false);
            }}
            onFocusRequest={handleFocusRequest}
            focusTarget={focusTarget}
            walkLockRequest={walkLockRequest}
            onUnitSelect={(unit) => {
              // Don't open card in walk mode
              if (!walkModeEnabled) setSelectedUnit(unit);
            }}
          />
        </Suspense>
      </Canvas>

      {/* ── WALK MODE CROSSHAIR ── */}
      {walkLocked && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 8,
            height: 8,
            transform: 'translate(-50%, -50%)',
            zIndex: 201,
            borderRadius: '50%',
            background: 'rgba(245,239,226,0.92)',
            boxShadow: '0 0 0 1.5px rgba(28,26,23,0.65)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── PREMIUM PLOT CARD OVERLAY ── */}
      <PremiumPlotCard
        unit={selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />

      {/* ── WALK MODE HINT BAR ── */}
      {walkModeEnabled && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 22,
            transform: 'translateX(-50%)',
            zIndex: 201,
            padding: '9px 18px',
            borderRadius: 999,
            background: 'rgba(28,26,23,0.82)',
            backdropFilter: 'blur(6px)',
            color: '#F5EFE2',
            fontSize: '0.70rem',
            letterSpacing: '0.10em',
            fontWeight: 500,
            pointerEvents: 'none',
            userSelect: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          {walkLocked
            ? 'WASD move · Shift sprint · Mouse look · ESC exit'
            : 'Click the canvas to activate walk mode…'}
        </div>
      )}
    </div>
  );
}
