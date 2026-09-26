'use client';
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { getTownData } from './layout-engine';
import { GROUND_SIZE, WALL_THICK, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH } from './town.config';

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.7;
const TOWN = getTownData();

interface Props {
  enabled: boolean;
  lockRequest: number;
  onLockChange?: (locked: boolean) => void;
}

export default function WalkMode({ enabled, lockRequest, onLockChange }: Props) {
  const controlsRef = useRef<any>(null);
  const posRef = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 35));
  const fwdRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const keyRef = useRef(Object.create(null));
  const { camera, gl, scene, invalidate } = useThree();

  // ── Camera settings for walk mode ──
  useEffect(() => {
    if (!enabled) return;
    const previousNear = camera.near;
    const previousFar = camera.far;
    // Wider far plane so distant roads/buildings never clip during walk
    camera.near = 0.05;
    camera.far = 600;
    camera.updateProjectionMatrix();

    const previousPixelRatio = gl.getPixelRatio();
    const previousToneMapping = gl.toneMapping;
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    gl.toneMapping = THREE.ACESFilmicToneMapping;

    // Reduce fog density while walking so distant geometry stays visible
    const fog = scene.fog as THREE.FogExp2 | null;
    const previousFogDensity = fog instanceof THREE.FogExp2 ? fog.density : null;
    if (fog instanceof THREE.FogExp2) fog.density = 0.006;

    invalidate();
    return () => {
      camera.near = previousNear;
      camera.far = previousFar;
      camera.updateProjectionMatrix();
      gl.setPixelRatio(previousPixelRatio);
      gl.toneMapping = previousToneMapping;
      if (fog instanceof THREE.FogExp2 && previousFogDensity !== null) {
        fog.density = previousFogDensity;
      }
      invalidate();
    };
  }, [enabled, gl, scene, invalidate, camera]);

  // ── Building collision blocks ──
  const blocks = useMemo(() => {
    const footprints = [
      ...TOWN.amenities.map((a) => ({ cx: a.position.x, cz: a.position.z, hw: a.bounds.w / 2, hd: a.bounds.d / 2 })),
      ...TOWN.civic.map((c) => ({ cx: c.position.x, cz: c.position.z, hw: c.bounds.w / 2, hd: c.bounds.d / 2 })),
    ];
    return footprints.map(({ cx, cz, hw, hd }) => new THREE.Box2(
      new THREE.Vector2(cx - hw - PLAYER_RADIUS, cz - hd - PLAYER_RADIUS),
      new THREE.Vector2(cx + hw + PLAYER_RADIUS, cz + hd + PLAYER_RADIUS),
    ));
  }, []);

  const inBlock = useCallback((px: number, pz: number) =>
    blocks.some((box) => px >= box.min.x && px <= box.max.x && pz >= box.min.y && pz <= box.max.y),
  [blocks]);

  const tryMove = useCallback((dx: number, dz: number) => {
    const p = posRef.current;
    const rightMaxX = GROUND_SIZE / 2 - WALL_THICK - PLAYER_RADIUS;
    const rightMaxZ = GROUND_SIZE / 2 - WALL_THICK - PLAYER_RADIUS;
    const leftMinX = LEFT_BOUND_X + WALL_THICK + PLAYER_RADIUS;
    const leftMinZ = LEFT_BOUND_Z_NORTH + WALL_THICK + PLAYER_RADIUS;
    const leftMaxZ = LEFT_BOUND_Z_SOUTH - WALL_THICK - PLAYER_RADIUS;

    const nx = p.x + dx;
    const nz = p.z + dz;

    const minX = leftMinX;
    const maxX = rightMaxX;
    const minZ = nx < 0 ? leftMinZ : -rightMaxZ;
    const maxZ = nx < 0 ? leftMaxZ : rightMaxZ;

    const bx = THREE.MathUtils.clamp(nx, minX, maxX);
    const bz = THREE.MathUtils.clamp(nz, minZ, maxZ);

    // Slide along walls: try X and Z independently
    if (!inBlock(bx, p.z)) p.x = bx;
    if (!inBlock(p.x, bz)) p.z = bz;
    p.y = PLAYER_HEIGHT;
    camera.position.copy(p);
  }, [camera, inBlock]);

  const onKey = useCallback((e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'shift'].includes(k)) { keyRef.current[k] = down; e.preventDefault(); }
    if (e.key === 'Escape' && down) onLockChange?.(false);
  }, [onLockChange]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onKey]);

  // ── On enable: snap camera to valid walk start position ──
  useEffect(() => {
    if (enabled) {
      // Start from current camera position but at player height
      posRef.current.copy(camera.position);
      // Clamp into the right-side ground (safe start zone)
      const half = GROUND_SIZE / 2 - WALL_THICK - PLAYER_RADIUS;
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -half, half);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -half, half);
      posRef.current.y = PLAYER_HEIGHT;
      camera.position.copy(posRef.current);

      // Look toward town center
      const lookTarget = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
      if (lookTarget.distanceToSquared(posRef.current) < 4) {
        lookTarget.set(posRef.current.x, PLAYER_HEIGHT, posRef.current.z - 1);
      }
      camera.lookAt(lookTarget);
      camera.updateProjectionMatrix();
      invalidate();
    } else {
      // Clear all keys when disabling
      keyRef.current = Object.create(null);
    }
  }, [camera, enabled, invalidate]);

  // ── Pointer lock: request lock when walk mode activates ──
  useEffect(() => {
    if (!enabled) return;
    // Small delay so the DOM is ready
    const frame = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => controlsRef.current?.lock());
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, lockRequest]);

  // ── Movement loop ──
  useFrame((_, delta) => {
    if (!enabled || !controlsRef.current?.isLocked) return;
    const k = keyRef.current;
    const forward = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    const sideways = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (!forward && !sideways) return;

    camera.getWorldDirection(fwdRef.current);
    fwdRef.current.y = 0;
    fwdRef.current.normalize();
    rightRef.current.crossVectors(fwdRef.current, new THREE.Vector3(0, 1, 0)).normalize();

    const speed = 12 * (k.shift ? 2.2 : 1) * Math.min(delta, 0.05);
    const direction = fwdRef.current.clone().multiplyScalar(forward)
      .add(rightRef.current.clone().multiplyScalar(sideways));
    if (direction.lengthSq() > 1) direction.normalize();
    direction.multiplyScalar(speed);

    tryMove(direction.x, direction.z);
    invalidate();
  });

  if (!enabled) return null;
  return (
    <PointerLockControls
      ref={controlsRef}
      makeDefault
      onChange={() => invalidate()}
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  );
}
