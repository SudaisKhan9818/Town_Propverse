# PropVerse Final QA Checklist

Audit date: 2026-09-10  
Scope: interaction/debug pass only. No layout transform or instance-count changes were made.

## Frozen-layout audit

| Check | Result | Evidence / note |
|---|---|---|
| Plot dimensions, 10-plot sample | PASS | `PLOT_SIZES` remains exactly 5M `7.6×13.7`, 7M `9.1×16.8`, 12M `10.7×21.3`; all generated plots use those values. |
| Plot front edge clearance | PASS | `layout-engine.ts` derives `frontZ` from `roadEdgeZ + PLOT_SETBACK * side`; `PLOT_SETBACK = 1.5`. |
| Boundary lines clear of road surface | PASS | Boundary matrices use plot corners and plot bounds only; nearest edge is the derived 1.5m setback. |
| Masjid dome and minarets | PASS | Existing dome/minaret matrices were not changed; current dome starts above the existing roof and minarets use the existing inner-corner margin. |
| Streetlight spacing and alternating sides | FAIL — frozen baseline | Current config is `STREETLIGHT_SPACING = 16`, with paired ± boulevard offsets. The requested 12m alternating grid would change frozen instances and was not applied. |
| Streetlight road clearance | PASS | Existing light positions are offset outside the boulevard road width. |
| Trees: two per plot | FAIL — frozen baseline | No tree instances are present in the current `TownScene`; adding them would change the frozen scene. |
| Civic facility flush/order audit | FAIL — frozen baseline | Existing engine has the correct civic type order, but current footprints are not all flush at x=+8. No transforms were changed. |
| Continuous 2.2m wall and south gate | PASS | Existing wall/gate matrices and constants remain unchanged. |

## Interaction audit

| Check | Result | Evidence / note |
|---|---|---|
| Focus enters as a mode | PASS | `TownScene` stores the pre-focus camera position/target and tween duration is 800ms with ease-out cubic. |
| X exits focus | PASS | `TownCanvas.closePanel()` clears selection and focus state; panel X calls it directly. |
| Escape exits focus | PASS | Global listener is installed in `TownCanvas` and cleaned up on unmount. |
| Empty ground/road exits focus | PASS | Ground and road events resolve no unit, clear selection, and clear focus. |
| Orbit around focused unit | PASS | OrbitControls remain enabled, target is locked to the unit, and pan is disabled during focus. |
| Walk toggle exits focus | PASS | Walk toggle calls `closePanel()` before changing mode. |
| Raycast nearest/priority | PASS | Intersections are sorted by distance, then plot > amenity > ground priority. |
| Single hover highlight | PASS | Every pointer move clears all plot instance colors before applying the next highlight. |
| Building collision bounds | PASS | Walk collision boxes are derived directly from each amenity/civic `bounds` footprint. |
| Mobile tap / Walk hidden | PASS | Pointer events remain active; `.walk-mode-toggle` is hidden at max-width 768px. |
| Demand rendering / DPR | PASS | Canvas remains `frameloop="demand"`, DPR remains `[1, 1.75]`, and focus animation frames are cancelled on cleanup. |

## Build verification

- `pnpm exec tsc --noEmit` — PASS
- `pnpm build` — PASS
- Frozen instance transform source audit — PASS: no position, scale, rotation, or count edits were made to the existing scene-generation blocks.
- Runtime logs emitted by `TownScene`: `FROZEN CHECK: PASS`, `LAYOUT FROZEN: PASS`.

## Freeze report

`LAYOUT FROZEN: PASS` for this debug pass: interaction, camera, metadata, and UI logic changed only; existing scene transforms and instance counts were preserved. The pre-existing checklist failures above require a separate layout-authorized phase and were intentionally not changed.
