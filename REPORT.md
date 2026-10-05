# PropVerse Town Digital Twin — Master Review & Audit

Audit date: 2026-09-30  
Scope: static implementation review plus TypeScript validation. No source code was modified during this review.

## Overall result

**PASS with two architectural caveats.** The browser-based fake digital twin flow is implemented: schema → five-second simulation → risk/watt calculations → R3F holograms → Recharts history → grid/road power control.

The implementation does **not** contain real sensors, edge computing, or an actual MQTT transport. The current trigger is a browser timer, which is appropriate for the fake-data prototype but is not a literal MQTT workflow.

## 1. Step 1 — Schema

**PASS** — `src/data/twin_schema.json`

- Valid JSON confirmed.
- 75 lights exist: `LIGHT-01` through `LIGHT-75`.
- Grid distribution is correct: `GRID-A` 25, `GRID-B` 25, `GRID-C` 25.
- All six roads are assigned: `Road-1` through `Road-6`.
- Initial light temperatures are within 35–45.
- `GRID-MAIN` exists with `capacity_watt: 15000`.
- Each light has the required base watt, live state, risk, and limits.

## 2. Step 2 — Simulation

**PASS** — `src/features/twin/hooks/useTwinSimulation.ts`

- Uses a `5_000ms` browser interval.
- Temperature increases by `0.5 + Math.random() * 2`, producing the requested 0.5–2.5 range.
- Watt formula is `base_watt * (temp / 40)`; the schema base is 150 watts.
- Risk rules are correct: above 70 → `0.9`, above 60 → `0.6`, otherwise `0.1`.
- Total consumption sums all light watt values.
- Production is `total_consumption * 1.1`.
- History is capped at the last 20 points and includes GRID-A, GRID-B, GRID-C, and total values.
- Returns `twinData` and `history`; it also exposes `updateTwinData` for controls.
- No Three.js or dashboard code is inside the hook.

## 3. Step 3 — Visualization

### `TwinPole.tsx`

**PASS**

- Risk colors are white, yellow, orange, and red at the requested thresholds.
- Critical risk above 0.8 uses red emissive flicker logic.
- Drei `<Html>` displays ID, watt, temperature, risk, and status.

### `TwinGridOverlay.tsx`

**PASS**

- Does not modify the WAPDA GLB.
- Uses the existing WAPDA placement for the overlay position.
- Shows GRID-A, GRID-B, and GRID-C consumption holograms.
- Shows GRID-MAIN total consumption and production.
- Contains the red transparent sphere condition when grid temperature exceeds 50°C.

### `TwinControlPanel.tsx`

**PASS**

- Recharts graph includes GRID-A, GRID-B, GRID-C, and total.
- Includes OFF GRID-A/B/C controls.
- Includes OFF ROAD-1 through ROAD-6 controls.
- Power-off updates status to `OFF`, watt to `0`, and recalculates grid totals and production.
- OFF lights remain at zero watt during later simulation ticks.

## 4. Step 4 — TownScene Integration

**PASS with one placement caveat** — `src/features/town/scene/TownScene.tsx`

- `useTwinSimulation()` is called.
- Static rendered poles were replaced with 75 `TwinPole` instances.
- Existing `STREET_LIGHTS` positions are reused; verified count is 75.
- `TwinGridOverlay` is placed at the existing `civic-wapda` GLB placement.
- The control panel is rendered as a full-screen Drei HTML overlay and receives the live history and power-off callback.
- Expected flow is wired: rising temperatures change pole colors, watt history rises, OFF controls set watt to zero, and poles become non-emissive/off.

### Caveat: Canvas boundary

The control panel is visually outside the WebGL drawing area, but it is mounted through `<Html fullscreen>` inside the R3F Canvas tree. If strict DOM separation is required, move the panel to a sibling HTML element in `TownCanvas.tsx` and lift the twin state there.

## 5. Overall Digital Twin Definition

**PASS for the browser prototype; FAIL for literal MQTT transport.**

- The GLB remains static and is not recolored.
- Twin effects are overlays, pole materials, holograms, and control state.
- Fake sensor values use real deterministic formulas and state transitions.
- The browser acts as the simulation/logic host; no extra edge device is required.
- The current trigger is `window.setInterval`, not MQTT. There is no MQTT client, broker, or message bus in this implementation.

## Missing parts and suggested fixes

1. **Actual fake MQTT layer:** Add a browser-only mocked MQTT/event adapter if MQTT message semantics are required. Keep the current hook as the logic consumer.
2. **Strict outside-Canvas panel:** Hoist twin state into `TownCanvas.tsx`, then render `TwinControlPanel` as a sibling HTML overlay.
3. **Grid overheating visualization:** `grid_station.live.temp` currently remains at its schema value of 40°C, so the red grid sphere will not activate from the current simulation alone. Add a grid-temperature calculation in a future simulation step if that behavior is required.
4. **Continuous flicker under demand rendering:** `TownCanvas` uses `frameloop="demand"`. For continuous emissive flicker, switch the twin scene to continuous rendering while critical poles exist, or call R3F `invalidate()` during flicker.

## Validation

- `npx tsc --noEmit`: **PASS**
- Schema JSON parse/count validation: **PASS**
- Streetlight position count: **75**
- No real sensor or edge-device code found: **PASS**
