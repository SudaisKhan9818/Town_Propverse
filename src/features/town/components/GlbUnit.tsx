'use client';

// ═══════════════════════════════════════════════════════════════════
// GlbUnit — the ONE loader for every unit (houses, markets, masjids,
// civic blocks, park playground).
//
//   • useGLTF (Draco, cached per path) → drei <Clone> per unit, so no
//     two units ever share an Object3D.
//   • Uniform auto-fit to the frozen footprint minus 1m per side
//     (fitToFootprint — same maths the pick proxy and walk collision use).
//   • Front rotated to face the unit's street; base at y = 0.02.
//   • Optional LOD1 beyond `lodDistance` via drei <Detailed>.
//   • Wrapper group userData = { unitId, unitType, part: 'building' }.
//     Meshes have no pointer handlers: picking goes through the BVH hit
//     proxy (one target per unit).
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import * as THREE from 'three';
import { Clone, Detailed, useGLTF } from '@react-three/drei';
import type { UnitMeshUserData, UnitType } from '@/src/shared/types/town';
import { DRACO_DECODER_PATH, UNIT_BASE_Y } from '../data/town.config';
import { fitToFootprint, type ModelBounds } from '../data/unit-placement';
import { warmGrade } from '../materials/warm-grade';

export interface GlbUnitProps {
  unitId: string;
  unitType: UnitType;
  modelPath: string;
  /** Far level of detail (heavy models only). */
  lod1Path?: string;
  lodDistance?: number;
  /** Frozen footprint the model must fit inside (1m margin per side). */
  footprint: { w: number; d: number };
  margin?: number;
  position: { x: number; z: number };
  rotationY: number;
  /** Apply the golden-hour material grade (default on). */
  warmTint?: boolean;
}

function useGradedScene(path: string, warmTint: boolean) {
  const { scene } = useGLTF(path, DRACO_DECODER_PATH);
  // The cached scene is graded once; every <Clone> shares its materials.
  useMemo(() => { if (warmTint) warmGrade(scene); }, [scene, warmTint]);
  return scene;
}

function measure(scene: THREE.Object3D): ModelBounds {
  const box = new THREE.Box3().setFromObject(scene, true);
  return { min: box.min.toArray() as ModelBounds['min'], max: box.max.toArray() as ModelBounds['max'] };
}

export default function GlbUnit({
  unitId, unitType, modelPath, lod1Path, lodDistance = 80, footprint, margin, position, rotationY, warmTint = true,
}: GlbUnitProps) {
  const scene = useGradedScene(modelPath, warmTint);
  const farScene = useGradedScene(lod1Path ?? modelPath, warmTint);
  const fit = useMemo(
    () => fitToFootprint(measure(scene), footprint, rotationY, margin),
    [footprint, margin, rotationY, scene],
  );
  const userData = useMemo<UnitMeshUserData>(() => ({ unitId, unitType, part: 'building' }), [unitId, unitType]);

  const level = (object: THREE.Object3D) => (
    <Clone object={object} position={fit.offset} castShadow receiveShadow />
  );

  return (
    <group
      name={`unit:${unitId}`}
      userData={userData}
      position={[position.x, UNIT_BASE_Y, position.z]}
      rotation={[0, rotationY, 0]}
      scale={fit.scale}
    >
      {lod1Path ? (
        <Detailed distances={[0, lodDistance]}>
          {level(scene)}
          {level(farScene)}
        </Detailed>
      ) : level(scene)}
    </group>
  );
}
