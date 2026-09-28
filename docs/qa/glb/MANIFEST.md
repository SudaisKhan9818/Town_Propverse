# GLB unit layer — manifest & QA

Source of truth: `components/town/MODELS/*.glb` (the Blender exports — the newest set, and what the
previous app served). Pipeline: `node scripts/compress-assets.mjs` → `public/models/town/` and
`src/features/town/data/model-manifest.json`. Wiring: `MODELS` in `src/features/town/data/town.config.ts`;
placement + fit in `data/unit-placement.ts`; loader `components/GlbUnit.tsx`.

## Manifest (file → unit, measured bounds, compression)

Measured bounding box is W × D (h) in metres, model space. "Front" is the model-space side the entrance faces.
Triangles / draw calls: source → LOD0 (close) → LOD1 (far, heavy models only).

| Source GLB | Unit(s) | Measured W × D (h) | Front | Source tris / draws | LOD0 | LOD1 | Source size | Shipped (gzip) |
|---|---|---|---|---|---|---|---|---|
| `5Marla.glb` | 5 Marla house ×8 | 8.5 × 16.0 (h 9.0) | +Z | 49,667 / 18 | 15,262 / 3 | 2,744 / 3 | 2.7 MB | 0.10 MB |
| `7 Marla.glb` | 7 Marla house ×12 | 9.1 × 19.4 (h 6.5) | −Z | 13,174 / 23 | 5,786 / 1 | 2,180 / 1 | 0.8 MB | 0.04 MB |
| `12Marla.glb` | 12 Marla house ×5 | 15.0 × 30.3 (h 12.9) | +Z | 77,119 / 63 | 16,505 / 1 | 3,283 / 1 | 4.6 MB | 0.11 MB |
| `market.glb` | market-1, market-3 ×2 | 20.0 × 29.9 (h 18.0) | +Z | 1,224,639 / 96 | 52,475 / 2 | 24,368 / 2 | 83.2 MB | 0.36 MB |
| `Masjid.glb` | masjid-2, masjid-4 ×2 | 15.0 × 16.0 (h 11.0) | +X | 16,021 / 43 | 11,027 / 1 | 3,864 / 1 | 2.0 MB | 0.07 MB |
| `School.glb` | civic-school ×1 | 55.0 × 25.0 (h 12.0) | +Z | 866,584 / 23 | 159,959 / 3 | 33,158 / 3 | 64.9 MB | 0.79 MB |
| `Hospital.glb` | civic-hospital ×1 | 40.0 × 80.0 (h 40.0) | +X | 8,238 / 36 | 8,238 / 11 | — | 5.1 MB | 0.92 MB |
| `PoliceStation.glb` | civic-police ×1 | 8.0 × 10.0 (h 5.0) | +X | 8,663 / 8 | 8,663 / 1 | — | 0.5 MB | 0.02 MB |
| `FireStation.glb` | civic-fire ×1 | 12.0 × 14.0 (h 8.0) | +Z | 1,246 / 14 | 1,246 / 1 | — | 0.1 MB | 0.01 MB |
| `Wapda.glb` | civic-wapda ×1 | 20.0 × 20.0 (h 15.0) | +Z | 1,999,999 / 2 | 109,975 / 2 | 27,183 / 2 | 78.8 MB | 2.31 MB |
| `Playground.glb` | civic-park (playground) ×1 | 8.4 × 6.4 (h 1.7) | +Z | 8,498 / 25 | 4,614 / 2 | 1,652 / 2 | 1.4 MB | 0.04 MB |

**Shipped 3D payload:** 4.91 MB (4.77 MB gzipped) + Draco decoder 0.25 MB. Budget 8 MB gzipped. (Sources: ~281 MB.)

### GLBs found but not used (reported, not forced in)
- `GreenGround.glb` — 36.6 MB textured terrain plane; the park keeps its sage lawn.
- `public/models/Market 15Marla.glb`, `Masjid 10Marla.glb`, `kidsPlay.glb` — ~150-triangle legacy block placeholders.
- `public/models/*.glb` — older (Sep 19–20) duplicates of the MODELS set. `public/models-draco/`, `public/models-runtime/` — old compressed copies, used only by the legacy `/blender-models` route.
- No boundary-wall or gate GLB exists → wall and gate keep the current visuals.

## Performance — renderer.info at 1440×900

Previous pass (procedural placeholders): 53 calls · 47k tris. Original Blender scene: ~720 calls · 6.4M tris.

| View | Draw calls | Triangles | Shadow-refresh frame |
|---|---|---|---|
| aerial | 95 | 210,116 | 177 calls · 419,708 tris |
| boulevard | 65 | 159,682 | not captured (measurement race) |
| street-walk | 43 | 199,027 | 125 calls · 694,462 tris |
| gate | 79 | 173,041 | 161 calls · 382,633 tris |
| civic | 81 | 291,152 | 163 calls · 583,536 tris |
| masjid | 28 | 185,293 | 110 calls · 610,092 tris |

Steady-state frames: max **95 draw calls** (budget 120) and max **291,152 triangles** (budget 400k) — **PASS**.
The shadow map is static: it re-renders only while the town reveals or quality changes, and that one-off
frame is reported separately by the in-app logger. Hover raycast (BVH proxy): 0.008 ms.

## Checks
- Placement audit: 35/35 units inside their frozen footprint (1 m margin; 0.8 m for the playground), clear of roads, front to street. 0 trees needed nudging.
- Card clicks through the real mouse path: house P-9 → plot card, masjid-2 → civic card, civic-hospital → civic card (`click-*.png`).
- `node scripts/verify-layout.mjs` → LAYOUT DIFF: PASS. `tsc` clean. `next build` passes.
