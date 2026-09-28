'use client';

// ═══════════════════════════════════════════════════════════════════
// HitProxy — the ONLY raycast target for units.
//
// One invisible merged mesh of simple boxes (fitted GLB building box +
// plot/parcel pad per unit). Wrapped in drei <Bvh>, so hover/click is a BVH lookup
// against a few hundred triangles instead of brute-force tests against
// every triangle of every GLB. Each vertex carries `unitIndex`; the hit
// face's first vertex resolves back to userData.boxes[unitIndex].
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { UnitMeshUserData } from '@/src/shared/types/town';
import { getTownData } from '../data/layout-engine';
import { PARK_PARCEL } from '../data/park';
import { UNIT_BASE_Y } from '../data/town.config';
import { PLACEMENTS, fittedRect } from '../data/unit-placement';
import { mergeGeometries } from './geometry';

const TOWN = getTownData();

interface ProxyBox {
  meta: UnitMeshUserData;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

function buildBoxes(): ProxyBox[] {
  // One building box per unit: the fitted GLB footprint × fitted height
  // (same fitToFootprint maths <GlbUnit> uses at runtime).
  const boxes: ProxyBox[] = PLACEMENTS.filter((p) => p.kind !== 'park').map((p) => {
    const r = fittedRect(p);
    return {
      meta: { unitId: p.unitId, unitType: p.unitType, part: 'building', name: p.kind === 'house' ? `House ${p.unitId}` : p.unitId },
      min: new THREE.Vector3(r.minX, 0, r.minZ),
      max: new THREE.Vector3(r.maxX, UNIT_BASE_Y + p.fit.h, r.maxZ),
    };
  });

  // Low pads so yards, forecourts and the park lawn are clickable too.
  const pad = (unitId: string, unitType: UnitMeshUserData['unitType'], x: number, z: number, w: number, d: number, h: number) => boxes.push({
    meta: { unitId, unitType, part: 'pad' },
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  });
  TOWN.plots.forEach((p) => pad(p.id, 'plot', p.position.x, p.position.z, p.bounds.w, p.bounds.d, 1.3));
  TOWN.amenities.forEach((a) => pad(a.id, 'civic', a.position.x, a.position.z, a.bounds.w, a.bounds.d, 0.6));
  TOWN.civic.filter((c) => c.type !== 'park').forEach((c) => pad(c.id, 'civic', c.position.x, c.position.z, c.bounds.w, c.bounds.d, 0.6));
  const park = TOWN.civic.find((c) => c.type === 'park')!;
  pad(park.id, 'civic', PARK_PARCEL.x, PARK_PARCEL.z, PARK_PARCEL.w - 1, PARK_PARCEL.d - 1, 0.3);
  return boxes;
}

function buildGeometry(boxes: ProxyBox[]): THREE.BufferGeometry {
  const parts = boxes.map((b, index) => {
    const size = new THREE.Vector3().subVectors(b.max, b.min);
    const center = new THREE.Vector3().addVectors(b.min, b.max).multiplyScalar(0.5);
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
    geometry.deleteAttribute('uv');
    geometry.deleteAttribute('normal');
    const ids = new Float32Array(geometry.attributes.position.count).fill(index);
    geometry.setAttribute('unitIndex', new THREE.BufferAttribute(ids, 1));
    return geometry;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function resolveUnit(event: ThreeEvent<PointerEvent | MouseEvent>): UnitMeshUserData | null {
  const face = event.face;
  const mesh = event.object as THREE.Mesh;
  const attr = mesh.geometry?.getAttribute('unitIndex');
  const boxes = mesh.userData.boxes as ProxyBox[] | undefined;
  if (!face || !attr || !boxes) return null;
  return boxes[attr.getX(face.a)]?.meta ?? null;
}

interface Props {
  onHover: (unit: UnitMeshUserData | null) => void;
  onSelect: (unit: UnitMeshUserData, event: ThreeEvent<MouseEvent>) => void;
  onFocus: (unit: UnitMeshUserData, event: ThreeEvent<MouseEvent>) => void;
  enabled: boolean;
}

export default function HitProxy({ onHover, onSelect, onFocus, enabled }: Props) {
  const boxes = useMemo(buildBoxes, []);
  const geometry = useMemo(() => buildGeometry(boxes), [boxes]);
  const userData = useMemo(() => ({ boxes }), [boxes]);

  return (
    <mesh
      geometry={geometry}
      visible={false}
      userData={userData}
      onPointerMove={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        onHover(resolveUnit(e));
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        if (!enabled || e.delta > 5) return;
        e.stopPropagation();
        // A double-click emits two clicks; the dblclick handler owns it.
        if (e.nativeEvent.detail > 1) return;
        const unit = resolveUnit(e);
        if (unit) onSelect(unit, e);
      }}
      onDoubleClick={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        const unit = resolveUnit(e);
        if (unit) onFocus(unit, e);
      }}
    >
      <meshBasicMaterial />
    </mesh>
  );
}
