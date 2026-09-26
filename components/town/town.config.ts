// ═══════════════════════════════════════════════════════
// town.config.ts — Single Source of Truth for PropVerse
// Clean Town Blueprint (2 Streets, Empty Plots, Civic Zone)
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

// Civic Zone Buildings
export const CIVIC_SIZES = {
  park: { w: 84, d: 10.5, h: 0.5 }, // 35 marla rectangle: boulevard to east wall
  school: { w: 72, d: 28, h: 8.0 }, // School
  hospital: { w: 40, d: 26, h: 12.0 }, // Hospital
  police: { w: 16, d: 30, h: 7.0 }, // Police Station
  fire: { w: 22, d: 24, h: 7.0 }, // Fire Control
  wapda: { w: 22, d: 24, h: 6.0 }, // WAPDA Block
} as const;

export const WALL_HEIGHT = 2.2;
export const WALL_THICK = 0.6;
export const GATE_WIDTH = 14;

export const STREETLIGHT_SPACING = 16;

export const LEFT_BOUND_X = -93; // Tight West wall at x = -93 (4.5m clean clearance from masjids)
export const LEFT_BOUND_Z_NORTH = -62; // Tight North wall on left side at z = -62
export const LEFT_BOUND_Z_SOUTH = 62;  // Tight South wall on left side at z = 62

// Warm Palette
export const COLORS = {
  ground: '#D9C9B0',
  road: '#2A2D32',
  roadMarking: '#F0D58A',
  curb: '#B96A4B',
  plotGround: '#EDE9E3',
  accent: '#A95C43',
  wall: '#8A8A8A',
  gate: '#D5C4A1',
  civicBody: '#E8E3DA',
  civicTrim: '#B87958',
  parkGround: '#6F9454',
  market: '#8B6A51',
  masjid: '#E5DED2',
  masjidDome: '#C8A048',
  pole: '#34383A',
  lightBulb: '#FFE0A0',
  foliage: '#2D5A27',
  gardenBase: '#3A8A3A',
  plinth: '#D8D1C5',
  fog: '#D5D5D5',
  wood: '#4A3721',
  concreteBorder: '#C8C8C0',
  bushFoliage: '#2D5A27',
} as const;
