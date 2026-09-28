'use client';

// ═══════════════════════════════════════════════════════════════════
// FocusRig — custom camera tween for focus mode (no controls.zoomTo snap).
//
//   enter: 1.2s easeInOutCubic; camera.position and controls.target are
//          lerped TOGETHER so the framing never swings. The pre-focus
//          pose is stored once, on the first focus from orbit.
//   exit:  cameraMode → 'orbit' (X button, ESC, empty-ground click) tweens
//          back to the stored pose.
//   walk:  entering walk mode discards the stored pose.
//
// Also plays the one-time intro dolly while the town is revealed.
// All timing is deltaTime-based and runs only while a tween is active.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControlsImpl } from './types';
import { useTownStore, type FocusTarget } from '../store/town-store';

const FOCUS_DURATION = 1.2;
const INTRO_DURATION = 2.4;
const FOCUS_ELEVATION = (40 * Math.PI) / 180;

const HOME_POSE = {
  position: new THREE.Vector3(96, 118, 168),
  target: new THREE.Vector3(-2, 0, 2),
};

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface Tween {
  fromPos: THREE.Vector3;
  fromTgt: THREE.Vector3;
  toPos: THREE.Vector3;
  toTgt: THREE.Vector3;
  elapsed: number;
  duration: number;
  ease: (t: number) => number;
  interruptible: boolean;
  onDone?: () => void;
}

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function focusPose(focus: FocusTarget, camera: THREE.Camera, currentTarget: THREE.Vector3): Pose {
  const w = focus.footprint?.w ?? 12;
  const d = focus.footprint?.d ?? 12;
  const h = focus.footprint?.h ?? 6;
  const target = new THREE.Vector3(focus.position.x, Math.min(h, 12) * 0.35, focus.position.z);
  // Keep the viewer's current compass heading so the town never spins.
  const heading = new THREE.Vector3().subVectors(camera.position, currentTarget).setY(0);
  if (heading.lengthSq() < 1e-4) heading.set(0, 0, 1);
  heading.normalize();
  const distance = THREE.MathUtils.clamp(Math.max(w, d) * 1.5 + 18, 26, 110);
  const offset = heading.multiplyScalar(Math.cos(FOCUS_ELEVATION) * distance).setY(Math.sin(FOCUS_ELEVATION) * distance);
  return { position: target.clone().add(offset), target };
}

export default function FocusRig() {
  const { camera, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const tween = useRef<Tween | null>(null);
  const saved = useRef<Pose | null>(null);
  const introPlayed = useRef(false);

  const start = (to: Pose, duration: number, ease: Tween['ease'], interruptible: boolean, onDone?: () => void) => {
    if (!controls) return;
    tween.current = {
      fromPos: camera.position.clone(),
      fromTgt: controls.target.clone(),
      toPos: to.position.clone(),
      toTgt: to.target.clone(),
      elapsed: 0,
      duration,
      ease,
      interruptible,
      onDone,
    };
    controls.enabled = interruptible;
    invalidate();
  };

  // Intro dolly: starts wide and settles on the home pose while the town
  // reveals. Any drag/wheel interrupts it.
  useEffect(() => {
    if (!controls || introPlayed.current) return;
    introPlayed.current = true;
    // A unit was selected (e.g. from chat) before the town opened: skip the
    // intro and fly straight to it; exiting focus returns to the home pose.
    const pending = useTownStore.getState();
    if (pending.cameraMode === 'focus' && pending.focusTarget) {
      camera.position.copy(HOME_POSE.position);
      controls.target.copy(HOME_POSE.target);
      controls.update();
      saved.current = { position: HOME_POSE.position.clone(), target: HOME_POSE.target.clone() };
      start(focusPose(pending.focusTarget, camera, controls.target), FOCUS_DURATION, easeInOutCubic, false);
      return undefined;
    }
    const wide = HOME_POSE.position.clone().sub(HOME_POSE.target).multiplyScalar(1.45).add(HOME_POSE.target);
    wide.y *= 0.82;
    camera.position.copy(wide);
    controls.target.copy(HOME_POSE.target);
    controls.update();
    start(HOME_POSE, INTRO_DURATION, easeOutCubic, true);
    const cancel = () => {
      if (tween.current?.interruptible) tween.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  useEffect(() => useTownStore.subscribe(
    (s) => [s.cameraMode, s.focusTarget] as const,
    ([mode, focus], [prevMode]) => {
      if (!controls) return;
      if (mode === 'focus' && focus) {
        if (!saved.current) saved.current = { position: camera.position.clone(), target: controls.target.clone() };
        start(focusPose(focus, camera, controls.target), FOCUS_DURATION, easeInOutCubic, false);
      } else if (mode === 'orbit' && prevMode === 'focus' && saved.current) {
        const pose = saved.current;
        start(pose, FOCUS_DURATION, easeInOutCubic, false, () => { saved.current = null; });
      } else if (mode === 'walk') {
        tween.current = null;
        saved.current = null;
      }
    },
    { equalityFn: (a, b) => a[0] === b[0] && a[1]?.nonce === b[1]?.nonce },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [camera, controls]);

  useFrame((_, dt) => {
    const t = tween.current;
    if (!t || !controls) return;
    t.elapsed = Math.min(t.elapsed + Math.min(dt, 0.05), t.duration);
    const k = t.ease(t.elapsed / t.duration);
    camera.position.lerpVectors(t.fromPos, t.toPos, k);
    controls.target.lerpVectors(t.fromTgt, t.toTgt, k);
    controls.update();
    if (t.elapsed >= t.duration) {
      tween.current = null;
      if (useTownStore.getState().cameraMode !== 'walk') controls.enabled = true;
      t.onDone?.();
    }
    invalidate();
  });

  return null;
}
