actually i want 3D srchetitural town isnide my website, its workflow is below.

PHASE 1+ 2 , PROMPT 1 FOR PROJECT: You are a senior Three.js + React Three Fiber + TypeScript architect. 
We are building "PropVerse", a 3D real estate town for Pakistan.

CRITICAL: THIS PHASE = ONLY GROUND + TOWN MAP + ROADS + STREETS + PLOT SYSTEM. 
NO houses/bungalows, NO raycasting, NO walk controls yet. 
Only empty plots with visible boundaries.

Use design system: warm bone/clay palette. NO blue/cyan/purple. 
Target: <2.5s load, <50 draw calls.

═══════════════════════════════════
GOAL
═══════════════════════════════════
A performant, data-driven town layout:
- Flat procedural ground: PlaneGeometry 300x300m. Canvas-generated texture: warm dry-grass/sand #D8C9A3 with subtle noise
- 1 main boulevard: 12m wide, center, runs North-South
- 3 parallel streets: 8m wide each, East-West, evenly spaced 80m apart
- Plots: EXACTLY 3 sizes. 1 unit = 1 meter. 1.5m setback in front of every plot for footpath
 5 marla = 7.6m x 13.7m | 7 marla = 9.1m x 16.8m | 12 marla = 10.7m x 21.3m
- ~10 plots per side per street = ~60 total plots
- Amenities as low-poly blocks: 1 market per street 30x20m, 1 masjid per street 20x20m
  3 civic at center: Hospital 50x40m, Fire 30x30m, Police 30x30m. Clay/terracotta tones
- Perimeter boundary wall 2m high + 1 main gate on boulevard

═══════════════════
MANDATORY ARCHITECTURE
═══════════════════════════
Create 4 files exactly:

1. town.config.ts
   Single source of truth. Type-safe. Export all constants:
   GROUND_SIZE, BOULEVARD_WIDTH, STREET_WIDTH, STREET_SPACING, 
   PLOT_SIZES = {5marla: {w,d}, 7marla: {w,d}, 12marla: {w,d}}, 
   AMENITY_SIZES, COLORS. No Three.js imports.

2. layout-engine.ts  
   Pure functions. NO Three.js. Must export: 
   export function generateTownLayout(config): TownData
   TownData type = { streets: Street[], amenities: Amenity[], plots: Plot[] }
   Plot type = { 
     id: string, 
     streetId: string, 
     side: "left"|"right", 
     size: "5marla"|"7marla"|"12marla", 
     status: "empty", 
     position: {x: number, z: number}, 
     bounds: {w: number, d: number}, 
     rotation: 0|180, 
     address: string 
   }
   Logic: calculate exact positions. Left side plots rotation=180. Right=0.
   Also export: export function getTownData(): TownData

3. TownScene.tsx
   R3F Canvas. Responsibilities:
   - Ground: Plane + canvas texture + receiveShadow
   - Roads: PlaneGeometry with y=0.02 offset to avoid z-fighting. Dark bone #B8AC96
   - Use InstancedMesh for: plotBoundaries, trees, streetlights, amenityBlocks
   - Trees: 2 per plot, randomized ±0.3m, use InstancedMesh
   - Plot ground: slightly darker tone than main ground to show buildable area
   - Lighting: warm golden-hour DirectionalLight + Ambient. Fog warm cream
   - Controls: OrbitControls. Clamped. Default camera: 45deg aerial, town centered
   - Shadows: 1 dir light, tight shadow camera
   - Performance: DPR [1, 1.75], frameloop="demand", <Stats /> from drei

4. TownCanvas.tsx
   Lazy wrapper. Export default component. Use React.lazy + Suspense.
   Parent will keep this mounted but hidden. Never unmount to keep WebGL context.

═══════════════════════════════════
VISUAL RULES
═══════════
- Palette: Ground #D8C9A3, Roads #B8AC96, Accents terracotta #C47A4B
- All repeated objects MUST use InstancedMesh
- Merge ground + roads geometry where possible
- Plot boundaries: thin box 0.1m high, terracotta

