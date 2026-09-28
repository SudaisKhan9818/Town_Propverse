// ═══════════════════════════════════════════════════════════════════
// units.ts — the ONE door between unit data and the rest of the app.
//
// Today records come from town-data.json. When the RAG backend lands,
// swap the body of `fetchUnitRecord` for an API call, e.g.
//   return fetch(`/api/units/${id}`).then((r) => (r.ok ? r.json() : null));
// Nothing else changes: the scene, card and store only call getUnitData().
//
// Geometry (position / footprint) is always merged from the frozen
// layout engine, so the database can never move a building.
// ═══════════════════════════════════════════════════════════════════

import type { CivicKind, Footprint, PlotSize, Point2, UnitData, UnitType } from '@/src/shared/types/town';
import { getTownData } from './layout-engine';
import townData from './town-data.json';

const TOWN = getTownData();

export interface UnitGeometry {
  id: string;
  unitType: UnitType;
  kind?: CivicKind;
  size?: PlotSize;
  streetId?: string;
  position: Point2;
  footprint: Footprint;
}

const geometry = new Map<string, UnitGeometry>();
TOWN.plots.forEach((p) => geometry.set(p.id, {
  id: p.id, unitType: 'plot', size: p.size, streetId: p.streetId, position: p.position, footprint: { w: p.bounds.w, d: p.bounds.d, h: 7.5 },
}));
TOWN.amenities.forEach((a) => geometry.set(a.id, {
  id: a.id, unitType: 'civic', kind: a.type, position: a.position, footprint: a.bounds,
}));
TOWN.civic.forEach((c) => geometry.set(c.id, {
  id: c.id,
  unitType: 'civic',
  kind: c.type,
  // The park's frozen civic pad is a strip; its visible parcel spans the
  // whole wall-to-road block (see components/Park.tsx).
  position: c.type === 'park' ? { x: c.position.x, z: c.position.z + 3 } : c.position,
  footprint: c.type === 'park' ? { w: c.bounds.w, d: 46, h: 1 } : c.bounds,
}));

const records = new Map<string, UnitData>(
  (townData.units as UnitData[]).map((u) => [u.id, u]),
);

/** Synchronous footprint lookup for the scene (camera focus, markers). */
export function getUnitGeometry(id: string): UnitGeometry | null {
  return geometry.get(id) ?? null;
}

async function fetchUnitRecord(id: string): Promise<UnitData | null> {
  return records.get(id) ?? null;
}

/**
 * Resolve a unit by id: record data + frozen geometry.
 * Returns null for unknown ids (e.g. a stale id from a chat answer).
 */
export async function getUnitData(id: string): Promise<UnitData | null> {
  const geo = geometry.get(id);
  if (!geo) return null;
  const record = await fetchUnitRecord(id);
  const base = record ?? ({ id, unitType: geo.unitType } as UnitData);
  // Layout-owned facts always win over the record.
  const frozen = geo.unitType === 'plot'
    ? { size: geo.size, streetId: geo.streetId }
    : { kind: geo.kind };
  return { ...base, ...frozen, position: geo.position, footprint: geo.footprint } as UnitData;
}
