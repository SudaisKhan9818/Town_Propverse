# PropVerse - 3D Real Estate Town for Pakistan

PropVerse is a high-performance 3D real estate platform built with **Three.js**, **React Three Fiber (R3F)**, **TypeScript**, and **Next.js**.

## Phase 1 Architecture (Current Phase)

Phase 1 focuses exclusively on the performant, data-driven town layout foundation:
- **Ground & Roads**: PlaneGeometry (300x300m) with procedural warm dry-grass/sand texture `#D8C9A3` and dark bone `#B8AC96` roads.
- **Boulevard & Streets**: 1 main N-S boulevard (12m wide) and 3 parallel E-W streets (8m wide, spaced 80m apart).
- **Plot System**: Exactly 60 plots across 3 sizes (5 marla, 7 marla, 12 marla) with 1.5m front setback for footpaths.
- **Amenities**: Low-poly block amenities in clay/terracotta tones (Markets, Masjids, Hospital, Fire Station, Police Station).
- **Perimeter & Gate**: 2m perimeter boundary wall with main gate on the boulevard.
- **Performance**: High frame rates (<2.5s load, <10 draw calls) via extensive `InstancedMesh` usage.

### Key Files in `components/town/`:
1. `town.config.ts`: Type-safe single source of truth for layout constants, dimensions, and warm bone/clay color palette.
2. `layout-engine.ts`: Pure TypeScript layout generator function (`generateTownLayout()` / `getTownData()`) returning structured town data.
3. `TownScene.tsx`: R3F Canvas scene rendering ground, roads, plots, trees, amenities, lighting, and orbit controls via `InstancedMesh`.
4. `TownCanvas.tsx`: Lazy-loaded wrapper preserving WebGL context with `React.lazy` + `Suspense` and `frameloop="demand"`.

---

## Phase 2: Swapping Plot Status from `"empty"` to Load GLB Bungalow

In Phase 2, plots will dynamically render 3D GLB bungalow models when their `status` is updated.

### Implementation Workflow for Phase 2:

1. **Update Plot Interface (`layout-engine.ts`)**:
   ```ts
   export interface Plot {
     id: string;
     streetId: string;
     side: "left" | "right";
     size: PlotSize;
     status: "empty" | "occupied" | "reserved"; // Phase 2 status expansion
     modelUrl?: string; // Path to GLB model (e.g., "/models/bungalow-5marla.glb")
     position: { x: number; z: number };
     bounds: { w: number; d: number };
     rotation: 0 | 180;
     address: string;
   }
   ```

2. **GLB Model Preloading & Rendering in `TownScene.tsx`**:
   Use `@react-three/drei`'s `useGLTF` hook to load bungalow models:
   ```tsx
   import { useGLTF } from '@react-three/drei';

   // Preload bungalow models for each plot size
   useGLTF.preload('/models/bungalow-5marla.glb');
   useGLTF.preload('/models/bungalow-7marla.glb');
   useGLTF.preload('/models/bungalow-12marla.glb');

   function BungalowModel({ plot }: { plot: Plot }) {
     const { scene } = useGLTF(`/models/bungalow-${plot.size}.glb`);
     const clonedScene = useMemo(() => scene.clone(), [scene]);

     return (
       <primitive
         object={clonedScene}
         position={[plot.position.x, 0, plot.position.z]}
         rotation={[0, (plot.rotation * Math.PI) / 180, 0]}
       />
     );
   }
   ```

3. **Conditional Plot Renderer**:
   In `TownScene.tsx`, check `plot.status`:
   - If `plot.status === "empty"`: Render empty plot ground & boundary border (Phase 1).
   - If `plot.status === "occupied"`: Render `<BungalowModel plot={plot} />`.

4. **Instanced Bungalow Optimization (for large numbers of houses)**:
   For max performance with hundreds of houses, Phase 2 can use `@react-three/drei`'s `<Instances>` or `InstancedMesh` with GLTF geometry/materials to render all occupied 5/7/12 marla bungalows in single draw calls per size variant.