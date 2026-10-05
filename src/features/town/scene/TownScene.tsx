'use client';

// ═══════════════════════════════════════════════════════════════════
// TownScene — composition only. Layout comes from data/, geometry from
// components/, feel from controls/, look from scene/Atmosphere.
//
// Interaction model (unchanged from the original town):
//   click a unit        → details card (store.select)
//   double-click a unit → focus camera on it (+ card)
//   click empty ground  → close card + exit focus
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useEffect } from 'react';
import { Bvh, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { UnitMeshUserData } from '@/src/shared/types/town';
import { getUnitData } from '../data/units';
import { useTownStore } from '../store/town-store';
import Ground from '../components/Ground';
import Roads from '../components/Roads';
import StreetLights from '../components/StreetLights';
import PlotPads from '../components/PlotPads';
import Lawns from '../components/Lawns';
import Trees from '../components/Trees';
import BoundaryWall from '../components/BoundaryWall';
import Gate from '../components/Gate';
import GlbUnits, { preloadUnits } from '../components/GlbUnits';
import HouseInstances from '../components/HouseInstances';
import HitProxy from '../components/HitProxy';
import SelectionMarker from '../components/SelectionMarker';
import GovComplex from '../components/GovComplex';
import { CIVIC_PLACEMENTS, HOUSE_PLACEMENTS } from '../data/unit-placement';
import OrbitProfile from '../controls/OrbitProfile';
import FocusRig from '../controls/FocusRig';
import WalkMode from '../controls/WalkMode';
import Atmosphere from './Atmosphere';
import PerformanceSystem from './PerformanceSystem';
import { RevealController, RevealGroup } from './Reveal';
import DebugBridge from './DebugBridge';
import { getTownData } from '../data/layout-engine';

// Civic models start downloading as soon as the scene module loads;
// houses once the ground is on screen (see effect below).
preloadUnits(CIVIC_PLACEMENTS);
const TOWN = getTownData();

const ROAD_LABELS = ['Main Road', 'Street 2', 'Street 1', 'Civic Road North', 'Civic Road South', 'School Hospital Road'];
const LAYOUT_ROAD_NAMES: Record<string, string> = {
  boulevard: 'Main Road',
  'street-2': 'St-2',
  'street-1': 'St-1',
  'civic-road-1': 'Civic Road North',
  'civic-road-2': 'Civic Road South',
  'school-hospital-road': 'School Hospital Road',
};

export default function TownScene() {
  const walking = useTownStore((s) => s.cameraMode === 'walk');
  const groundReady = useTownStore((s) => s.readyStage >= 1);
  useEffect(() => { if (groundReady) preloadUnits(HOUSE_PLACEMENTS); }, [groundReady]);
  const setHovered = useTownStore((s) => s.setHovered);

  const onHover = useCallback((unit: UnitMeshUserData | null) => {
    setHovered(unit?.unitId ?? null);
    document.body.style.cursor = unit ? 'pointer' : '';
  }, [setHovered]);

  const onSelect = useCallback(async (unit: UnitMeshUserData) => {
    const data = await getUnitData(unit.unitId);
    if (data) useTownStore.getState().select(data);
  }, []);

  const onFocus = useCallback(async (unit: UnitMeshUserData) => {
    const data = await getUnitData(unit.unitId);
    if (data) useTownStore.getState().select(data, { focus: true });
  }, []);

  const onEmptyClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return; // that was an orbit drag, not a click
    const { cameraMode, deselect, setCameraMode } = useTownStore.getState();
    if (cameraMode === 'walk') return;
    deselect();
    if (cameraMode === 'focus') setCameraMode('orbit');
  }, []);

  return (
    <>
      <Atmosphere />
      <RevealController />

      <RevealGroup stage={1}>
        <Bvh firstHitOnly>
          <Ground onEmptyClick={onEmptyClick} />
        </Bvh>
        <Roads />
        <StreetLights />
        {TOWN.streets.map((road, index) => (
          <Html key={road.id} position={[road.position.x, 3.5, road.position.z]} center distanceFactor={12}>
            <div className="rounded border border-white/20 bg-black/60 px-2 py-1 text-[11px] font-mono text-cyan-200 backdrop-blur" style={{ whiteSpace: 'nowrap' }}>
              ROAD-{index + 1} · {ROAD_LABELS[index]}
            </div>
          </Html>
        ))}
        {TOWN.streets.filter((road) => road.id === 'street-1' || road.id === 'street-2').map((road) => (
          <Html key={`label-${road.id}`} position={[road.position.x, 2.5, road.position.z]} center distanceFactor={12}>
            <div className="rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-[9px] font-mono text-cyan-100 backdrop-blur" style={{ whiteSpace: 'nowrap' }}>
              {LAYOUT_ROAD_NAMES[road.id]}
            </div>
          </Html>
        ))}
        <PlotPads />
        <Lawns />
        <BoundaryWall />
        <Gate />
        <GovComplex />
      </RevealGroup>

      {/* GLB unit layer: civic, markets, masjids, park playground … */}
      <RevealGroup stage={2} rise>
        <GlbUnits placements={CIVIC_PLACEMENTS} />
      </RevealGroup>

      {/* … then houses, last (instanced per model + per-house LOD). Trees rise with them. */}
      <RevealGroup stage={3} rise>
        <HouseInstances placements={HOUSE_PLACEMENTS} />
        <Trees />
      </RevealGroup>

      <RevealGroup stage={3}>
        <Bvh firstHitOnly>
          <HitProxy enabled={!walking} onHover={onHover} onSelect={onSelect} onFocus={onFocus} />
        </Bvh>
      </RevealGroup>

      <SelectionMarker />
      <OrbitProfile />
      <FocusRig />
      <WalkMode />
      <PerformanceSystem />
      <DebugBridge />
    </>
  );
}
