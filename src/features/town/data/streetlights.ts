// ═══════════════════════════════════════════════════════════════════
// streetlights.ts — procedural streetlight layout (pure data).
//
// Rules
//   • Every road, both edges, every STREETLIGHT_SPACING metres. Poles sit
//     ON the curb line (centre 0.15m road-side of the edge), so they align
//     with the road edge and can never stand inside a plot or lot.
//   • Main roads (width > 10m — the boulevard) also get a central median
//     with double-arm poles.
//   • A position is skipped if it falls inside a junction, within reach of
//     the boundary wall / main gate, too close to a tree, or overlapping any
//     plot, building footprint or civic lot.
//   • IDs are stable and sequential (LIGHT_001 …) for digital-twin mapping.
// ═══════════════════════════════════════════════════════════════════

import { getTownData } from './layout-engine';
import { GATE_WIDTH, GROUND_SIZE, STREETLIGHT_SPACING } from './town.config';
import { TREES } from './decor';
import { PARK_PARCEL } from './park';
import { PLACEMENTS, fittedRect } from './unit-placement';

const TOWN = getTownData();

export const STREETLIGHT = {
  spacing: STREETLIGHT_SPACING,
  /** Pole centre, measured from the road edge toward the road (curb is ±0.175). */
  curbInset: 0.15,
  /** Base radius — pole + inset keep the whole base on the road side of the edge. */
  poleRadius: 0.11,
  /** Clearance to junctions, walls and ends of roads (m). */
  endClearance: 4,
  junctionClearance: 2,
  treeClearance: 2.4,
  mainRoadWidth: 10,
  medianWidth: 1.4,
} as const;

export interface StreetLight {
  id: string;
  x: number;
  z: number;
  /** Yaw so the lamp arm (+x local) reaches over the road. */
  rotationY: number;
  kind: 'edge' | 'median';
  roadId: string;
}

interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

const roadRect = (s: (typeof TOWN.streets)[number]): Rect => (s.orientation === 'NS'
  ? { minX: s.position.x - s.width / 2, maxX: s.position.x + s.width / 2, minZ: s.position.z - s.length / 2, maxZ: s.position.z + s.length / 2 }
  : { minX: s.position.x - s.length / 2, maxX: s.position.x + s.length / 2, minZ: s.position.z - s.width / 2, maxZ: s.position.z + s.width / 2 });

const inside = (r: Rect, x: number, z: number, pad = 0) => x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;

/** Everything a pole must never overlap. */
function obstacles(): Rect[] {
  const rect = (x: number, z: number, w: number, d: number): Rect => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return [
    ...TOWN.plots.map((p) => rect(p.position.x, p.position.z, p.bounds.w, p.bounds.d)),
    ...TOWN.amenities.map((a) => rect(a.position.x, a.position.z, a.bounds.w, a.bounds.d)),
    ...TOWN.civic.filter((c) => c.type !== 'park').map((c) => rect(c.position.x, c.position.z, c.bounds.w, c.bounds.d)),
    rect(PARK_PARCEL.x, PARK_PARCEL.z, PARK_PARCEL.w, PARK_PARCEL.d),
    ...PLACEMENTS.map(fittedRect),
  ];
}

/** Boulevard median segments (between junctions) — rendered by <StreetLights>. */
export function medianSegments(): Array<{ x: number; z0: number; z1: number }> {
  const segments: Array<{ x: number; z0: number; z1: number }> = [];
  TOWN.streets.filter((s) => s.orientation === 'NS' && s.width > STREETLIGHT.mainRoadWidth).forEach((road) => {
    const r = roadRect(road);
    const gaps = TOWN.streets.filter((s) => s.orientation === 'EW')
      .map(roadRect)
      .filter((cross) => cross.maxX >= r.minX - 0.5 && cross.minX <= r.maxX + 0.5)
      .map((cross) => [cross.minZ - STREETLIGHT.junctionClearance, cross.maxZ + STREETLIGHT.junctionClearance] as const)
      .sort((a, b) => a[0] - b[0]);
    let start = r.minZ + STREETLIGHT.endClearance;
    const end = r.maxZ - STREETLIGHT.endClearance - 6; // stop short of the gate
    for (const [g0, g1] of [...gaps, [end, end] as const]) {
      if (g0 - start > 4) segments.push({ x: road.position.x, z0: start, z1: Math.min(g0, end) });
      start = Math.max(start, g1);
    }
  });
  return segments;
}

export function generateStreetLights(): StreetLight[] {
  const blocked = obstacles();
  const roads = TOWN.streets.map((s) => ({ s, r: roadRect(s) }));
  const half = GROUND_SIZE / 2;
  const gate = { minX: -GATE_WIDTH / 2 - 4, maxX: GATE_WIDTH / 2 + 4, minZ: half - 8, maxZ: half + 4 };
  const lights: Omit<StreetLight, 'id'>[] = [];

  const clear = (x: number, z: number, ownRoad: string) => {
    const r = STREETLIGHT.poleRadius;
    if (inside(gate, x, z)) return false;
    if (Math.abs(x) > half - STREETLIGHT.endClearance || Math.abs(z) > half - STREETLIGHT.endClearance) return false;
    // Junctions: never inside (or at the mouth of) another road.
    if (roads.some(({ s, r: rr }) => s.id !== ownRoad && inside(rr, x, z, STREETLIGHT.junctionClearance))) return false;
    if (blocked.some((b) => inside(b, x, z, r))) return false;
    if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < STREETLIGHT.treeClearance)) return false;
    return true;
  };

  roads.forEach(({ s, r }) => {
    const alongX = s.orientation === 'EW';
    const from = (alongX ? r.minX : r.minZ) + STREETLIGHT.endClearance;
    const to = (alongX ? r.maxX : r.maxZ) - STREETLIGHT.endClearance;
    const count = Math.floor((to - from) / STREETLIGHT.spacing);
    const start = (from + to) / 2 - (count * STREETLIGHT.spacing) / 2;
    for (let i = 0; i <= count; i += 1) {
      const t = start + i * STREETLIGHT.spacing;
      for (const side of [-1, 1]) {
        // Edge line, pole centre nudged onto the curb (road side).
        const edge = alongX ? (side < 0 ? r.minZ : r.maxZ) : (side < 0 ? r.minX : r.maxX);
        const c = edge - side * STREETLIGHT.curbInset;
        const [x, z] = alongX ? [t, c] : [c, t];
        if (!clear(x, z, s.id)) continue;
        // Arm reaches toward the road centre: direction −side along the normal.
        const [dx, dz] = alongX ? [0, -side] : [-side, 0];
        lights.push({ x, z, rotationY: Math.atan2(-dz, dx), kind: 'edge', roadId: s.id });
      }
    }
  });

  medianSegments().forEach((seg) => {
    const count = Math.floor((seg.z1 - seg.z0) / STREETLIGHT.spacing);
    const start = (seg.z0 + seg.z1) / 2 - (count * STREETLIGHT.spacing) / 2;
    for (let i = 0; i <= count; i += 1) {
      const z = start + i * STREETLIGHT.spacing;
      lights.push({ x: seg.x, z, rotationY: 0, kind: 'median', roadId: 'boulevard' });
    }
  });

  return lights.map((l, i) => ({ ...l, id: `LIGHT_${String(i + 1).padStart(3, '0')}` }));
}

export const STREET_LIGHTS: StreetLight[] = generateStreetLights();
