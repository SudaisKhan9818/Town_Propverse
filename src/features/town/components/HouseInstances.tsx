'use client';

// ═══════════════════════════════════════════════════════════════════
// HouseInstances — all 25 houses in a handful of draw calls.
//
// Same idea as drei <Merged> (one InstancedMesh per GLB sub-mesh), plus
// per-house LOD: every house is assigned to its model's LOD0 or LOD1
// instanced set by camera distance, re-sorted only when the camera has
// moved. 3 house models × ≤2 parts × 2 LODs ≈ 6–10 draw calls total,
// instead of one draw call per sub-mesh per house.
//
// Placement (position, facing, uniform fit) comes from unit-placement.ts,
// exactly like <GlbUnit>. Each InstancedMesh carries
// userData.instances[instanceId] = { unitId, unitType, part, name }.
// Picking itself goes through the BVH hit proxy (one target per unit).
// ═══════════════════════════════════════════════════════════════════

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { UnitMeshUserData } from '@/src/shared/types/town';
import { DRACO_DECODER_PATH, UNIT_BASE_Y } from '../data/town.config';
import { fitToFootprint, type ModelBounds, type UnitPlacement } from '../data/unit-placement';
import { warmGrade } from '../materials/warm-grade';

/** Re-evaluate LOD membership once the camera has moved this far (m). */
const LOD_RESORT_DISTANCE = 4;

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrix: THREE.Matrix4;
}

function extractParts(scene: THREE.Object3D): Part[] {
  scene.updateMatrixWorld(true);
  const rootInverse = scene.matrixWorld.clone().invert();
  const parts: Part[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    parts.push({ geometry: mesh.geometry, material: mesh.material, matrix: rootInverse.clone().multiply(mesh.matrixWorld) });
  });
  return parts;
}

function measure(scene: THREE.Object3D): ModelBounds {
  const box = new THREE.Box3().setFromObject(scene, true);
  return { min: box.min.toArray() as ModelBounds['min'], max: box.max.toArray() as ModelBounds['max'] };
}

/** One house model (e.g. all 7-marla plots): two LOD sets of instanced parts. */
function ModelInstances({ placements }: { placements: UnitPlacement[] }) {
  const model = placements[0].model;
  const near = useGLTF(model.url, DRACO_DECODER_PATH).scene;
  const far = useGLTF(model.lod1 ?? model.url, DRACO_DECODER_PATH).scene;
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const lastSort = useRef<THREE.Vector3 | null>(null);

  const { group, levels, houseMatrices } = useMemo(() => {
    warmGrade(near);
    warmGrade(far);
    const bounds = measure(near);
    const matrices = placements.map((p) => {
      const fit = fitToFootprint(bounds, p.footprint, p.rotationY, p.margin);
      return new THREE.Matrix4()
        .compose(
          new THREE.Vector3(p.position.x, UNIT_BASE_Y, p.position.z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY),
          new THREE.Vector3(fit.scale, fit.scale, fit.scale),
        )
        .multiply(new THREE.Matrix4().makeTranslation(...fit.offset));
    });
    const root = new THREE.Group();
    root.name = `houses:${model.url.split('/').pop()}`;
    const makeLevel = (scene: THREE.Object3D, level: 'lod0' | 'lod1') => extractParts(scene).map((part, i) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      mesh.name = `${root.name}:${level}:${i}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      root.add(mesh);
      return { mesh, part };
    });
    return { group: root, levels: [makeLevel(near, 'lod0'), makeLevel(far, 'lod1')], houseMatrices: matrices };
  }, [far, model.url, near, placements]);

  const assign = () => {
    const scratch = new THREE.Matrix4();
    const members: number[][] = [[], []];
    placements.forEach((p, i) => {
      const dist = camera.position.distanceTo(new THREE.Vector3(p.position.x, 0, p.position.z));
      members[dist < p.lodDistance && model.lod1 ? 0 : model.lod1 ? 1 : 0].push(i);
    });
    levels.forEach((parts, level) => {
      parts.forEach(({ mesh, part }) => {
        const instances: UnitMeshUserData[] = [];
        members[level].forEach((houseIndex, slot) => {
          mesh.setMatrixAt(slot, scratch.multiplyMatrices(houseMatrices[houseIndex], part.matrix));
          const p = placements[houseIndex];
          instances.push({ unitId: p.unitId, unitType: p.unitType, part: 'building', name: `House ${p.unitId}` });
        });
        mesh.count = members[level].length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.userData.instances = instances;
      });
    });
  };

  useLayoutEffect(() => {
    assign();
    lastSort.current = camera.position.clone();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  useFrame(() => {
    if (!model.lod1) return;
    if (lastSort.current && lastSort.current.distanceToSquared(camera.position) < LOD_RESORT_DISTANCE ** 2) return;
    assign();
    lastSort.current = camera.position.clone();
  });

  return <primitive object={group} dispose={null} />;
}

export default function HouseInstances({ placements }: { placements: UnitPlacement[] }) {
  const byModel = useMemo(() => {
    const map = new Map<string, UnitPlacement[]>();
    placements.forEach((p) => map.set(p.model.url, [...(map.get(p.model.url) ?? []), p]));
    return Array.from(map.values());
  }, [placements]);
  return <>{byModel.map((group) => <ModelInstances key={group[0].model.url} placements={group} />)}</>;
}
