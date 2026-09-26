// ═══════════════════════════════════════════════════════════════════
// layout-engine.ts — Clean 2-Street Blueprint (Empty Plots Only)
// ═══════════════════════════════════════════════════════════════════

import {
  GROUND_SIZE, BOULEVARD_WIDTH, STREET_WIDTH, BOULEVARD_X,
  PLOT_SETBACK, PLOT_GAP, PLOT_SIZES, CIVIC_SIZES, AMENITY_SIZES,
  STREETLIGHT_SPACING, LEFT_BOUND_X, WALL_THICK
} from './town.config';

export type PlotSize = '5marla' | '7marla' | '12marla';

export interface Plot {
  id: string; streetId: string; side: 'north' | 'south'; size: PlotSize;
  status: 'empty'; position: { x: number; z: number };
  bounds: { w: number; d: number }; rotation: 0 | 180; address: string;
}

export interface Street {
  id: string; name: string; position: { x: number; z: number };
  width: number; length: number; orientation: 'NS' | 'EW';
}

export interface Amenity {
  id: string; type: 'market' | 'masjid'; position: { x: number; z: number };
  bounds: { w: number; d: number; h: number };
}

export interface CivicBlock {
  id: string; type: 'park' | 'school' | 'hospital' | 'police' | 'fire' | 'wapda';
  position: { x: number; z: number }; bounds: { w: number; d: number; h: number };
}

export interface TreePos {
  position: { x: number; z: number }; scale: number;
}

export interface BushPos {
  position: { x: number; z: number }; scale: number;
}

export interface BenchPos {
  position: { x: number; z: number }; rotation: number;
}

export interface GreenBelt {
  position: { x: number; z: number }; bounds: { w: number; d: number };
}

export interface StreetLightPos {
  position: { x: number; z: number };
}

export interface TownData {
  streets: Street[]; plots: Plot[]; amenities: Amenity[]; civic: CivicBlock[];
  lights: StreetLightPos[]; trees: TreePos[]; bushes: BushPos[]; benches: BenchPos[]; greenBelts: GreenBelt[];
}

