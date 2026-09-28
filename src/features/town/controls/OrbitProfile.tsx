'use client';

// ═══════════════════════════════════════════════════════════════════
// OrbitProfile — the town's orbit feel in one place: damped, slightly
// slow rotate/pan, polar limits that never dip under the ground, and a
// custom wheel zoom.
//
// Why custom wheel zoom: drei's OrbitControls (three-stdlib) applies a
// FIXED zoom step per wheel event, so a trackpad (dozens of tiny events)
// zooms many times faster than a notched mouse (one big event). Here the
// wheel delta is normalised (deltaMode → px, clamped per event, pinch
// boosted), accumulated in log-space and eased out with deltaTime-based
// damping, zooming towards the ground point under the cursor.
// Touch pinch still uses OrbitControls' own dolly.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControlsImpl } from './types';
import { useTownStore } from '../store/town-store';

const ORBIT_PROFILE = {
  enableDamping: true,
  dampingFactor: 0.06,
  rotateSpeed: 0.55,
  zoomSpeed: 0.8,
  panSpeed: 0.7,
  minDistance: 15,
  maxDistance: 400,
  minPolarAngle: (15 * Math.PI) / 180,
  maxPolarAngle: (85 * Math.PI) / 180,
  zoomToCursor: true,
} as const;

const PX_PER_LINE = 16;
const PX_PER_PAGE = 800;
const MAX_WHEEL_PX = 60;          // clamp per event → mouse/trackpad parity
const PINCH_BOOST = 6;            // ctrlKey wheel = trackpad pinch
const LOG_ZOOM_PER_PX = 0.0022;   // × zoomSpeed
const ZOOM_EASE = 14;             // 1/s exponential ease-out

function normalizeWheelDelta(event: WheelEvent): number {
  let px = event.deltaY;
  if (event.deltaMode === 1) px *= PX_PER_LINE;
  else if (event.deltaMode === 2) px *= PX_PER_PAGE;
  if (event.ctrlKey) px *= PINCH_BOOST;
  return Math.sign(px) * Math.min(Math.abs(px), MAX_WHEEL_PX);
}

function WheelZoom({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { gl, camera, invalidate } = useThree();
  const pending = useRef(0);
  const anchor = useRef(new THREE.Vector3());
  const hasAnchor = useRef(false);

  useEffect(() => {
    const element = gl.domElement.parentElement ?? gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const onWheel = (event: WheelEvent) => {
      if (useTownStore.getState().cameraMode === 'walk') return;
      // Capture phase on the canvas wrapper: OrbitControls never sees it.
      event.preventDefault();
      event.stopPropagation();
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      hasAnchor.current = !!raycaster.ray.intersectPlane(ground, anchor.current);
      pending.current += normalizeWheelDelta(event) * LOG_ZOOM_PER_PX * ORBIT_PROFILE.zoomSpeed;
      invalidate();
    };
    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => element.removeEventListener('wheel', onWheel, { capture: true });
  }, [camera, gl, invalidate]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls || Math.abs(pending.current) < 1e-4) return;
    const step = pending.current * (1 - Math.exp(-ZOOM_EASE * Math.min(dt, 0.1)));
    pending.current -= step;
    const distance = camera.position.distanceTo(controls.target);
    const nextDistance = THREE.MathUtils.clamp(distance * Math.exp(step), ORBIT_PROFILE.minDistance, ORBIT_PROFILE.maxDistance);
    const scale = nextDistance / distance;
    if (Math.abs(scale - 1) < 1e-6) { pending.current = 0; return; }
    // Scale camera + target about the cursor's ground point: the point under
    // the cursor stays put and the view direction never changes.
    const pivot = hasAnchor.current && ORBIT_PROFILE.zoomToCursor ? anchor.current : controls.target;
    camera.position.sub(pivot).multiplyScalar(scale).add(pivot);
    controls.target.sub(pivot).multiplyScalar(scale).add(pivot);
    controls.target.y = Math.max(0, controls.target.y);
    controls.update();
    invalidate();
  });

  return null;
}

export default function OrbitProfile() {
  const ref = useRef<OrbitControlsImpl>(null);
  const mode = useTownStore((s) => s.cameraMode);

  return (
    <>
      <OrbitControls
        ref={ref}
        makeDefault
        {...ORBIT_PROFILE}
        enabled={mode !== 'walk'}
        enablePan={mode === 'orbit'}
      />
      <WheelZoom controlsRef={ref} />
    </>
  );
}
