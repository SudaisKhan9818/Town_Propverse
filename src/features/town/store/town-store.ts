// ═══════════════════════════════════════════════════════════════════
// town-store.ts — UI ↔ 3D state for the town (Zustand).
//
// DESIGNED FOR THE FUTURE CHAT/RAG MODULE
// ---------------------------------------
// A chat answer that mentions a plot highlights it with ONE call:
//
//   import { selectTownUnit } from '@/src/features/town';
//   await selectTownUnit('P-12');                 // select + fly camera to it
//   await selectTownUnit('civic-hospital', { focus: false }); // card only
//
// selectTownUnit() resolves the record through getUnitData(id) and then
// calls `select()` below. Callers outside src/features/town should use
// selectTownUnit() — never import this store directly.
//
//   select(unit, { focus })  opens the details card for `unit`; with
//                            focus (default false) the camera tweens to
//                            it and cameraMode becomes 'focus'.
//   deselect()               closes the card; camera stays where it is.
//   setCameraMode(mode)      'orbit' | 'walk' | 'focus'. Leaving 'focus'
//                            tweens the camera back to its pre-focus pose.
//
// Everything is plain serialisable data (UnitData from
// shared/types/town.ts), so the chat layer can also subscribe:
//   useTownStore.subscribe((s) => s.selectedUnit, (unit) => ...)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Footprint, Point2, UnitData } from '@/src/shared/types/town';

export type CameraMode = 'orbit' | 'walk' | 'focus';

export interface FocusTarget {
  position: Point2;
  footprint?: Footprint;
  /** Bumped on every request so re-focusing the same unit replays the tween. */
  nonce: number;
}

export type RevealStage = 0 | 1 | 2 | 3;

export interface TownState {
  selectedUnit: UnitData | null;
  hoveredUnitId: string | null;
  cameraMode: CameraMode;
  focusTarget: FocusTarget | null;
  /** Pointer lock is active (walk mode actually steering). */
  walkLocked: boolean;
  /** Incremented to ask WalkMode for pointer lock (needs a user gesture). */
  walkLockRequest: number;
  /** 0 nothing · 1 ground+roads · 2 +civic/markets/masjids · 3 +houses. */
  revealStage: RevealStage;
  /** Highest stage whose content (incl. GLBs) has loaded and mounted. */
  readyStage: RevealStage;
  /** Lowered by the PerformanceMonitor when fps stays under 45. */
  quality: 'high' | 'low';

  select: (unit: UnitData, options?: { focus?: boolean }) => void;
  deselect: () => void;
  setCameraMode: (mode: CameraMode) => void;
  focusOn: (position: Point2, footprint?: Footprint) => void;
  setHovered: (unitId: string | null) => void;
  setWalkLocked: (locked: boolean) => void;
  requestWalkLock: () => void;
  setRevealStage: (stage: RevealStage) => void;
  setReadyStage: (stage: RevealStage) => void;
  setQuality: (quality: 'high' | 'low') => void;
  reset: () => void;
}

let focusNonce = 0;

export const useTownStore = create<TownState>()(subscribeWithSelector((set, get) => ({
  selectedUnit: null,
  hoveredUnitId: null,
  cameraMode: 'orbit',
  focusTarget: null,
  walkLocked: false,
  walkLockRequest: 0,
  revealStage: 0,
  readyStage: 0,
  quality: 'high',

  select: (unit, options) => {
    // The card never opens over walk mode; a chat-driven select exits it.
    if (get().cameraMode === 'walk' && !options?.focus) return;
    set({ selectedUnit: unit });
    if (options?.focus && unit.position) get().focusOn(unit.position, unit.footprint);
  },

  deselect: () => set({ selectedUnit: null }),

  setCameraMode: (mode) => set((state) => ({
    cameraMode: mode,
    focusTarget: mode === 'focus' ? state.focusTarget : null,
    walkLocked: mode === 'walk' ? state.walkLocked : false,
    selectedUnit: mode === 'walk' ? null : state.selectedUnit,
    walkLockRequest: mode === 'walk' && state.cameraMode !== 'walk' ? state.walkLockRequest + 1 : state.walkLockRequest,
  })),

  focusOn: (position, footprint) => {
    focusNonce += 1;
    set({ cameraMode: 'focus', focusTarget: { position, footprint, nonce: focusNonce }, walkLocked: false });
  },

  setHovered: (unitId) => {
    if (get().hoveredUnitId !== unitId) set({ hoveredUnitId: unitId });
  },
  setWalkLocked: (locked) => set({ walkLocked: locked }),
  requestWalkLock: () => set((s) => ({ walkLockRequest: s.walkLockRequest + 1 })),
  setRevealStage: (stage) => set((s) => ({ revealStage: Math.max(s.revealStage, stage) as RevealStage })),
  setReadyStage: (stage) => set((s) => ({ readyStage: Math.max(s.readyStage, stage) as RevealStage })),
  setQuality: (quality) => set({ quality }),
  reset: () => set({
    selectedUnit: null, hoveredUnitId: null, cameraMode: 'orbit', focusTarget: null, walkLocked: false,
  }),
})));
