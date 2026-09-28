// ═══════════════════════════════════════════════════════════════════
// palette.ts — 3D material tokens for the procedural landscape layer
// (ground, pads, lawns, trees, wall, gate). Colours come from the shared
// theme; buildings are the user's GLBs, graded by warm-grade.ts.
// ═══════════════════════════════════════════════════════════════════

import { COLORS } from '@/src/shared/theme/tokens';

export const TOWN_PALETTE = {
  plotPad: COLORS.bone,
  soilBorder: '#A88A64',
  playPad: '#C98E6E',
  pavers: '#E2D8C8',
  wallCap: '#9C8B74',
  planter: COLORS.terracotta,
  trunk: COLORS.bark,
  canopy: COLORS.leaf,
  bench: COLORS.wood,
  beltBorder: COLORS.plinth,
  complexWall: '#DACDB8',
  hedge: '#56693F',
  forecourt: '#CDBFA6',
  bayLine: '#6E6358',
} as const;

/** Physical response per surface family (MeshStandardMaterial params). */
export const SURFACE = {
  ground: { roughness: 0.95, metalness: 0 },
  asphalt: { roughness: 0.9, metalness: 0 },
  foliage: { roughness: 0.8, metalness: 0 },
} as const;
