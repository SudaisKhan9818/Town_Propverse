// ═══════════════════════════════════════════════════════════════════
// decor.ts — soft landscape placement (trees, park, benches).
//
// Belt trees keep the layout engine's positions exactly; only their
// scale / squash / hue get seeded variety. Park and civic trees are new
// dressing inside frozen parcels and never touch plots, roads or blocks.
// ═══════════════════════════════════════════════════════════════════

import { seeded } from '../materials/canvas-texture';
import { getTownData } from './layout-engine';
import { PARK_LAWN, PLAYGROUND_CENTER } from './park';
import { PLACEMENTS, fittedRect } from './unit-placement';
import { COMPLEX } from './gov-complex';

const TOWN = getTownData();

export interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  squash: number;
  /** Hue offset in turns (±0.08 ≈ ±8%). */
  hue: number;
  rotation: number;
}

/** Canopy radius of the procedural tree at scale 1 (see components/Trees.tsx). */
const CANOPY_RADIUS = 1.55;

function makeTree(rand: () => number, x: number, z: number, y = 0, sizeBias = 1): TreeInstance {
  return {
    x,
    y,
    z,
    scale: (0.85 + rand() * 0.45) * sizeBias,
    squash: 0.9 + rand() * 0.2,
    hue: (rand() - 0.5) * 0.16,
    rotation: rand() * Math.PI * 2,
  };
}

function buildTrees(): TreeInstance[] {
  const rand = seeded(42);
  const trees: TreeInstance[] = TOWN.trees.map((t) => makeTree(rand, t.position.x, t.position.z));

  // Park cluster: a loose ring around the lawn plus a grove in the NW corner.
  const parkTrees: Array<[number, number]> = [];
  const ringRand = seeded(9);
  const lawnHalfW = PARK_LAWN.w / 2 + 3.2;
  const lawnHalfD = PARK_LAWN.d / 2 + 3.2;
  for (let i = 0; i < 12; i += 1) {
    const t = i / 12;
    const perimeter = 2 * (lawnHalfW * 2 + lawnHalfD * 2);
    let s = t * perimeter + ringRand() * 2.5;
    let x: number;
    let z: number;
    if (s < lawnHalfW * 2) { x = -lawnHalfW + s; z = -lawnHalfD; }
    else if ((s -= lawnHalfW * 2) < lawnHalfD * 2) { x = lawnHalfW; z = -lawnHalfD + s; }
    else if ((s -= lawnHalfD * 2) < lawnHalfW * 2) { x = lawnHalfW - s; z = lawnHalfD; }
    else { s -= lawnHalfW * 2; x = -lawnHalfW; z = lawnHalfD - s; }
    parkTrees.push([PARK_LAWN.x + x, PARK_LAWN.z + z]);
  }
  parkTrees.push([PARK_LAWN.x - 20, PARK_LAWN.z - 9], [PARK_LAWN.x - 16, PARK_LAWN.z - 12], [PARK_LAWN.x - 22, PARK_LAWN.z - 4]);
  parkTrees.push([PLAYGROUND_CENTER.x - 1, PLAYGROUND_CENTER.z - 9.5], [PLAYGROUND_CENTER.x + 6.5, PLAYGROUND_CENTER.z + 8]);
  parkTrees.forEach(([x, z]) => trees.push(makeTree(rand, x, z, 0, 1.15)));

  // Government complex: 2–3 shade trees per lot (see gov-complex.ts).
  COMPLEX.trees.forEach(([x, z]) => trees.push(makeTree(rand, x, z, 0, 0.95)));
  return trees;
}

/**
 * Placement audit rule: a tree never clips a building. If a canopy
 * overlaps a fitted GLB footprint, the TREE is nudged along z (away from
 * the building) until clear — buildings never move.
 */
function clearOfBuildings(tree: TreeInstance): TreeInstance {
  const r = CANOPY_RADIUS * tree.scale + 0.3;
  let z = tree.z;
  for (const p of PLACEMENTS) {
    const b = fittedRect(p);
    const overlapsX = tree.x + r > b.minX && tree.x - r < b.maxX;
    if (!overlapsX || z + r <= b.minZ || z - r >= b.maxZ) continue;
    z = z < (b.minZ + b.maxZ) / 2 ? b.minZ - r : b.maxZ + r;
  }
  return z === tree.z ? tree : { ...tree, z };
}

const RAW_TREES = buildTrees();
export const TREES: TreeInstance[] = RAW_TREES.map(clearOfBuildings);


/** Gate planters: clipped trees standing in terracotta boxes. */
export const PLANTER_TREES: TreeInstance[] = [-11.2, 11.2].map((x) => ({
  x, y: 0.85, z: 93, scale: 0.55, squash: 1, hue: 0.02, rotation: x,
}));

export interface BenchInstance {
  x: number;
  z: number;
  rotation: number;
}

export const BENCHES: BenchInstance[] = [
  ...TOWN.benches.map((b) => ({ x: b.position.x, z: b.position.z, rotation: b.rotation })),
  { x: PARK_LAWN.x - 10, z: PARK_LAWN.z - PARK_LAWN.d / 2 - 1.3, rotation: 0 },
  { x: PARK_LAWN.x + 10, z: PARK_LAWN.z - PARK_LAWN.d / 2 - 1.3, rotation: 0 },
  { x: PARK_LAWN.x - 10, z: PARK_LAWN.z + PARK_LAWN.d / 2 + 1.3, rotation: Math.PI },
  { x: PARK_LAWN.x + 10, z: PARK_LAWN.z + PARK_LAWN.d / 2 + 1.3, rotation: Math.PI },
];
