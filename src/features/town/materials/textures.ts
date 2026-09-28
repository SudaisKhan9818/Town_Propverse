// ═══════════════════════════════════════════════════════════════════
// textures.ts — procedural texture recipes (architectural, not photoreal).
// Each export is a DrawFn for makeCanvasTexture / useCanvasTexture.
// ═══════════════════════════════════════════════════════════════════

import { COLORS } from '@/src/shared/theme/tokens';
import { seeded, type DrawFn } from './canvas-texture';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Town ground: soil radial gradient + ±5% splotches + sparse pebbles. */
export const drawGround: DrawFn = (ctx, w, h) => {
  const rand = seeded(11);
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.05, w / 2, h / 2, w * 0.72);
  gradient.addColorStop(0, COLORS.soilLight);
  gradient.addColorStop(1, COLORS.soilDark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Low-frequency splotches: lighten/darken by at most ~5%.
  for (let i = 0; i < 900; i += 1) {
    const light = rand() > 0.5;
    const r = 18 + rand() * 90;
    const x = rand() * w;
    const y = rand() * h;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, light ? 'rgba(255,248,232,0.05)' : 'rgba(70,52,30,0.05)');
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fine grain.
  for (let i = 0; i < 60000; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,240,0.05)' : 'rgba(60,45,28,0.05)';
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }

  // Sparse pebbles, 2–4px, with a light top edge.
  for (let i = 0; i < 2600; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1 + rand() * 1;
    ctx.fillStyle = rgba(COLORS.wood, 0.18 + rand() * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,236,0.22)';
    ctx.fillRect(x - r * 0.5, y - r * 0.8, r, 0.8);
  }
};

/** Land outside the wall: same soil family, flatter, tileable. */
export const drawOuterLand: DrawFn = (ctx, w, h) => {
  const rand = seeded(23);
  ctx.fillStyle = '#D2C0A0';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 10 + rand() * 50;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,246,228,0.014)' : 'rgba(80,60,36,0.014)';
    // Wrap blobs so the tile is seamless.
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,240,0.06)' : 'rgba(60,45,28,0.06)';
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }
};

/** Warm asphalt with aggregate speckle. Tileable. */
export const drawAsphalt: DrawFn = (ctx, w, h) => {
  const rand = seeded(5);
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 14000; i += 1) {
    const light = rand() > 0.55;
    ctx.fillStyle = light ? `rgba(230,215,195,${0.04 + rand() * 0.06})` : `rgba(10,8,6,${0.06 + rand() * 0.08})`;
    const s = rand() > 0.9 ? 2 : 1;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
};

/**
 * Stone wall panel (one 6m × 2.4m segment per tile): ashlar courses,
 * vertical joints every panel, subtle per-block tone shifts.
 */
export const drawStonePanel: DrawFn = (ctx, w, h) => {
  const rand = seeded(7);
  ctx.fillStyle = '#CDBEA5';
  ctx.fillRect(0, 0, w, h);
  const courses = 6;
  const courseH = h / courses;
  for (let row = 0; row < courses; row += 1) {
    const offset = row % 2 === 0 ? 0 : w / 8;
    for (let col = -1; col < 4; col += 1) {
      const x = offset + col * (w / 4);
      const shade = (rand() - 0.5) * 0.12;
      ctx.fillStyle = shade > 0 ? `rgba(255,248,235,${shade})` : `rgba(70,50,30,${-shade})`;
      ctx.fillRect(x + 1, row * courseH + 1, w / 4 - 2, courseH - 2);
    }
    ctx.fillStyle = 'rgba(92,72,52,0.35)';
    ctx.fillRect(0, row * courseH, w, 2);
  }
  // Staggered vertical joints.
  ctx.fillStyle = 'rgba(92,72,52,0.32)';
  for (let row = 0; row < courses; row += 1) {
    const offset = row % 2 === 0 ? 0 : w / 8;
    for (let col = 0; col < 5; col += 1) ctx.fillRect(offset + col * (w / 4) - 1, row * courseH, 2, courseH);
  }
  // Strong pilaster joint at each panel edge.
  ctx.fillStyle = 'rgba(80,60,42,0.55)';
  ctx.fillRect(0, 0, 4, h);
  ctx.fillRect(w - 4, 0, 4, h);
  for (let i = 0; i < 6000; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,250,240,0.06)' : 'rgba(50,38,24,0.07)';
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }
};

/** Mown-lawn stripes in muted sage. Tileable. */
export const drawLawn: DrawFn = (ctx, w, h) => {
  const rand = seeded(3);
  ctx.fillStyle = COLORS.sage;
  ctx.fillRect(0, 0, w, h);
  const stripes = 8;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,230,0.045)' : 'rgba(40,50,20,0.045)';
    ctx.fillRect(0, (i * h) / stripes, w, h / stripes);
  }
  for (let i = 0; i < 12000; i += 1) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(245,240,210,0.07)' : 'rgba(40,52,24,0.08)';
    ctx.fillRect(rand() * w, rand() * h, 1, 2);
  }
};

/** Gate nameplate: bone lettering on dark stone. */
export const drawNameplate: DrawFn = (ctx, w, h) => {
  ctx.fillStyle = '#2B2622';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(237,230,216,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.fillStyle = COLORS.boneWarm;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 400 ${Math.round(h * 0.46)}px 'Playfair Display', Georgia, 'Times New Roman', serif`;
  ctx.fillText('PropVerse', w / 2, h * 0.44);
  ctx.font = `500 ${Math.round(h * 0.11)}px 'IBM Plex Mono', Menlo, monospace`;
  ctx.fillStyle = 'rgba(237,230,216,0.72)';
  const label = 'TOWN 01  ·  EST. 2026';
  ctx.fillText(label.split('').join(String.fromCharCode(8202)), w / 2, h * 0.8);
};

/** Background sky: cream top → sand horizon. */
export const drawSky: DrawFn = (ctx, w, h) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, COLORS.skyTop);
  gradient.addColorStop(0.55, '#EADFCB');
  gradient.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
};
