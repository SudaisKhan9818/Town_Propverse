# PropVerse — 3D Real Estate Town

## Phase 1+2 Scope (Current)

**Ground + Town Map + Roads + Plots + Civic Zone. No houses. No walk controls.**

### Town Structure

```
WEST ◄──────────────────────────────────────── EAST
       RESIDENTIAL ZONE  │ BOULEVARD │ CIVIC ZONE
       (Left of Blvd)    │   (12m)   │ (Right of Blvd)
```

| Element | Count | Details |
|---|---|---|
| Boulevard | 1 | 12m wide, N-S, center |
| Streets | 3 | 8m wide, E-W, spaced 110m |
| Residential plots | **60** | 10 plots × 2 sides × 3 streets |
| Plot sizes | 3 | 5marla / 7marla / 12marla |
| Street-end market | 3 | 30×20m, one per street end |
| Street-end masjid | 3 | 20×20m, one per street end |
| Civic blocks | 4 | Hospital / School / Fire / Police |
| Trees | 136 | 2/plot + 4/civic block |
| Streetlights | dynamic | Every 20m along all roads |

### Plot Status System

Every `Plot` has a `status` field that drives Phase 3:

```ts
export type PlotStatus = 'empty'; // Phase 3 adds: 'built' | 'reserved'

// Phase 3 upgrade plan:
// When status === 'built', swap the plot ground pad for a GLB bungalow model:
//   useGLTF('/models/bungalow-5marla.glb')  // based on plot.size
//   useGLTF('/models/bungalow-7marla.glb')
//   useGLTF('/models/bungalow-12marla.glb')
//
// Position/rotation from plot.position and plot.rotation (already correct).
// This requires no layout-engine changes — only TownScene.tsx render logic.
```

### File Structure

```
components/town/
├── town.config.ts     — Single source of truth (sizes, colors, constants)
├── layout-engine.ts   — Pure data generator, cached singleton
├── TownScene.tsx      — R3F scene (InstancedMesh, lighting, controls)
└── TownCanvas.tsx     — Overlay shell (mounts Canvas only when visible)
```

### Performance Targets

- DPR: [1, 1.75]
- Draw calls: < 50 (all repeated geometry uses InstancedMesh)
- Shadow map: 2048×2048, PCFSoft, tight camera frustum
- Canvas only mounts on first "Explore" click (no idle WebGL cost)

### Phase 3 Roadmap

1. Add GLB bungalow models for each plot size
2. Raycasting on plots → click to open plot info panel
3. First-person walk controls (WASD + pointer lock)
4. Live pricing data overlay per plot
