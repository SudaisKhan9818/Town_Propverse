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
  const { camera, invalidate } = useThree();

  const blocks = useMemo(() => {
    const footprints = [
      ...TOWN.amenities.map((a) => ({ cx: a.position.x, cz: a.position.z, hw: a.bounds.w / 2, hd: a.bounds.d / 2 })),
      ...TOWN.civic.map((c) => ({ cx: c.position.x, cz: c.position.z, hw: c.bounds.w / 2, hd: c.bounds.d / 2 })),
    ];
    return footprints.map(({ cx, cz, hw, hd }) => new THREE.Box2(
      new THREE.Vector2(cx - hw, cz - hd),
      new THREE.Vector2(cx + hw, cz + hd),
    ));
  }, []);

  const inBlock = useCallback((px: number, pz: number) => blocks.some((box) =>
    px >= box.min.x - PLAYER_RADIUS && px <= box.max.x + PLAYER_RADIUS &&
    pz >= box.min.y - PLAYER_RADIUS && pz <= box.max.y + PLAYER_RADIUS,
  ), [blocks]);

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
    if (!inBlock(bx, p.z)) p.x = bx;
    if (!inBlock(p.x, bz)) p.z = bz;
    p.y = PLAYER_HEIGHT;
    camera.position.copy(p);
  }, [camera, inBlock]);


  const onKey = useCallback((e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (['w','a','s','d','shift'].includes(k)) { keyRef.current[k] = down; e.preventDefault(); }
    if (e.key === 'Escape') onLockChange?.(false);
  }, [onLockChange]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [onKey]);

  useEffect(() => {
    if (enabled) {
      posRef.current.copy(camera.position);
      const half = GROUND_SIZE / 2 - WALL_THICK - PLAYER_RADIUS;
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -half, half);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -half, half);
      posRef.current.y = PLAYER_HEIGHT;
      camera.position.copy(posRef.current);
      const lookTarget = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
      if (lookTarget.distanceToSquared(posRef.current) < 4) lookTarget.set(posRef.current.x, PLAYER_HEIGHT, posRef.current.z - 1);
      camera.lookAt(lookTarget);
      invalidate();
    } else {
      keyRef.current = Object.create(null);
    }
  }, [camera, enabled, invalidate]);

  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => controlsRef.current?.lock());
    return () => cancelAnimationFrame(frame);
  }, [enabled, lockRequest]);

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
    const direction = fwdRef.current.multiplyScalar(forward).add(rightRef.current.multiplyScalar(sideways));
    if (direction.lengthSq() > 1) direction.normalize();
    direction.multiplyScalar(12 * (k.shift ? 2 : 1) * Math.min(delta, 0.05));
    tryMove(direction.x, direction.z);
    invalidate();
  });

  if (!enabled) return null;
  return (
    <PointerLockControls ref={controlsRef} makeDefault
      onLock={() => onLockChange?.(true)} onUnlock={() => onLockChange?.(false)} />
  );
}
