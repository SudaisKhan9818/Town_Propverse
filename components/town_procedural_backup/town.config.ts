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
  market: { w: 18, d: 18, h: 6.5 }, // Market 15M
  masjid: { w: 14, d: 14, h: 8.5 }, // Masjid 10M
} as const;

// Civic Zone Buildings
export const CIVIC_SIZES = {
  park: { w: 72, d: 28, h: 0.5 }, // Park + Playground + Sports
  school: { w: 72, d: 28, h: 8.0 }, // School
  hospital: { w: 72, d: 26, h: 12.0 }, // Hospital
  police: { w: 22, d: 50, h: 7.0 }, // Police Station
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
  ground: '#D8C9A3', // Procedural warm sand ground
  road: '#3A3530', // Realistic dark asphalt
  roadMarking: '#E0C285', // Yellow dashed center stripe
  curb: '#B85C37', // Terracotta curbs
  plotGround: '#C6B794', // Plot pad (slightly darker sand)
  accent: '#B85C37', // Terracotta plot boundary lines
  wall: '#B85C37', // Perimeter wall
  gate: '#D5C4A1',
  civicBody: '#E8DFCE', // Warm bone body
  civicTrim: '#C47A4B', // Terracotta roof trim
  parkGround: '#748B57', // Olive green grass
  parkCourt: '#B55E38',
  market: '#967858', // Warm clay market
  masjid: '#7D624C', // Masjid body
  masjidDome: '#C8A048', // Warm gold dome
  pole: '#3D352E', // Dark bronze post
  lightBulb: '#FFE0A0', // Warm emissive bulb
  fog: '#F5EFE2',
  foliage: '#4E733E', // Low-poly tree foliage
  foliageDark: '#39572E',
  wood: '#8B5A2B', // Bench / trunk wood
  concreteBorder: '#C8C2B4', // Stone border for garden belts
  bushFoliage: '#688F48', // Low-poly bush foliage
  gardenBase: '#4A6B38', // Elevated dark green garden base
  buildingPlinth: '#D2C8B8', // Plinth foundation base under buildings
} as const;


