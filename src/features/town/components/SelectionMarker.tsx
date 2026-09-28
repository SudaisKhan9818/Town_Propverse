'use client';

// SelectionMarker — a flat footprint frame drawn around the hovered
// (bone) and selected (clay) unit. Purely visual; never touches layout.

import { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/src/shared/theme/tokens';
import { getUnitGeometry } from '../data/units';
import { useTownStore } from '../store/town-store';

function frameGeometry(w: number, d: number, width: number): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - width, -d / 2 - width);
  outer.lineTo(w / 2 + width, -d / 2 - width);
  outer.lineTo(w / 2 + width, d / 2 + width);
  outer.lineTo(-w / 2 - width, d / 2 + width);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -d / 2);
  hole.lineTo(-w / 2, d / 2);
  hole.lineTo(w / 2, d / 2);
  hole.lineTo(w / 2, -d / 2);
  hole.closePath();
  outer.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(outer);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function Frame({ unitId, color, opacity, width }: { unitId: string; color: string; opacity: number; width: number }) {
  const geo = getUnitGeometry(unitId);
  const geometry = useMemo(
    () => (geo ? frameGeometry(geo.footprint.w + 0.6, geo.footprint.d + 0.6, width) : null),
    [geo, width],
  );
  if (!geo || !geometry) return null;
  return (
    <mesh geometry={geometry} position={[geo.position.x, 0.08, geo.position.z]} renderOrder={2}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export default function SelectionMarker() {
  const selectedId = useTownStore((s) => s.selectedUnit?.id ?? null);
  const hoveredId = useTownStore((s) => s.hoveredUnitId);
  const walking = useTownStore((s) => s.cameraMode === 'walk');
  if (walking) return null;
  return (
    <group>
      {hoveredId && hoveredId !== selectedId && (
        <Frame unitId={hoveredId} color={COLORS.paper} opacity={0.85} width={0.35} />
      )}
      {selectedId && <Frame unitId={selectedId} color={COLORS.terracotta} opacity={0.95} width={0.55} />}
    </group>
  );
}