═══════════
DELIVERABLES ORDER
═══════════
1. town.config.ts with full types
2. layout-engine.ts with generateTownLayout + sample getTownData() output as comment
3. TownScene.tsx with all instanced components
4. TownCanvas.tsx lazy wrapper
5. README.md: Explain how Phase 2 will swap status:"empty" to load GLB bungalow

CONSTRAINTS: 
Do NOT add houses, interiors, raycasting, PointerLockControls. 
Code must be TypeScript, clean, commented. Use @react-three/fiber and @react-three/drei only.



THEN I HAVE MAKE THE ANOTHER PROMPT CHANGES... THAT is BELOW
PROMPT PROJECT  2 :
CHANGES TO MAKE TO 3D VIEW OF TOWN. DO THE follwoing.
You are a senior Three.js + R3F + TypeScript architect. 
Build "PropVerse" Town Phase 1 + 2. NO houses yet. NO walk controls.

═══════════
CORE LAYOUT VISION
═══════════════════════════════════
Town is split into 2 zones by 1 central Boulevard.

LEFT SIDE = RESIDENTIAL ZONE
RIGHT SIDE = CIVIC ZONE

This removes all extra roads. Final result = 1 Boulevard + 3 Streets + 6 Lines of plots

═══════════════════════════════════
DETAILED SPECIFICATIONS
═══════════════════════════════════

1. GROUND & WORLD
   - Size: 400m x 400m PlaneGeometry
   - Texture: Procedural canvas warm sand #D8C9A3 with subtle noise. receiveShadow=true
   - Perimeter Wall: 2m high, terracotta #C47A4B. 1 Main Gate on Boulevard

2. ROADS
   - 1 Boulevard: 12m wide, center, North-South. y=0.02. Color #B8AC96
   - 3 Streets: 8m wide, East-West. Spacing 110m apart. y=0.02
   - Remove all other roads. Only these 4 roads exist.

3. RESIDENTIAL ZONE - LEFT SIDE
   - 3 Streets. Each street has 2 sides = 6 LINES total
   - Per Line: 10 plots in a single straight line
   - Plot Sizes REAL SCALE in meters: 1 unit = 1 meter
     5marla: 7.6w x 13.7d | 7marla: 9.1w x 16.8d | 12marla: 10.7w x 21.3d
   - Gap between plots: 5m. Setback from road: 3m
   - Rotation: Left side of street rotation=180. Right side rotation=0
   - END of each of the 3 streets: Place 1 Market 30x20m + 1 Masjid 20x20m block. Clay tone
   - Trees: InstancedMesh. 2 trees per plot, randomized ±0.4m in front of setback
   - Streetlights: InstancedMesh. Every 20m along roads

4. CIVIC ZONE - RIGHT SIDE
   - NO PLOTS HERE. Only large civic blocks with 20m spacing between them
   - Blocks: Hospital 50x40m, FireStation 30x30m, PoliceStation 30x30m, School 60x40m
   - Position them in a 2x2 grid with proper spacing. Clay/Terracotta low-poly blocks
   - Add trees and parking area around them

5. DATA SYSTEM - CRITICAL
   town.config.ts: Single source of truth. All sizes, colors, counts here. Type-safe.
   layout-engine.ts: Pure functions. Export:
   export function generateTownLayout(): TownData
   export function getTownData(): TownData
   TownData must contain: streets[], plots[], amenities[], civic[]
   Plot type: {id, streetId, side:"left"|"right", size:"5marla"|"7marla"|"12marla", status:"empty", position:{x,z}, bounds:{w,d}, rotation:0|180, address:string}
   Log total plot count to console. Must be 60.

