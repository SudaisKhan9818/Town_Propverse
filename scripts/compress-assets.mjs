// ═══════════════════════════════════════════════════════════════════
// compress-assets.mjs — Blender GLB → web-ready town unit (2 LODs).
//
//   node scripts/compress-assets.mjs            (all models)
//   node scripts/compress-assets.mjs school     (one model, by key)
//
// Source of truth: components/town/MODELS/*.glb (the Blender exports).
// Output:          public/models/town/<key>.glb       LOD0 (close-up)
//                  public/models/town/<key>.lod1.glb  LOD1 (far; heavy models only)
//                  public/models/town/manifest.json   sizes, tris, bbox
//                  src/features/town/data/model-manifest.json (same, for the app)
//
// Pipeline per LOD (order matters):
//   [flatten small textures → mean colour, glass → opaque] → dedup → prune → strip
//   seams → weld → simplify (meshopt; sloppy where allowed) → flat
//   normals → textures ≤1024px WebP → draco. Then, only AFTER
//   compression, merge draw calls: palette → flatten → join.
//
// Every GLB must go through this script before it is committed; the
// app only loads public/models/town/*.glb (see data/town.config.ts).
// ═══════════════════════════════════════════════════════════════════

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, draco, flatten, getBounds, join, normals, palette, prune, simplify, textureCompress, weld,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(root, 'components/town/MODELS');
const OUT = path.join(root, 'public/models/town');

/**
 * Per model: source file, whether small textures are baked to mean
 * colours (`flatten` — the stylised town reads as one project and the
 * materials collapse to one palette draw call; only the hospital façade
 * and the WAPDA photo-scan keep theirs), and a triangle budget per LOD.
 * `error` is meshopt's relative error bound; `sloppy` ignores topology.
 * `lod1: null` → the model is light enough to render one level everywhere.
 */
export const MODELS = {
  'house-5marla': { file: '5Marla.glb', flatten: true, lod0: { tris: 12000 }, lod1: { tris: 3500, sloppy: true } },
  'house-7marla': { file: '7 Marla.glb', flatten: true, lod0: { tris: 5500 }, lod1: { tris: 2500, sloppy: true } },
  'house-12marla': { file: '12Marla.glb', flatten: true, lod0: { tris: 16000, error: 0.03 }, lod1: { tris: 4000, sloppy: true } },
  market: { file: 'market.glb', flatten: true, lod0: { tris: 48000, error: 0.04 }, lod1: { tris: 14000, error: 0.3 } },
  masjid: { file: 'Masjid.glb', flatten: true, lod0: { tris: 11000 }, lod1: { tris: 4500, sloppy: true } },
  school: { file: 'School.glb', flatten: true, lod0: { tris: 160000, error: 0.015 }, lod1: { tris: 30000, error: 0.2 } },
  hospital: { file: 'Hospital.glb', flatten: false, lod0: { tris: 9000 }, lod1: null },
  police: { file: 'PoliceStation.glb', flatten: true, lod0: { tris: 9000 }, lod1: null },
  fire: { file: 'FireStation.glb', flatten: true, lod0: { tris: 1500 }, lod1: null },
  wapda: { file: 'Wapda.glb', flatten: false, lod0: { tris: 110000, error: 0.2 }, lod1: { tris: 28000, sloppy: true } },
  playground: { file: 'Playground.glb', flatten: true, lod0: { tris: 4500 }, lod1: { tris: 2000, sloppy: true } },
};

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Replace every texture with its mean colour (multiplied into the factor). */
const flattenTextures = () => async (document) => {
  const means = new Map();
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const { channels } = await sharp(Buffer.from(image)).stats();
    means.set(texture, channels.slice(0, 3).map((ch) => srgbToLinear(ch.mean / 255)));
  }
  for (const material of document.getRoot().listMaterials()) {
    const base = material.getBaseColorTexture();
    if (base && means.has(base)) {
      const f = material.getBaseColorFactor();
      const m = means.get(base);
      material.setBaseColorFactor([f[0] * m[0], f[1] * m[1], f[2] * m[2], f[3]]);
    }
    const emissive = material.getEmissiveTexture();
    if (emissive && means.has(emissive)) {
      const f = material.getEmissiveFactor();
      const m = means.get(emissive);
      material.setEmissiveFactor([f[0] * m[0], f[1] * m[1], f[2] * m[2]]);
    }
    material.setBaseColorTexture(null);
    material.setEmissiveTexture(null);
    material.setMetallicRoughnessTexture(null);
    material.setOcclusionTexture(null);
    material.setNormalTexture(null);
  }
};

/**
 * Stylised dark glass: blended glass would cost an extra (double-sided,
 * two-pass) draw call per building and cannot join the palette. Flattened
 * models get opaque dark-glass instead — the same look as the town's
 * window insets — so each building collapses to one or two draws.
 */
const opaqueGlass = () => (document) => {
  for (const material of document.getRoot().listMaterials()) {
    if (material.getAlphaMode() !== 'BLEND') continue;
    const [r, g, b] = material.getBaseColorFactor();
    material.setAlphaMode('OPAQUE');
    material.setBaseColorFactor([r * 0.3 + 0.03, g * 0.3 + 0.03, b * 0.3 + 0.028, 1]);
    material.setRoughnessFactor(0.35);
    material.setMetallicFactor(0);
  }
};

/**
 * Blender exports split vertices at every normal/UV seam, which leaves
 * weld nothing to merge and meshopt nothing to collapse. Drop normals
 * (regenerated flat after simplification — crisp, architectural) and
 * UVs on untextured parts so surfaces reconnect before simplifying.
 */
