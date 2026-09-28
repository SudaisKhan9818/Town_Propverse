// ═══════════════════════════════════════════════════════════════════
// shared/theme/tokens.ts — single palette + type scale for PropVerse.
// Warm bone / clay / soil only. No blue, cyan or purple anywhere.
// Framework-agnostic: plain strings, safe to import from 3D and UI code.
// ═══════════════════════════════════════════════════════════════════

export const COLORS = {
  // Surfaces
  bone: '#EDE9E3',
  boneWarm: '#EDE6D8',
  paper: '#FFFCF7',
  cream: '#F2EADC',
  sand: '#D9C9B0',
  soilLight: '#C9B18C',
  soilDark: '#B89B74',
  plinth: '#D8D1C5',
  border: '#EDE9E3',

  // Ink
  ink: '#1C1A17',
  inkSoft: '#34302B',
  muted: '#7A7168',

  // Accents
  clay: '#B96A4B',
  terracotta: '#A95C43',
  curb: '#A85A3D',
  clayTrim: '#B87958',
  warmGrey: '#8A8078',
  slate: '#5A5E63',
  olive: '#7A7E5A',
  sage: '#7A8B5C',
  leaf: '#4A6B35',
  bark: '#6B4A32',
  wood: '#4A3226',
  glass: '#3F3A35',
  gold: '#C9A96E',

  // Roads
  asphalt: '#403A35',
  roadMarking: '#F0D58A',

  // Status
  statusFree: '#6F9454',
  statusAllotted: '#B96A4B',
  statusRented: '#A95C43',

  // Atmosphere
  skyTop: '#F2EADC',
  skyHorizon: '#D9C9B0',
  fog: '#E4D8C4',
  sunKey: '#FFE3B3',
  ambient: '#E8DCC8',
  hemiSky: '#F5EDE0',
  hemiGround: '#B8A582',
} as const;

export type ColorToken = keyof typeof COLORS;

export const FONTS = {
  serif: "var(--font-serif-custom, 'Playfair Display'), Georgia, serif",
  sans: "var(--font-sans-custom, 'Inter'), system-ui, sans-serif",
  mono: "var(--font-mono-custom, 'IBM Plex Mono'), ui-monospace, monospace",
} as const;

/** Type scale in rem. `display` is fluid for hero headlines. */
export const TYPE_SCALE = {
  micro: '0.62rem',
  caption: '0.72rem',
  body: '0.9rem',
  lead: '1.05rem',
  title: '1.5rem',
  price: '2.1rem',
  display: 'clamp(3.5rem, 9vw, 8rem)',
} as const;
