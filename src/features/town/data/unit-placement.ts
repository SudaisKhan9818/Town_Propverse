// ═══════════════════════════════════════════════════════════════════
// unit-placement.ts — where every GLB unit goes, derived ONLY from the
// frozen layout + measured model bounds (model-manifest.json, written by
// scripts/compress-assets.mjs). Pure data: no React, no Three.js.
//
// The same fitToFootprint() runs at runtime inside <GlbUnit> against the
// loaded scene, so pick proxies, walk collision and the rendered
// buildings always agree.
// ═══════════════════════════════════════════════════════════════════

import type { CivicKind, UnitType } from '@/src/shared/types/town';
import { getTownData, type Plot } from './layout-engine';
import { GOV_COMPLEX, MODELS, UNIT_MARGIN, type ModelFront, type UnitModel } from './town.config';
import { PLAYGROUND_CENTER, PLAYGROUND_PAD } from './park';
import manifest from './model-manifest.json';

const TOWN = getTownData();

/** Yaw (radians about +Y) of each axis direction; +z = 0, +x = π/2. */
const FRONT_YAW: Record<ModelFront, number> = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };

export interface ModelBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Fit {
  /** Uniform scale applied to the model. */
  scale: number;
  /** Model-space offset that centres x/z and drops the base to y=0. */
  offset: [number, number, number];
  /** Fitted world-space footprint and height (after rotation + scale). */
  w: number;
  d: number;
  h: number;
}

/**
 * Uniform auto-fit: the model's rotated footprint is scaled to fit inside
 * the target footprint minus UNIT_MARGIN per side — never stretched.
 */
export function fitToFootprint(bounds: ModelBounds, target: { w: number; d: number }, rotationY: number, margin = UNIT_MARGIN): Fit {
  const sx = bounds.max[0] - bounds.min[0];
  const sy = bounds.max[1] - bounds.min[1];
  const sz = bounds.max[2] - bounds.min[2];
  const quarter = Math.abs(Math.sin(rotationY)) > 0.5;
  const ew = quarter ? sz : sx;
  const ed = quarter ? sx : sz;
  const scale = Math.min((target.w - margin * 2) / ew, (target.d - margin * 2) / ed);
  return {
    scale,
    offset: [-(bounds.min[0] + bounds.max[0]) / 2, -bounds.min[1], -(bounds.min[2] + bounds.max[2]) / 2],
    w: ew * scale,
    d: ed * scale,
    h: sy * scale,
  };
}

/** Rotation that turns the model's measured front toward `facingYaw`. */
const rotationFor = (model: UnitModel, facingYaw: number) => facingYaw - FRONT_YAW[model.front];

export type PlacementKind = 'house' | 'civic' | 'park';

export interface UnitPlacement {
  unitId: string;
  unitType: UnitType;
  kind: PlacementKind;
  civicKind?: CivicKind;
  model: UnitModel;
  position: { x: number; z: number };
  /** Frozen footprint the model is fitted into. */
  footprint: { w: number; d: number };
  rotationY: number;
  fit: Fit;
  /** Clearance kept inside the footprint, per side (m). */
  margin: number;
  /** Distance (m) beyond which LOD1 renders. */
  lodDistance: number;
}

type ManifestEntry = { bbox: ModelBounds };
const MANIFEST = manifest.models as unknown as Record<string, ManifestEntry>;

function boundsFor(model: UnitModel): ModelBounds {
  const key = model.url.split('/').pop()!.replace(/\.glb$/, '');
  const entry = MANIFEST[key];
  if (!entry) throw new Error(`model-manifest.json has no entry for ${key} — run scripts/compress-assets.mjs`);
  return entry.bbox;
}

const HOUSE_MODEL: Record<Plot['size'], UnitModel> = {
  '5marla': MODELS.houses['5M'],
  '7marla': MODELS.houses['7M'],
  '12marla': MODELS.houses['12M'],
};

/** Residential rows face their street: north-row units face +z, south-row −z. */
const yawTowardZ = (fromZ: number, toZ: number) => (toZ > fromZ ? 0 : Math.PI);

const RESIDENTIAL_STREETS = TOWN.streets.filter((s) => s.id === 'street-1' || s.id === 'street-2');
const nearestStreetZ = (z: number) => RESIDENTIAL_STREETS
  .reduce((best, s) => (Math.abs(s.position.z - z) < Math.abs(best - z) ? s.position.z : best), RESIDENTIAL_STREETS[0].position.z);

/**
 * Civic entrances: school (south) and hospital (north) face each other
 * across the School–Hospital connector; the government complex faces
 * Civic Road 2 (north).
 */
const CIVIC_FACING: Record<Exclude<CivicKind, 'market' | 'masjid' | 'park'>, number> = {
  school: 0,
  hospital: Math.PI,
  police: Math.PI,
  fire: Math.PI,
  wapda: Math.PI,
};

function place(
  base: Omit<UnitPlacement, 'rotationY' | 'fit' | 'lodDistance' | 'margin'>,
  facingYaw: number,
  margin = UNIT_MARGIN,
): UnitPlacement {
  const rotationY = rotationFor(base.model, facingYaw);
  const fit = fitToFootprint(boundsFor(base.model), base.footprint, rotationY, margin);
  return { ...base, rotationY, fit, margin, lodDistance: Math.max(70, Math.max(fit.w, fit.d) * 1.6) };
}

