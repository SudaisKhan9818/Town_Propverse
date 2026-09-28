'use client';

// ═══════════════════════════════════════════════════════════════════
// PerformanceSystem — adaptive DPR (0.75–1.75) + quality fallback, and
// a one-shot budget report from three's renderer.info once the town has
// fully revealed.
//
// Budgets (3D only, steady-state frame): < 120 draw calls · < 400k
// triangles. The shadow map is static (refreshed only while the town
// reveals or quality changes), so the one-off shadow-refresh frame is
// reported separately.
// frameloop="demand": nothing renders unless something changed (drag,
// damping, tween, walk). An idle town sleeps.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useTownStore } from '../store/town-store';
import { isTownDebug } from './debug';

const BUDGET = { drawCalls: 120, triangles: 400_000 } as const;
export const DPR_RANGE = [0.75, 1.75] as const;

interface RenderStats {
  calls: number;
  triangles: number;
  /** Frame that also re-renders the static shadow map (reveal only). */
  shadowRefresh: { calls: number; triangles: number };
  geometries: number;
  textures: number;
  programs: number;
  pass: boolean;
}

let lastStats: RenderStats | null = null;
export const getLastRenderStats = () => lastStats;

function StatsReporter() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const complete = useTownStore((s) => s.readyStage >= 3);
  // -1 idle · 2 → render with shadow refresh · 1 → read it, render steady · 0 → read steady
  const step = useRef(-1);
  const shadowFrame = useRef({ calls: 0, triangles: 0 });

  useEffect(() => {
    if (!complete) return;
    // Let the rise animation finish, then measure.
    const timer = window.setTimeout(() => {
      step.current = 2;
      invalidate();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [complete, invalidate]);

  useFrame(() => {
    if (step.current < 0) return;
    const { render, memory, programs } = gl.info;
    if (step.current === 2) {
      gl.shadowMap.needsUpdate = true;
      step.current = 1;
      invalidate();
      return;
    }
    if (step.current === 1) {
      shadowFrame.current = { calls: render.calls, triangles: render.triangles };
      step.current = 0;
      invalidate();
      return;
    }
    step.current = -1;
    lastStats = {
      calls: render.calls,
      triangles: render.triangles,
      shadowRefresh: shadowFrame.current,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: programs?.length ?? 0,
      pass: render.calls < BUDGET.drawCalls && render.triangles < BUDGET.triangles,
    };
    if (!isTownDebug()) return;
    console.info(
      `[PropVerse] renderer.info — ${lastStats.calls} draw calls, ${lastStats.triangles.toLocaleString()} triangles `
      + `(shadow-refresh frame: ${lastStats.shadowRefresh.calls} calls, ${lastStats.shadowRefresh.triangles.toLocaleString()} tris), `
      + `${lastStats.geometries} geometries, ${lastStats.textures} textures · BUDGET ${lastStats.pass ? 'PASS' : 'FAIL'}`,
    );
  });

  return null;
}

export default function PerformanceSystem() {
  const setDpr = useThree((s) => s.setDpr);
  const setQuality = useTownStore((s) => s.setQuality);

  return (
    <>
      <PerformanceMonitor
        bounds={() => [45, 58]}
        flipflops={3}
        onChange={({ factor }) => {
          const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
          const [min, max] = DPR_RANGE;
          setDpr(Math.min(device, min + (max - min) * factor));
        }}
        onDecline={() => setQuality('low')}
        onIncline={() => setQuality('high')}
      />
      <StatsReporter />
    </>
  );
}
