// ═══════════════════════════════════════════════════════════════════
// shared/types/town.ts — THE CONTRACT
//
// One vocabulary shared by the 3D town, the details card and (later)
// the RAG agent. Pure TypeScript: no React, no Three.js, no runtime
// dependencies, so a Node/Docker backend can import it unchanged.
//
// Rules:
//   • `id` and `unitType` are the only required fields. Everything else
//     is optional so partial API/RAG payloads never break the UI.
//   • `unitType` is the discriminant: narrow with isPlot()/isCivic().
//   • Units are metres, money is PKR (integers), dates are ISO strings.
// ═══════════════════════════════════════════════════════════════════

export type UnitType = 'plot' | 'civic';

/** Allotment state of a residential plot. */
export type UnitStatus = 'free' | 'allotted' | 'rented';

export type PlotSize = '5marla' | '7marla' | '12marla';

export type CivicKind =
  | 'school'
  | 'hospital'
  | 'police'
  | 'fire'
  | 'wapda'
  | 'park'
  | 'market'
  | 'masjid';

/** Ground-plane coordinate in town space (x = east, z = south). */
export interface Point2 {
  x: number;
  z: number;
}

export interface Footprint {
  w: number;
  d: number;
  h?: number;
}

export interface Contact {
  name?: string;
  /** Raw phone number. The UI masks it until the viewer taps to reveal. */
  phone?: string;
}

export interface TimelineEvent {
  label: string;
  /** ISO date (YYYY-MM-DD) or a free-text period such as "Q2 2027". */
  date: string;
}

interface UnitBase {
  id: string;
  unitType: UnitType;
  /** Human title, e.g. "Plot P-12" or "Town Hospital". */
  name?: string;
  position?: Point2;
  footprint?: Footprint;
  /** Card hero image (16:9). */
  imageUrl?: string;
  address?: string;
  timeline?: TimelineEvent[];
}

export interface PlotData extends UnitBase {
  unitType: 'plot';
  size?: PlotSize;
  status?: UnitStatus;
  streetId?: string;
  bedrooms?: number;
  /** Compass direction the front door faces, e.g. "North". */
  facing?: string;
  /** Road the plot fronts onto, e.g. "Street 2 · 26 ft". */
  road?: string;
  possession?: string;
  /** Building type, e.g. "Double-storey bungalow". */
  houseType?: string;
  price?: {
    totalPkr?: number;
    paidPkr?: number;
  };
  owner?: Contact;
}

export interface CivicData extends UnitBase {
  unitType: 'civic';
  kind?: CivicKind;
  department?: string;
  incharge?: Contact;
  timings?: string;
  description?: string;
}

export type UnitData = PlotData | CivicData;

export const isPlot = (unit: UnitData | null | undefined): unit is PlotData =>
  unit?.unitType === 'plot';

export const isCivic = (unit: UnitData | null | undefined): unit is CivicData =>
  unit?.unitType === 'civic';

/**
 * What a pick target represents: the whole GLB building, or the low pad
 * that makes a unit's yard / forecourt / lawn clickable.
 */
export type UnitPart = 'building' | 'pad';

/**
 * Metadata carried by every unit in the scene. Each GLB unit's wrapper
 * group has `userData = { unitId, unitType, part: 'building' }`; the
 * raycast hit proxy stores one entry per pick box in `userData.boxes`.
 */
export interface UnitMeshUserData {
  unitId: string;
  unitType: UnitType;
  part: UnitPart;
  /** Human label, e.g. "House P-12" — handy for debugging and twin mapping. */
  name?: string;
}
