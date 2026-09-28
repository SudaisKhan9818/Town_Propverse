'use client';

// Ground.tsx — town soil (one 2048px radial-gradient texture stretched over
// the frozen town outline) + outer land that dissolves into the fog.

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { BOULEVARD_WIDTH, GROUND_SIZE, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH } from '../data/town.config';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawGround, drawOuterLand } from '../materials/textures';
import { SURFACE } from '../materials/palette';
import { mergedRects, worldUv } from './geometry';

const HALF = GROUND_SIZE / 2;
// Texture window covering the whole town outline (x: −93…90, z: −90…90).
const TEX_MIN_X = LEFT_BOUND_X - 1;
const TEX_MIN_Z = -HALF - 2;
const TEX_SIZE = HALF - TEX_MIN_X + 1;

interface Props {
  onEmptyClick: (event: ThreeEvent<MouseEvent>) => void;
}

export default function Ground({ onEmptyClick }: Props) {
  const soil = useCanvasTexture('town-ground', drawGround, 2048);
  const outer = useCanvasTexture('outer-land', drawOuterLand, 512, { repeat: [1, 1] });

  const townGeometry = useMemo(() => mergedRects([
    // East half: boulevard centre → east wall, full depth.
    { x: HALF / 2, z: 0, w: HALF, d: GROUND_SIZE },
    // West half: tight residential block inside the stepped wall.
    { x: LEFT_BOUND_X / 2, z: 0, w: -LEFT_BOUND_X, d: LEFT_BOUND_Z_SOUTH - LEFT_BOUND_Z_NORTH },
    // Boulevard corridor west of the centre line (north + south arms).
    { x: -BOULEVARD_WIDTH / 4, z: (LEFT_BOUND_Z_NORTH - HALF) / 2, w: BOULEVARD_WIDTH / 2, d: HALF + LEFT_BOUND_Z_NORTH },
    { x: -BOULEVARD_WIDTH / 4, z: (LEFT_BOUND_Z_SOUTH + HALF) / 2, w: BOULEVARD_WIDTH / 2, d: HALF - LEFT_BOUND_Z_SOUTH },
  ], 0, (x, z) => [(x - TEX_MIN_X) / TEX_SIZE, 1 - (z - TEX_MIN_Z) / TEX_SIZE]), []);

  const outerGeometry = useMemo(() => {
    const geometry = new THREE.CircleGeometry(1400, 48);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const map = worldUv(36);
    for (let i = 0; i < pos.count; i += 1) {
      const [u, v] = map(pos.getX(i), pos.getZ(i));
      uv.setXY(i, u, v);
    }
    return geometry;
  }, []);

  return (
    <group>
      <mesh geometry={outerGeometry} position={[0, -0.05, 0]} receiveShadow onClick={onEmptyClick}>
        <meshStandardMaterial map={outer} {...SURFACE.ground} />
      </mesh>
      <mesh geometry={townGeometry} receiveShadow onClick={onEmptyClick}>
        <meshStandardMaterial map={soil} {...SURFACE.ground} />
      </mesh>
    </group>
  );
}