function buildPlacements(): UnitPlacement[] {
  const houses = TOWN.plots.map((plot) => {
    const street = TOWN.streets.find((s) => s.id === plot.streetId)!;
    return place({
      unitId: plot.id,
      unitType: 'plot',
      kind: 'house',
      model: HOUSE_MODEL[plot.size],
      position: plot.position,
      footprint: plot.bounds,
    }, yawTowardZ(plot.position.z, street.position.z));
  });
  const amenities = TOWN.amenities.map((a) => place({
    unitId: a.id,
    unitType: 'civic',
    kind: 'civic',
    civicKind: a.type,
    model: a.type === 'market' ? MODELS.market : MODELS.masjid,
    position: a.position,
    footprint: a.bounds,
  }, yawTowardZ(a.position.z, nearestStreetZ(a.position.z))));
  const civic = TOWN.civic.filter((c) => c.type !== 'park').map((c) => {
    const type = c.type as keyof typeof CIVIC_FACING;
    // Government-complex buildings sit behind their lot's parking court.
    const complex = type === 'police' || type === 'fire' || type === 'wapda' ? GOV_COMPLEX.buildings[type] : null;
    return place({
      unitId: c.id,
      unitType: 'civic',
      kind: 'civic',
      civicKind: c.type,
      model: MODELS.civic[type],
      position: complex
        ? { x: c.position.x, z: GOV_COMPLEX.zFront + GOV_COMPLEX.parkingDepth + complex.d / 2 }
        : c.position,
      footprint: complex ?? c.bounds,
    }, CIVIC_FACING[type]);
  });
  const park = TOWN.civic.find((c) => c.type === 'park')!;
  const playground = place({
    unitId: park.id,
    unitType: 'civic',
    kind: 'park',
    civicKind: 'park',
    model: MODELS.park.playground,
    position: PLAYGROUND_CENTER,
    footprint: PLAYGROUND_PAD,
  }, 0, 0.8);
  return [...civic, ...amenities, playground, ...houses];
}

export const PLACEMENTS: UnitPlacement[] = buildPlacements();
export const HOUSE_PLACEMENTS = PLACEMENTS.filter((p) => p.kind === 'house');
/** Civic blocks, markets, masjids and the park playground (reveal stage 2). */
export const CIVIC_PLACEMENTS = PLACEMENTS.filter((p) => p.kind !== 'house');

/** Fitted building rectangle in world space (axis-aligned; rotations are 90° steps). */
export function fittedRect(p: UnitPlacement) {
  return { minX: p.position.x - p.fit.w / 2, maxX: p.position.x + p.fit.w / 2, minZ: p.position.z - p.fit.d / 2, maxZ: p.position.z + p.fit.d / 2 };
}

export interface PlacementAudit {
  unitId: string;
  insideFootprint: boolean;
  clearOfRoads: boolean;
  facesStreet: boolean;
  margin: number;
}

/**
 * Every unit: fitted building inside its frozen footprint (≥ margin),
 * clear of every road, and front rotated toward its street/road.
 */
export function auditPlacements(): { pass: boolean; results: PlacementAudit[] } {
  const roads = TOWN.streets.map((s) => (s.orientation === 'NS'
    ? { minX: s.position.x - s.width / 2, maxX: s.position.x + s.width / 2, minZ: s.position.z - s.length / 2, maxZ: s.position.z + s.length / 2 }
    : { minX: s.position.x - s.length / 2, maxX: s.position.x + s.length / 2, minZ: s.position.z - s.width / 2, maxZ: s.position.z + s.width / 2 }));
  const results = PLACEMENTS.map((p) => {
    const r = fittedRect(p);
    const f = { minX: p.position.x - p.footprint.w / 2, maxX: p.position.x + p.footprint.w / 2, minZ: p.position.z - p.footprint.d / 2, maxZ: p.position.z + p.footprint.d / 2 };
    const margin = Math.min(r.minX - f.minX, f.maxX - r.maxX, r.minZ - f.minZ, f.maxZ - r.maxZ);
    const clearOfRoads = roads.every((road) => r.maxX <= road.minX || r.minX >= road.maxX || r.maxZ <= road.minZ || r.minZ >= road.maxZ);
    // Front direction after rotation must point at ±z toward the street (or chosen civic road).
    const frontYaw = FRONT_YAW[p.model.front] + p.rotationY;
    const expected = p.kind === 'house'
      ? yawTowardZ(p.position.z, TOWN.streets.find((s) => s.id === TOWN.plots.find((pl) => pl.id === p.unitId)!.streetId)!.position.z)
      : p.kind === 'park' ? 0
        : p.civicKind === 'market' || p.civicKind === 'masjid'
          ? yawTowardZ(p.position.z, nearestStreetZ(p.position.z))
          : CIVIC_FACING[p.civicKind as keyof typeof CIVIC_FACING];
    const facesStreet = Math.abs(Math.cos(frontYaw - expected) - 1) < 1e-6;
    return { unitId: p.unitId, insideFootprint: margin >= -1e-6, clearOfRoads, facesStreet, margin: +margin.toFixed(2) };
  });
  return { pass: results.every((r) => r.insideFootprint && r.clearOfRoads && r.facesStreet), results };
}