export function generateTownLayout(): TownData {
  const streets: Street[] = [];
  const plots: Plot[] = [];
  const amenities: Amenity[] = [];
  const civic: CivicBlock[] = [];
  const lights: StreetLightPos[] = [];

  // ── 1. MAIN TWO WAY ROAD (Boulevard, Vertical Center) ──
  streets.push({
    id: 'boulevard', name: 'Main Two Way Road',
    position: { x: BOULEVARD_X, z: 0 },
    width: BOULEVARD_WIDTH, length: GROUND_SIZE, orientation: 'NS'
  });

  // ── 2. TWO Residential Streets (Left Side Only - Truncated inside West Wall) ──
  // Road runs from x = -92.7 to x = -6 (Length = 86.7m, Center = -49.35m)
  const leftRoadLength = Math.abs(LEFT_BOUND_X) - (WALL_THICK / 2) - (BOULEVARD_WIDTH / 2); // 86.7m
  const leftRoadCenterX = -(BOULEVARD_WIDTH / 2) - (leftRoadLength / 2); // -49.35m

  // Street 2 ROAD (Top)
  const street2Z = -30;
  streets.push({
    id: 'street-2', name: 'Two Way, street 2 ROAD',
    position: { x: leftRoadCenterX, z: street2Z },
    width: STREET_WIDTH, length: leftRoadLength, orientation: 'EW'
  });

  // Street 1 ROAD (Bottom)
  const street1Z = 30;
  streets.push({
    id: 'street-1', name: 'Two Way, street 1 ROAD',
    position: { x: leftRoadCenterX, z: street1Z },
    width: STREET_WIDTH, length: leftRoadLength, orientation: 'EW'
  });

  // ── 3. Civic Zone Roads (Right Side) ──
  const rightRoadLength = GROUND_SIZE / 2 - (BOULEVARD_WIDTH / 2); // 90 - 6 = 84
  const rightRoadCenterX = (BOULEVARD_WIDTH / 2) + (rightRoadLength / 2); // 6 + 42 = 48
  
  streets.push({
    id: 'civic-road-1', name: 'Civic Road',
    position: { x: rightRoadCenterX, z: -40 },
    width: STREET_WIDTH, length: rightRoadLength, orientation: 'EW'
  });
  streets.push({
    id: 'civic-road-2', name: 'Civic Road',
    position: { x: rightRoadCenterX, z: 30 },
    width: STREET_WIDTH, length: rightRoadLength, orientation: 'EW'
  });
  streets.push({
    id: 'school-hospital-road', name: 'School Hospital Connector',
    position: { x: rightRoadCenterX, z: -2.95 },
    width: 6.1, length: rightRoadLength, orientation: 'EW'
  });

  // ── 4. LEFT SIDE PLOT ROWS (Exact Blueprint Match) ──
  const rowDefs = [
    { streetZ: street2Z, zDir: -1, streetId: 'street-2', name: 'St2 N',
      items: ['12marla','7marla','5marla','5marla','7marla','5marla','market'] },
    { streetZ: street2Z, zDir: 1, streetId: 'street-2', name: 'St2 S',
      items: ['7marla','7marla','5marla','5marla','7marla','7marla','5marla','masjid'] },
    { streetZ: street1Z, zDir: -1, streetId: 'street-1', name: 'St1 N',
      items: ['7marla','7marla','5marla','5marla','7marla','12marla','market'] },
    { streetZ: street1Z, zDir: 1, streetId: 'street-1', name: 'St1 S',
      items: ['7marla','7marla','12marla','5marla','7marla','12marla','masjid'] },
  ];

  let plotId = 1;
  let amenityId = 1;

  rowDefs.forEach((row) => {
    const roadEdgeZ = row.streetZ + (STREET_WIDTH / 2) * row.zDir;
    const frontZ = roadEdgeZ + PLOT_SETBACK * row.zDir;
    let xCursor = -(BOULEVARD_WIDTH / 2 + 1.2); // Start near boulevard

    row.items.forEach((item) => {
      if (item === 'market' || item === 'masjid') {
        const b = AMENITY_SIZES[item];
        xCursor -= b.w / 2;
        amenities.push({
          id: `${item}-${amenityId++}`, type: item,
          position: { x: +xCursor.toFixed(2) as unknown as number, z: +(frontZ + (b.d / 2) * row.zDir).toFixed(2) as unknown as number },
          bounds: b
        });
        xCursor -= b.w / 2 + 2.0;
      } else {
        const size = item as PlotSize;
        const b = PLOT_SIZES[size];
        xCursor -= b.w / 2;
        plots.push({
          id: `P-${plotId++}`, streetId: row.streetId,
          side: row.zDir === -1 ? 'north' : 'south',
          size, status: 'empty',
          position: { x: parseFloat(xCursor.toFixed(2)), z: parseFloat((frontZ + (b.d / 2) * row.zDir).toFixed(2)) },
          bounds: { w: b.w, d: b.d },
          rotation: row.zDir === -1 ? 180 : 0,
          address: `${row.name} P${plotId}`
        });
        xCursor -= b.w / 2 + PLOT_GAP;
      }
    });
  });

  // ── 5. RIGHT SIDE CIVIC ZONE ──
  civic.push({ id: 'civic-park', type: 'park',
    position: { x: 48, z: -70 }, bounds: CIVIC_SIZES.park });
  civic.push({ id: 'civic-school', type: 'school',
    position: { x: 48, z: -20 }, bounds: CIVIC_SIZES.school });
  civic.push({ id: 'civic-hospital', type: 'hospital',
    position: { x: 68, z: 13.1 }, bounds: CIVIC_SIZES.hospital });
  civic.push({ id: 'civic-police', type: 'police',
    position: { x: 20, z: 56 }, bounds: CIVIC_SIZES.police });
  civic.push({ id: 'civic-fire', type: 'fire',
    position: { x: 46, z: 56 }, bounds: CIVIC_SIZES.fire });
  civic.push({ id: 'civic-wapda', type: 'wapda',
    position: { x: 72, z: 56 }, bounds: CIVIC_SIZES.wapda });

  // ── 6. PREMIUM LINEAR PARK GARDENS (Shrunk by 35% to prevent plot overlap) ──
  const trees: TreePos[] = [];
  const bushes: BushPos[] = [];
  const benches: BenchPos[] = [];
  const greenBelts: GreenBelt[] = [];

  const beltWidth = 68;
  const beltCenterX = -48;

  // Central Linear Park (z = 0, depth = 5.2m, leaves 1m clear buffer to plot boundaries)
  greenBelts.push({ position: { x: beltCenterX, z: 0 }, bounds: { w: beltWidth, d: 5.2 } });
  // Top-Left Linear Park (z = -58.5)
  greenBelts.push({ position: { x: beltCenterX, z: -58.5 }, bounds: { w: beltWidth, d: 3.5 } });
  // Bottom-Left Linear Park (z = 58.5)
  greenBelts.push({ position: { x: beltCenterX, z: 58.5 }, bounds: { w: beltWidth, d: 3.5 } });

  // Trees and Bushes in PERFECT STRAIGHT LINE at exact 8m intervals (scale = 0.75 for 2.4m foliage clearance)
  const gardenRows = [
    { z: 0, treeZ: 0 },
    { z: -58.5, treeZ: -58.5 },
    { z: 58.5, treeZ: 58.5 },
  ];

  gardenRows.forEach((g) => {
    for (let x = -78; x <= -18; x += 8) {
      // Tree in perfect straight line
      trees.push({ position: { x, z: g.treeZ }, scale: 0.75 });
      // Alternating Bush midway between trees
      if (x + 4 <= -16) {
        bushes.push({ position: { x: x + 4, z: g.treeZ }, scale: 0.55 });
      }
    }
  });

  // Civic Area Gardens (Removed as per latest request)

  // Benches along Central Linear Park
  for (let x = -74; x <= -22; x += 16) {
    benches.push({ position: { x, z: -1.8 }, rotation: 0 });
    benches.push({ position: { x: x + 8, z: 1.8 }, rotation: Math.PI });
  }

  // ── 7. STREETLIGHTS REMOVED ──

  return { streets, plots, amenities, civic, lights, trees, bushes, benches, greenBelts };
}

let _cached: TownData | null = null;
export function getTownData(): TownData {
  if (!_cached) _cached = generateTownLayout();
  return _cached;
}
