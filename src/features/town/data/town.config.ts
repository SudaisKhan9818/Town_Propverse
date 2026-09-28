// ═══════════════════════════════════════════════════════
// town.config.ts — Single Source of Truth for the FROZEN town layout.
// Layout constants only: no Three.js, no colours. Do not edit values —
// plot/road/civic positions are frozen (see scripts/verify-layout.mjs).
// ═══════════════════════════════════════════════════════

export const GROUND_SIZE = 180; // 180m x 180m (~4 Acres)

export const BOULEVARD_WIDTH = 12; // Center 2-way boulevard
export const STREET_WIDTH = 8;    // 2-way residential & civic streets
export const BOULEVARD_X = 0;

export const PLOT_SETBACK = 2.0; // 2.0m setback from street edge (clean buffer)
export const PLOT_GAP = 1.5;     // Pixel-perfect 1.5m gap between plots

// REAL SIZES IN METERS (1 unit = 1 meter)
export const PLOT_SIZES = {
  '5marla': { w: 7.6, d: 13.7 },
  '7marla': { w: 9.1, d: 16.8 },
  '12marla': { w: 10.7, d: 21.3 },
} as const;

// Street-End Amenities (Market is bigger than Masjid)
export const AMENITY_SIZES = {
  market: { w: 22, d: 20, h: 6.5 }, // Equal enlarged market pads
  masjid: { w: 14, d: 14, h: 8.5 }, // Masjid 10M
} as const;

// Civic Zone Buildings (hospital moved opposite the school; police/fire/
// WAPDA sizes are their government-complex lots — see GOV_COMPLEX)
export const CIVIC_SIZES = {
  park: { w: 84, d: 10.5, h: 0.5 }, // 35 marla rectangle: boulevard to east wall
  school: { w: 72, d: 28, h: 8.0 }, // School
  hospital: { w: 40, d: 26, h: 12.0 }, // Hospital
  police: { w: 22, d: 54.5, h: 9.0 }, // Police Station lot (government complex)
  fire: { w: 28, d: 54.5, h: 16.0 }, // Fire & Rescue lot (government complex)
  wapda: { w: 27.5, d: 54.5, h: 19.0 }, // WAPDA grid-station lot (government complex)
} as const;

// Government complex — Police · Fire · WAPDA on the plot east of the main
// gate, between Civic Road 2 and the south wall. Three walled lots, each
// with a front parking court, the building behind it and a rear garden.
export const GOV_COMPLEX = {
  zFront: 35,        // 1m behind Civic Road 2's south edge (z = 34)
  zBack: 89.5,       // just inside the south boundary wall
  parkingDepth: 11,  // front parking court
  lots: {
    police: { x0: 10, x1: 32 },  // x ≥ 10 keeps clear of the main gate piers
    fire: { x0: 33, x1: 61 },
    wapda: { x0: 62, x1: 89.5 },
  },
  /**
   * Building fit targets (w × d incl. the 1m fit margin per side): each
   * GLB lands 30–40% larger than in the previous single-plot layout
   * (police ×1.4, fire ×1.3, WAPDA ×1.3).
   */
  buildings: {
    police: { w: 21.6, d: 17.7 },
    fire: { w: 26.5, d: 30.6 },
    wapda: { w: 28, d: 28 },
  },
} as const;

export const WALL_THICK = 0.6;
export const GATE_WIDTH = 14;

export const STREETLIGHT_SPACING = 16;

export const LEFT_BOUND_X = -93; // Tight West wall at x = -93 (4.5m clean clearance from masjids)
export const LEFT_BOUND_Z_NORTH = -62; // Tight North wall on left side at z = -62
export const LEFT_BOUND_Z_SOUTH = 62;  // Tight South wall on left side at z = 62

// Palette lives in src/shared/theme/tokens.ts (single source for 3D + UI).

// ═══════════════════════════════════════════════════════
// Unit models — the user's Blender GLBs, processed by
// scripts/compress-assets.mjs into /public/models/town/.
// `front` is the model-space direction the building's front
// faces (measured per file); GlbUnit rotates it to face the
// unit's street. `lod1` (heavy models only) renders beyond
// `lodDistance` metres.
// ═══════════════════════════════════════════════════════

export type ModelFront = '+z' | '-z' | '+x' | '-x';

export interface UnitModel {
  url: string;
  lod1?: string;
  front: ModelFront;
}

const townModel = (key: string, front: ModelFront, lod1 = true): UnitModel => ({
  url: `/models/town/${key}.glb`,
  lod1: lod1 ? `/models/town/${key}.lod1.glb` : undefined,
  front,
});

export const MODELS = {
  houses: {
    '5M': townModel('house-5marla', '+z'),
    '7M': townModel('house-7marla', '-z'),
    '12M': townModel('house-12marla', '+z'),
  },
  market: townModel('market', '+z'),
  masjid: townModel('masjid', '+x'),
  civic: {
    school: townModel('school', '+z'),
    hospital: townModel('hospital', '+x', false),
    police: townModel('police', '+x', false),
    fire: townModel('fire', '+z', false),
    wapda: townModel('wapda', '+z'),
  },
  park: {
    playground: townModel('playground', '+z'),
  },
} as const;

export const DRACO_DECODER_PATH = '/draco/';

/** Clearance between a building and its frozen footprint, per side (m). */
export const UNIT_MARGIN = 1;
/** Model base sits just above the plot pad / ground. */
export const UNIT_BASE_Y = 0.02;
