'use client';

// ═══════════════════════════════════════════════════════════════════
// WalkMode — first-person stroll through the town.
//
// Mechanics kept from the original: pointer-lock mouse look, WASD +
// Shift sprint, start from the current camera x/z at eye height, ESC
// (pointer unlock) exits, clamp to the stepped boundary, slide along
// blocked axes independently.
// Feel: velocity eases toward the input (accelerate / decelerate, no
// instant stops), 1.7m eye height, optional 0.02m head-bob, AABB
// collision against every building (fitted GLB footprints from
// data/unit-placement.ts), complex walls, streetlights and the median.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { PointerLockImpl } from './types';
import { GROUND_SIZE, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH, WALL_THICK } from '../data/town.config';
import { PLACEMENTS, fittedRect } from '../data/unit-placement';
import { COMPLEX } from '../data/gov-complex';
import { STREETLIGHT, STREET_LIGHTS, medianSegments } from '../data/streetlights';
import { useTownStore } from '../store/town-store';

const WALK = {
  eyeHeight: 1.7,
  radius: 0.7,
  speed: 6,
  sprint: 2.2,
  accel: 9,       // 1/s — how fast velocity reaches the input
  decel: 7,       // 1/s — how fast it coasts to a stop
  headBob: true,
  bobAmplitude: 0.02,
  bobFrequency: 1.9, // steps per metre-ish
} as const;

function collisionBoxes(): THREE.Box2[] {
  const r = WALK.radius;
  const box = (cx: number, cz: number, hw: number, hd: number) => new THREE.Box2(
    new THREE.Vector2(cx - hw - r, cz - hd - r),
    new THREE.Vector2(cx + hw + r, cz + hd + r),
  );
  // Every GLB building (houses, markets, masjids, civic) by its fitted
  // footprint, plus the government-complex walls.
  const boxes = PLACEMENTS.filter((p) => p.kind !== 'park').map((p) => {
    const f = fittedRect(p);
    return box((f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2, (f.maxX - f.minX) / 2, (f.maxZ - f.minZ) / 2);
  });
  COMPLEX.walls.forEach((w) => boxes.push(box(w.x, w.z, w.w / 2, w.d / 2)));
  // Streetlight poles and the boulevard median are solid too.
  STREET_LIGHTS.forEach((l) => boxes.push(box(l.x, l.z, 0.2, 0.2)));
  medianSegments().forEach((m) => boxes.push(box(m.x, (m.z0 + m.z1) / 2, STREETLIGHT.medianWidth / 2, (m.z1 - m.z0) / 2)));
  return boxes;
}

export default function WalkMode() {
  const enabled = useTownStore((s) => s.cameraMode === 'walk');
  const lockRequest = useTownStore((s) => s.walkLockRequest);
  const setWalkLocked = useTownStore((s) => s.setWalkLocked);
  const setCameraMode = useTownStore((s) => s.setCameraMode);
  const controlsRef = useRef<PointerLockImpl>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector2());
  const bobPhase = useRef(0);
  const orbitControls = useThree((s) => s.controls) as (THREE.EventDispatcher & { target: THREE.Vector3; update: () => void }) | null;
  const { camera, invalidate } = useThree();
  const blocks = useMemo(collisionBoxes, []);

  const blocked = useCallback((x: number, z: number) => blocks.some((b) => x >= b.min.x && x <= b.max.x && z >= b.min.y && z <= b.max.y), [blocks]);

  const clampToTown = useCallback((x: number, z: number): [number, number] => {
    const r = WALK.radius;
    const edge = GROUND_SIZE / 2 - WALL_THICK - r;
    const minX = LEFT_BOUND_X + WALL_THICK + r;
    const cx = THREE.MathUtils.clamp(x, minX, edge);
    const west = cx < 0;
    const cz = THREE.MathUtils.clamp(z, west ? LEFT_BOUND_Z_NORTH + WALL_THICK + r : -edge, west ? LEFT_BOUND_Z_SOUTH - WALL_THICK - r : edge);
    return [cx, cz];
  }, []);

  // Enter: eye height, near plane for close-ups, look toward the centre.
  useEffect(() => {
    if (!enabled) return;
    const cam = camera as THREE.PerspectiveCamera;
    const prevNear = cam.near;
    cam.near = 0.05;
    cam.updateProjectionMatrix();
    const [x, z] = clampToTown(camera.position.x, camera.position.z);
    pos.current.set(x, WALK.eyeHeight, z);
    // Never spawn inside a building: step toward the boulevard until clear.
    for (let i = 0; i < 400 && blocked(pos.current.x, pos.current.z); i += 1) {
      pos.current.x += pos.current.x > 0 ? -0.5 : 0.5;
    }
    velocity.current.set(0, 0);
    camera.position.copy(pos.current);
    const look = new THREE.Vector3(0, WALK.eyeHeight, 0);
    if (look.distanceToSquared(pos.current) < 4) look.set(pos.current.x, WALK.eyeHeight, pos.current.z - 1);
    camera.lookAt(look);
    invalidate();
    return () => {
      cam.near = prevNear;
      cam.updateProjectionMatrix();
      keys.current = {};
      // Hand back to orbit: look-at point 10m ahead on the ground.
      if (orbitControls) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();
        orbitControls.target.copy(camera.position).add(dir.multiplyScalar(10)).setY(0);
        orbitControls.update();
      }
      invalidate();
    };
  }, [blocked, camera, clampToTown, enabled, invalidate, orbitControls]);

  // Pointer lock needs the click that toggled walk mode (user gesture).
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => controlsRef.current?.lock());
    return () => cancelAnimationFrame(frame);
  }, [enabled, lockRequest]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (down: boolean) => (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keys.current[k] = down;
        event.preventDefault();
        invalidate();
      }
    };
    const down = onKey(true);
    const up = onKey(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [enabled, invalidate]);

  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const wish = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, rawDt) => {
    if (!enabled || !controlsRef.current?.isLocked) return;
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
    const s = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    wish.set(forward.x * f + right.x * s, forward.z * f + right.z * s);
    if (wish.lengthSq() > 1) wish.normalize();
    wish.multiplyScalar(WALK.speed * (k.shift ? WALK.sprint : 1));

    const rate = wish.lengthSq() > 0 ? WALK.accel : WALK.decel;
    velocity.current.lerp(wish, 1 - Math.exp(-rate * dt));
    const speed = velocity.current.length();
    if (speed < 0.01 && wish.lengthSq() === 0) {
      velocity.current.set(0, 0);
      return;
    }

    // Slide: resolve X and Z independently against walls and blocks.
    const [nx] = clampToTown(pos.current.x + velocity.current.x * dt, pos.current.z);
    if (!blocked(nx, pos.current.z)) pos.current.x = nx;
    else velocity.current.x = 0;
    const [, nz] = clampToTown(pos.current.x, pos.current.z + velocity.current.y * dt);
    if (!blocked(pos.current.x, nz)) pos.current.z = nz;
    else velocity.current.y = 0;

    let y = WALK.eyeHeight;
    if (WALK.headBob) {
      bobPhase.current += speed * dt * WALK.bobFrequency * Math.PI;
      y += Math.sin(bobPhase.current) * WALK.bobAmplitude * Math.min(1, speed / WALK.speed);
    }
    camera.position.set(pos.current.x, y, pos.current.z);
    invalidate();
  });

  if (!enabled) return null;
  return (
    <PointerLockControls
      ref={controlsRef}
      onChange={() => invalidate()}
      onLock={() => setWalkLocked(true)}
      onUnlock={() => {
        setWalkLocked(false);
        setCameraMode('orbit');
      }}
    />
  );
}
