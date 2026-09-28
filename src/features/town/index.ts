// ═══════════════════════════════════════════════════════════════════
// PUBLIC API of the 3D town. The rest of the app (landing page, future
// chat/RAG UI) must import ONLY from here:
//
//   <TownCanvas visible onClose={...} />   full-screen 3D town overlay
//   selectTownUnit(id, { focus })          highlight a unit from outside
//   useSelectedTownUnit()                  read-only: the unit whose card is open
//
// Shared data shapes live in src/shared/types/town.ts.
// ═══════════════════════════════════════════════════════════════════

import type { UnitData } from '@/src/shared/types/town';
import { getUnitData } from './data/units';
import { useTownStore } from './store/town-store';

export { default as TownCanvas } from './scene/TownCanvas';

/** React hook: the unit currently shown in the details card (or null). */
export function useSelectedTownUnit(): UnitData | null {
  return useTownStore((s) => s.selectedUnit);
}

/**
 * Select a unit by id (e.g. 'P-12', 'civic-hospital', 'masjid-2') and,
 * by default, fly the camera to it. Resolves to false for unknown ids.
 * Safe to call before the town is open: the selection is waiting when
 * <TownCanvas> mounts.
 */
export async function selectTownUnit(id: string, options: { focus?: boolean } = {}): Promise<boolean> {
  const unit = await getUnitData(id);
  if (!unit) return false;
  const store = useTownStore.getState();
  if (store.cameraMode === 'walk') store.setCameraMode('orbit');
  store.select(unit, { focus: options.focus ?? true });
  return true;
}
