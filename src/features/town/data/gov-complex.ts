// ═══════════════════════════════════════════════════════════════════
// gov-complex.ts — landscaping for the Police · Fire · WAPDA government
// complex (pure data; rendered by components/GovComplex.tsx).
//
// Per lot: low boundary wall with an entrance gap on Civic Road 2, gate
// posts, a front parking court with bay lines, box hedges, sage lawns
// beside/behind the building and 2–3 shade trees (added to TREES by
// decor.ts so they share the single tree draw call).
// The town's own boundary wall closes the lots at the back and east.
// ═══════════════════════════════════════════════════════════════════

import { getTownData } from './layout-engine';
import { GOV_COMPLEX, GROUND_SIZE } from './town.config';
import { PLACEMENTS, fittedRect } from './unit-placement';
import type { RectXZ } from '../components/geometry';

const TOWN = getTownData();
const EDGE = GROUND_SIZE / 2;

export const COMPLEX_DIMENSIONS = {
  wallH: 1.1,
  wallT: 0.25,
  gateGap: 7,
  hedgeH: 0.9,
  hedgeT: 0.8,
  bayW: 2.6,
  bayD: 5,
} as const;

export interface Box { x: number; y: number; z: number; w: number; h: number; d: number }

export interface ComplexLot {
  id: string;
  x0: number;
  x1: number;
  building: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const COMPLEX_LOTS: ComplexLot[] = (['police', 'fire', 'wapda'] as const).map((type) => {
  const civic = TOWN.civic.find((c) => c.type === type)!;
  const placement = PLACEMENTS.find((p) => p.unitId === civic.id)!;
  return { id: civic.id, ...GOV_COMPLEX.lots[type], building: fittedRect(placement) };
});

function buildComplex() {
  const D = COMPLEX_DIMENSIONS;
  const { zFront, zBack, parkingDepth } = GOV_COMPLEX;
  const walls: Box[] = [];
  const posts: Box[] = [];
  const hedges: Box[] = [];
  const parking: RectXZ[] = [];
  const bayLines: Box[] = [];
  const lawns: RectXZ[] = [];
  const trees: Array<[number, number]> = [];
  const wall = (x0: number, z0: number, x1: number, z1: number) => walls.push({
    x: (x0 + x1) / 2, y: D.wallH / 2, z: (z0 + z1) / 2,
    w: Math.max(D.wallT, Math.abs(x1 - x0)), h: D.wallH, d: Math.max(D.wallT, Math.abs(z1 - z0)),
  });
  const hedge = (x0: number, z0: number, x1: number, z1: number) => {
    if (Math.abs(x1 - x0) < 1 && Math.abs(z1 - z0) < 1) return;
    hedges.push({ x: (x0 + x1) / 2, y: D.hedgeH / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), h: D.hedgeH, d: Math.abs(z1 - z0) });
  };

  COMPLEX_LOTS.forEach((lot) => {
    const cx = (lot.x0 + lot.x1) / 2;
    const g0 = cx - D.gateGap / 2;
    const g1 = cx + D.gateGap / 2;
    const b = lot.building;
    // Boundary: front wall split by the entrance, side walls (not where the
    // town wall already stands).
    wall(lot.x0, zFront, g0, zFront);
    wall(g1, zFront, lot.x1, zFront);
    wall(lot.x0, zFront, lot.x0, zBack);
    if (lot.x1 < EDGE - 1) wall(lot.x1, zFront, lot.x1, zBack);
    for (const x of [g0, g1]) posts.push({ x, y: 0.8, z: zFront, w: 0.55, h: 1.6, d: 0.55 });

    // Front hedges either side of the entrance, then the parking court.
    const hz0 = zFront + 0.5;
    const hz1 = hz0 + D.hedgeT;
    hedge(lot.x0 + 0.5, hz0, g0 - 0.6, hz1);
    hedge(g1 + 0.6, hz0, lot.x1 - 0.5, hz1);
    const pz0 = hz1 + 0.6;
    const pz1 = zFront + parkingDepth - 0.3;
    parking.push({ x: cx, z: (pz0 + pz1) / 2, w: lot.x1 - lot.x0 - 1.4, d: pz1 - pz0 });
    // Bays along the back of the court, facing the building; the middle
    // bay pair stays open as the drive to the entrance.
    const bays = Math.floor((lot.x1 - lot.x0 - 2) / D.bayW);
    const bx0 = cx - (bays * D.bayW) / 2;
    for (let i = 0; i <= bays; i += 1) {
      const x = bx0 + i * D.bayW;
      if (Math.abs(x - cx) < D.bayW * 0.9) continue;
      bayLines.push({ x, y: 0.035, z: pz1 - D.bayD / 2, w: 0.14, h: 0.01, d: D.bayD });
    }

    // Gardens: side lawns beside the building, rear lawn behind it,
    // hedges lining the side walls.
    const gz0 = zFront + parkingDepth + 0.4;
    const gz1 = zBack - 0.9;
    if (b.minX - lot.x0 > 2) lawns.push({ x: (lot.x0 + b.minX) / 2, z: (gz0 + b.maxZ) / 2, w: b.minX - lot.x0 - 1.2, d: b.maxZ - gz0 });
    if (lot.x1 - b.maxX > 2) lawns.push({ x: (b.maxX + lot.x1) / 2, z: (gz0 + b.maxZ) / 2, w: lot.x1 - b.maxX - 1.2, d: b.maxZ - gz0 });
    if (gz1 - b.maxZ > 3) lawns.push({ x: cx, z: (b.maxZ + 1 + gz1) / 2, w: lot.x1 - lot.x0 - 1.6, d: gz1 - b.maxZ - 1 });
    hedge(lot.x0 + 0.35, gz0, lot.x0 + 0.35 + 0.6, gz1);
    if (lot.x1 < EDGE - 1) hedge(lot.x1 - 0.95, gz0, lot.x1 - 0.35, gz1);

    // Shade trees: rear corners, plus one beside the building if it fits.
    if (gz1 - b.maxZ > 5) {
      trees.push([lot.x0 + 3.2, gz1 - 2.6], [lot.x1 - 3.2, gz1 - 2.6]);
    }
    const side = b.minX - lot.x0 > lot.x1 - b.maxX ? (lot.x0 + b.minX) / 2 : (b.maxX + lot.x1) / 2;
    if (Math.max(b.minX - lot.x0, lot.x1 - b.maxX) > 5) trees.push([side, (gz0 + b.maxZ) / 2]);
  });

  return { walls, posts, hedges, parking, bayLines, lawns, trees };
}

export const COMPLEX = buildComplex();
