// ═══════════════════════════════════════════════════════════════════
// canvas-texture.ts — every town texture is drawn on a <canvas>.
// No image downloads, no PBR packs: a few KB of code instead of MBs.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import * as THREE from 'three';

export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

interface CanvasTextureOptions {
  /** Tile the texture (roads, stone). Default: clamp, no repeat. */
  repeat?: [number, number];
  /** Colour data (sRGB, default) vs. data maps. */
  srgb?: boolean;
  anisotropy?: number;
}

function makeCanvasTexture(
  draw: DrawFn,
  size: number | [number, number],
  { repeat, srgb = true, anisotropy = 8 }: CanvasTextureOptions = {},
): THREE.CanvasTexture {
  const [width, height] = typeof size === 'number' ? [size, size] : size;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  } else {
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  texture.needsUpdate = true;
  return texture;
}

// Textures are cached for the page lifetime: closing and reopening the town
// overlay reuses the GPU uploads instead of re-drawing 2048px canvases.
const cache = new Map<string, THREE.Texture>();

function getCanvasTexture(
  key: string,
  draw: DrawFn,
  size: number | [number, number],
  options?: CanvasTextureOptions,
): THREE.Texture {
  let texture = cache.get(key);
  if (!texture) {
    texture = makeCanvasTexture(draw, size, options);
    cache.set(key, texture);
  }
  return texture;
}

/** React hook form of getCanvasTexture (memoised per key). */
export function useCanvasTexture(
  key: string,
  draw: DrawFn,
  size: number | [number, number],
  options?: CanvasTextureOptions,
): THREE.Texture {
  // draw/options are static module-level factories; `key` identifies them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getCanvasTexture(key, draw, size, options), [key]);
}

/** Deterministic PRNG so textures and scatter look identical every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