6. TOWNSCENE.tsx - R3F
   - Use InstancedMesh for: plotBoundaries, trees, streetlights, civicBlocks
   - Lighting: Warm golden DirectionalLight + Ambient. Fog warm cream #F5EFE2
   - Shadows: 1 dir light, tight shadow camera
   - Controls: OrbitControls. Clamped. Default: 45deg aerial, town centered
   - Performance: DPR [1, 1.75], frameloop="demand". Add <Stats />
   - Plot ground: Slightly darker sand tone to show buildable area

7. TOWNCANVAS.tsx
   - Lazy loaded with React.lazy + Suspense
   - Parent keeps it mounted but hidden

═══════════════════════════
VISUAL POLISH RULES
═══════════════════════════════════
Palette: Ground #D8C9A3, Roads #B8AC96, Accent #C47A4B
No blue/cyan/purple. Everything must look warm.
Merge geometries where possible. Target <50 draw calls.

═══════════
DELIVERABLES
═══════════════════════════
1. town.config.ts
2. layout-engine.ts + sample getTownData() output
3. TownScene.tsx
4. TownCanvas.tsx
5. README: Explain Phase 3 will swap plot.status:"empty" to load GLB bungalow

DO NOT ADD: Houses, Raycasting, Walk, Edit Mode. This is Phase 1+2 only. 

PROMPT 3 ..
follwoing changes i want now in this CURRENT open project in File explorere, 3D VIEW.

You are a senior R3F architect. Update "PropVerse" Town to match this blueprint EXACTLY.
CRITICAL: "M" = MARLA. 1 Marla = 25.3 sqm. 1 unit = 1 meter.
272.25 sqft.
═══════════
LAYOUT RULES
═══════════════════

1. GROUND: 180m x 180m = ~4 Acres

2. CENTER: "MAIN TWO WAY ROAD" Boulevard. 12m wide. Vertical.

3. LEFT SIDE = RESIDENTIAL ZONE
   - ONLY 2 Streets: "street 1 ROAD" and "street 2 ROAD". Each 8m wide, horizontal
   - Per Street: 2 rows of plots. 7 plots per row. Total = 28 plots
   - Row layout from blueprint: 
     Top row: [Market 15M] [5M] [7M] [5M] [5M] [7M] [12M]
     Mid row: [Masjid 10M] [5M] [7M] [7M] [5M] [5M] [7M] [7M]
     Bottom row: [Market 15M] [12M] [7M] [5M] [5M] [7M] [7M]
     Last row: [Masjid 10M] [12M] [7M] [5M] [12M] [7M] [7M]
   - REAL SIZES: 5M=7.6x13.7m, 7M=9.1x16.8m, 12M=10.7x21.3m
   - END of each street: Market 15M block + Masjid 10M block

4. RIGHT SIDE = CIVIC ZONE
   - Top: PARK+PLAYGROUND+SPORTS = 35M block
   - SCHOOL = 35M block
   - HOSPITAL = 35M block
   - Bottom row: [POLICE 15M] [FIRE 10M] [WAPDA 10M]
   - 8m roads between each civic row

5. CODE: layout-engine.ts
   export function generateTownLayout(): {plots:28, civic:6, totalMarla:436}
   Use InstancedMesh. Log counts.

DELIVER: town.config.ts, layout-engine.ts, TownScene.tsx
PHASE 1+2 ONLY. No houses.



PROMPT 4 :
You are a senior R3F architect on "PropVerse". Phase 1.5 polish is done 
but a QA screenshot revealed 7 specific defects. Fix EXACTLY these. 
NO new features. NO bungalows. NO redesign — surgical fixes only.

MASTER DIMENSIONS (single source of truth — verify everything against these):
- Town: 260m × 260m, centered at origin (x: -130 to +130, z: -130 to +130)
- Boulevard: 12m wide, runs full N-S length at x=0 (x: -6 to +6)
- Streets (3): 8m wide, run E-W, evenly spaced 60m apart starting z=-60 
  (street centers at z=-60, 0, +60; each spans x=-130 to +130)
- Block margin: 2m clear zone between any road edge and any building/plot
- All coordinates engine-derived ONLY. Zero hand-typed positions allowed.

