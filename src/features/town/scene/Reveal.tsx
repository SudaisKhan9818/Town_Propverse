'use client';

// ═══════════════════════════════════════════════════════════════════
// Progressive reveal: ground + roads → civic/markets/masjids (GLB) →
// houses (GLB, last). A stage mounts only after the previous stage's
// models have loaded AND rendered, then rises out of the ground (scale-Y
// ease) once its own GLBs resolve — no pop-in, the town "builds" itself.
// The shadow map is static (autoUpdate off) and refreshed only while
// something is moving — orbiting a finished town never re-renders it.
// ═══════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTownStore, type RevealStage } from '../store/town-store';

const RISE_SECONDS = 0.8;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Drives revealStage 1 → 2 → 3, one idle slot after each stage paints. */
export function RevealController() {
  const stage = useTownStore((s) => s.revealStage);
  const ready = useTownStore((s) => s.readyStage);
  const setStage = useTownStore((s) => s.setRevealStage);
  const { gl, invalidate } = useThree();
  const framesSinceStage = useRef(0);
  const scheduled = useRef<RevealStage>(0);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    setStage(1);
  }, [gl, setStage]);

  useEffect(() => {
    framesSinceStage.current = 0;
    invalidate();
  }, [invalidate, stage, ready]);

  useFrame(() => {
    framesSinceStage.current += 1;
    if (stage >= 3 || scheduled.current > stage || ready < stage) return;
    if (framesSinceStage.current < 2) {
      invalidate();
      return;
    }
    const next = (stage + 1) as RevealStage;
    scheduled.current = next;
    const w = window as IdleWindow;
    const advance = () => setStage(next);
    if (w.requestIdleCallback) w.requestIdleCallback(advance, { timeout: 350 });
    else window.setTimeout(advance, 60);
  });

  return null;
}

/** Reports a stage as ready once its (suspending) content has mounted. */
function StageMounted({ stage }: { stage: RevealStage }) {
  const setReady = useTownStore((s) => s.setReadyStage);
  useEffect(() => setReady(stage), [setReady, stage]);
  return null;
}

/** Mounts children at `stage`; optionally rises them out of the ground. */
export function RevealGroup({ stage, rise = false, children }: { stage: RevealStage; rise?: boolean; children: ReactNode }) {
  const visible = useTownStore((s) => s.revealStage >= stage);
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(rise ? 0 : RISE_SECONDS);
  const settleFrames = useRef(3);
  const { gl, invalidate } = useThree();

  useFrame((_, dt) => {
    if (!visible || !group.current) return;
    if (elapsed.current < RISE_SECONDS) {
      elapsed.current = Math.min(RISE_SECONDS, elapsed.current + Math.min(dt, 0.05));
      group.current.scale.y = Math.max(0.001, easeOutCubic(elapsed.current / RISE_SECONDS));
      gl.shadowMap.needsUpdate = true;
      invalidate();
    } else if (settleFrames.current > 0) {
      // A few extra frames: drei <Instances> write matrices in useFrame.
      settleFrames.current -= 1;
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
  });

  if (!visible) return null;
  return (
    <Suspense fallback={null}>
      <group ref={group} scale={[1, rise ? 0.001 : 1, 1]}>
        {children}
        <StageMounted stage={stage} />
      </group>
    </Suspense>
  );
}
