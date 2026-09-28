'use client';

// ═══════════════════════════════════════════════════════════════════
// StreetLights — every pole from data/streetlights.ts, rendered through
// drei <Merged> (4 draw calls total) while each pole is still its own
// named Object3D for digital-twin mapping:
//
//   scene.getObjectByName('StreetLightsGroup')
//     └─ LIGHT_001 … LIGHT_NNN   userData: { twinId, kind, roadId }
//
// Low-poly: tapered pole + base + arm + lamp head in one geometry, and a
// separate small emissive bulb. Median poles carry two arms.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import * as THREE from 'three';
import { Merged } from '@react-three/drei';
import { COLORS } from '@/src/shared/theme/tokens';
import { STREET_LIGHTS } from '../data/streetlights';
import { mergeGeometries } from './geometry';

const POLE_H = 6.4;
const ARM = 1.5;

function poleGeometry(arms: 1 | 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8).translate(0, 0.25, 0),
    new THREE.CylinderGeometry(0.065, 0.11, POLE_H, 8).translate(0, POLE_H / 2, 0),
  ];
  for (const dir of arms === 1 ? [1] : [1, -1]) {
    parts.push(new THREE.BoxGeometry(ARM, 0.08, 0.08).translate((dir * ARM) / 2, POLE_H - 0.12, 0));
    parts.push(new THREE.BoxGeometry(0.72, 0.14, 0.3).translate(dir * (ARM + 0.1), POLE_H - 0.2, 0));
  }
  const nonIndexed = parts.map((g) => g.toNonIndexed());
  parts.forEach((g) => g.dispose());
  const merged = mergeGeometries(nonIndexed, false)!;
  nonIndexed.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

function bulbGeometry(arms: 1 | 2): THREE.BufferGeometry {
  const parts = (arms === 1 ? [1] : [1, -1]).map((dir) => new THREE.BoxGeometry(0.5, 0.04, 0.2).translate(dir * (ARM + 0.1), POLE_H - 0.29, 0));
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

export default function StreetLights() {
  const meshes = useMemo(() => {
    const metal = new THREE.MeshStandardMaterial({ color: '#3B3833', roughness: 0.55, metalness: 0.2 });
    const glow = new THREE.MeshStandardMaterial({
      color: COLORS.sunKey, emissive: '#FFD58A', emissiveIntensity: 1.4, toneMapped: false,
    });
    return {
      EdgePole: new THREE.Mesh(poleGeometry(1), metal),
      EdgeBulb: new THREE.Mesh(bulbGeometry(1), glow),
      MedianPole: new THREE.Mesh(poleGeometry(2), metal),
      MedianBulb: new THREE.Mesh(bulbGeometry(2), glow),
    };
  }, []);

  return (
    <Merged meshes={meshes} receiveShadow>
      {({ EdgePole, EdgeBulb, MedianPole, MedianBulb }) => (
        <group name="StreetLightsGroup">
          {STREET_LIGHTS.map((light) => (
            <group
              key={light.id}
              name={light.id}
              position={[light.x, 0, light.z]}
              rotation={[0, light.rotationY, 0]}
              userData={{ twinId: light.id, kind: light.kind, roadId: light.roadId }}
            >
              {light.kind === 'median' ? <><MedianPole /><MedianBulb /></> : <><EdgePole /><EdgeBulb /></>}
            </group>
          ))}
        </group>
      )}
    </Merged>
  );
}
