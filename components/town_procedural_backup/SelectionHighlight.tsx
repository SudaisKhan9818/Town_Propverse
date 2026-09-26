'use client';
import React from 'react';
import * as THREE from 'three';

/**
 * SelectionHighlight — frozen-geometry marker.
 *
 * NOT a selector (geometry has frozen guarantee). A purely visual helper
 * rendered OUTSIDE the frozen model subtree — a lightweight outline ring
 * that follows the selected plot/amenity centre. It never mutates any
 * instanced mesh, never flags WITHIN the frozen geometry, and is only
 * mounted when something is selected.
 */
export default function SelectionHighlight({
  target,
  colour = '#C47A4B',
}: {
  target: { x: number; z: number } | null;
  colour?: string;
}) {
  if (!target) return null;

  return (
    <group position={[target.x, 0.02, target.z]}>
      {/* Ground ring — sits just above the sand so it never z-fights. */}
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[1.1, 1.45, 48]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Thin vertical halo to give the marker some presence when viewed
          obliquely (OrbitControls aerial) without touching any real geo. */}
      <mesh position={[0, 0.2, 0]} scale={[1.7, 0.3, 1.7]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
