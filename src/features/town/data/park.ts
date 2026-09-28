// park.ts — Central Park parcel geometry (shared by landscape + placement).

import { getTownData } from './layout-engine';

const park = getTownData().civic.find((c) => c.type === 'park')!;

/** The park's visible parcel: boulevard edge → east wall, north wall → Civic Road 1. */
export const PARK_PARCEL = {
  x: park.position.x,
  z: park.position.z + 3,
  w: park.bounds.w,
  d: 46,
} as const;

export const PARK_LAWN = { x: 40, z: PARK_PARCEL.z, w: 56, d: 32 } as const;
export const PLAYGROUND_CENTER = { x: 79, z: PARK_PARCEL.z + 2 } as const;
/** Clay play pad the playground GLB is fitted into. */
export const PLAYGROUND_PAD = { w: 13, d: 10 } as const;