const stripSeams = () => (document) => {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      if (material?.getNormalTexture()) material.setNormalTexture(null);
      const textured = !!(material && (material.getBaseColorTexture() || material.getEmissiveTexture()
        || material.getMetallicRoughnessTexture() || material.getOcclusionTexture()));
      prim.setAttribute('NORMAL', null);
      prim.setAttribute('TANGENT', null);
      if (!textured) {
        for (const semantic of prim.listSemantics()) {
          if (semantic.startsWith('TEXCOORD')) prim.setAttribute(semantic, null);
        }
      }
    }
  }
};

const countTriangles = (document) => document.getRoot().listMeshes()
  .flatMap((m) => m.listPrimitives())
  .reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);

/** Topology-free simplification (meshopt simplifySloppy) to a triangle budget. */
const sloppyToTarget = (targetTris) => (document) => {
  const prims = document.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices());
  const total = countTriangles(document);
  if (total <= targetTris) return;
  for (const prim of prims) {
    const indices = prim.getIndices();
    const position = prim.getAttribute('POSITION');
    const target = Math.max(3, Math.floor((indices.getCount() * targetTris) / total / 3) * 3);
    const [next] = MeshoptSimplifier.simplifySloppy(
      new Uint32Array(indices.getArray()), new Float32Array(position.getArray()), 3, null, target, 1,
    );
    indices.setArray(next);
  }
};

function stats(document) {
  const rootDoc = document.getRoot();
  const scene = rootDoc.getDefaultScene() ?? rootDoc.listScenes()[0];
  const { min, max } = getBounds(scene);
  return {
    triangles: Math.round(countTriangles(document)),
    drawCalls: rootDoc.listMeshes().reduce((n, m) => n + m.listPrimitives().length, 0),
    materials: rootDoc.listMaterials().length,
    bbox: { min: min.map((v) => +v.toFixed(3)), max: max.map((v) => +v.toFixed(3)) },
  };
}

async function buildLod(io, srcPath, cfg, lod) {
  const doc = await io.read(srcPath);
  const before = stats(doc);
  if (cfg.flatten) await doc.transform(flattenTextures(), opaqueGlass());
  await doc.transform(dedup(), prune(), stripSeams(), weld());
  if (countTriangles(doc) > lod.tris) {
    if (lod.sloppy) {
      await doc.transform(sloppyToTarget(lod.tris), weld());
    } else {
      await doc.transform(simplify({
        simplifier: MeshoptSimplifier, ratio: lod.tris / countTriangles(doc), error: lod.error ?? 0.01, lockBorder: false,
      }));
    }
  }
  await doc.transform(
    normals({ overwrite: true }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 }),
    // Draw-call merge strictly after compression.
    palette({ min: 2 }),
    flatten(),
    join({ keepNamed: false }),
    dedup(),
    prune(),
  );
  const bytes = await io.writeBinary(doc);
  return { before, after: stats(doc), bytes };
}

async function main() {
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });
  await mkdir(OUT, { recursive: true });

  const only = process.argv.slice(2);
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{"models":{}}'));

  for (const [key, cfg] of Object.entries(MODELS)) {
    if (only.length && !only.includes(key)) continue;
    const srcPath = path.join(SRC, cfg.file);
    const sourceBytes = (await stat(srcPath)).size;
    const entry = { source: path.relative(root, srcPath), sourceBytes, lods: [] };
    for (const [level, lod] of [['lod0', cfg.lod0], ['lod1', cfg.lod1]].filter(([, l]) => l)) {
      const t0 = Date.now();
      const { before, after, bytes } = await buildLod(io, srcPath, cfg, lod);
      const file = level === 'lod0' ? `${key}.glb` : `${key}.lod1.glb`;
      await writeFile(path.join(OUT, file), bytes);
      const gzipBytes = gzipSync(bytes, { level: 9 }).length;
      if (level === 'lod0') {
        entry.before = { triangles: before.triangles, drawCalls: before.drawCalls, materials: before.materials };
        entry.bbox = after.bbox;
      }
      entry.lods.push({ level, url: `/models/town/${file}`, bytes: bytes.length, gzipBytes, triangles: after.triangles, drawCalls: after.drawCalls });
      console.log(
        `${`${key} ${level}`.padEnd(20)} ${(sourceBytes / 1e6).toFixed(1).padStart(5)}MB → ${(bytes.length / 1e6).toFixed(2).padStart(5)}MB`
        + ` (gz ${(gzipBytes / 1e6).toFixed(2)})  tris ${before.triangles} → ${after.triangles}`
        + `  draws ${before.drawCalls} → ${after.drawCalls}  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    }
    manifest.models[key] = entry;
  }

  const all = Object.values(manifest.models).flatMap((m) => m.lods);
  manifest.generated = new Date().toISOString();
  manifest.totals = {
    bytes: all.reduce((t, l) => t + l.bytes, 0),
    gzipBytes: all.reduce((t, l) => t + l.gzipBytes, 0),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  // The town reads measured bounds from its own data folder (placement,
  // pick proxies and walk collision need them before any GLB loads).
  await writeFile(path.join(root, 'src/features/town/data/model-manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`TOTAL ${(manifest.totals.bytes / 1e6).toFixed(2)}MB (gzip ${(manifest.totals.gzipBytes / 1e6).toFixed(2)}MB) → ${path.relative(root, manifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
