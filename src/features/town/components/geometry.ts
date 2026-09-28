// geometry.ts — small BufferGeometry helpers for flat, world-UV-mapped
// surfaces. World UVs let one tiling texture run seamlessly across many
// rectangles merged into a single draw call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RectXZ {
  x: number;
  z: number;
  w: number;
  d: number;
}

type UvFn = (x: number, z: number) => [number, number];

/** Horizontal rectangle at height y, facing up, with UVs from `uv(x, z)`. */
function rectGeometry({ x, z, w, d }: RectXZ, y: number, uv: UvFn): THREE.BufferGeometry {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const corners: Array<[number, number]> = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(([cx, cz]) => [cx, y, cz]), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(corners.flatMap(() => [0, 1, 0]), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(corners.flatMap(([cx, cz]) => uv(cx, cz)), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

export function mergedRects(rects: RectXZ[], y: number, uv: UvFn): THREE.BufferGeometry {
  const parts = rects.map((r) => rectGeometry(r, y, uv));
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('mergedRects: empty input');
  merged.computeBoundingSphere();
  return merged;
}

/** Tiling UVs: one texture repeat every `metres`. */
export const worldUv = (metres: number): UvFn => (x, z) => [x / metres, -z / metres];

export { mergeGeometries };