═══════════════════════════════════
FIX 1 — RIGHT-SIDE FACILITY ROW (critical)
═══════════════════════════════════
Current: uneven scattered slabs. Rebuild per master plan, in order from 
NORTH (top, z=-130) to SOUTH (bottom, z=+130), each block FLUSH against 
the boulevard curb (starting x=+8, i.e. 2m margin from road edge at x=+6):
  1. Park + Sports:    z -130 to -88  (42m deep) — keep 60% as flat warm-
     grass zone with a running track outline, 40% sports court slabs
  2. School:           z -84 to -44  (40m deep)
  3. Hospital (GRAND): z -40 to +10  (50m deep)
  4. Police Station:   z +14 to +48  (34m deep)
  5. Fire Station:     z +52 to +82  (30m deep)
  6. WAPDA Block:      z +86 to +126 (40m deep)
All blocks: same width (x +8 to +126 = 118m), shared visual rhythm. 
Blocks must have REAL massing now: 0.5m plinth + walls + defined roof 
with 0.4m overhang max (current overhang clips past walls — fix). 
Hospital gets a main entrance canopy slab facing boulevard.

═══════════════════════════════════
FIX 2 — AMENITY BLOCK PROPORTIONS (critical)
═══════════════════════════════════
Rule: no facility block may exceed 2× the depth of the deepest plot 
row beside it. Current market/hospital slabs look 3-4× too deep — 
compress depth, keep footprints inside their assigned zones from Fix 1. 
Add rooftop detail to every block (water tank box, AC units, stair 
bulkhead) so none read as flat orange slabs.

═══════════════════════════════════
FIX 3 — STREETLIGHTS & TREES GRID
═══════════════════════════════════
Delete ALL current tree/light instances. Regenerate from layout data:
- Streetlights: instanced, every 12m along each street centerline 
  offset ±4m alternating sides, posts exactly y=0, never on road paint
- Trees: instanced, 2 per plot front setback, positioned at 1/3 and 
  2/3 of plot frontage (engine-computed, NOT random). No tree within 
  1m of any plot corner pin, road, or building
- Result must look like rows, not dots

═══════════════════════════════════
FIX 4 — PLOT BOUNDARY OVERFLOW ON ROADS
═══════════════════════════════════
Plot outline lines must stop at the plot rectangle — never extend 
onto roads. Audit: render each plot outline as 4 edge segments 
computed from plot corners only. Any line crossing a road plane 
or curb = bug, fix in layout-engine.

═══════════════════════════════════
FIX 5 — MASJID FIX
═══════════════════════════════════
Scale dome to 70% current size, recenter on block, minarets at inner 
corners not block corners. Block itself must sit with 2m margin from 
its street end.

═══════════════════════════════════
FIX 6 — BOUNDARY WALL + GATE
═══════════════════════════════════
Continuous 2.2m wall around town perimeter (instanced segments, warm 
stone #C9B896), single entrance arch straddling boulevard at south 
end (z=+130), 14m wide opening with two simple stone piers + arch 
lintel. No other openings.

═══════════════════════════════════
FIX 7 — PLOT ROW INTEGRITY
═══════════════════════════════════
Bottom-left row has one undersized squeezed plot — regenerate all 
plot rows from engine with the rule: each street-side row = sequence 
of 5M/7M/12M plots filling EXACTLY the available length, contiguous, 
last plot absorbs remainder by growing within its size class (never 
shrinking below its minimum). Re-run audit: every row's total length 
must equal street length minus end margins, ±0.1m.

═══════════════════════════════════
VERIFICATION (mandatory before done)
═══════════════════════════════════
After fixes, log a QA table: each facility block (actual vs assigned 
zone, pass/fail), each street (lights count, tree count), perimeter 
wall segment count, and confirm: zero hardcoded positions, zero 
boundary lines on roads, zero objects outside town bounds. 
Output BEFORE/AFTER per fix.