import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { COLORS } from './town.config';

interface PremiumStreetLightProps {
  lights: { position: { x: number; z: number } }[];
}

export default function PremiumStreetLight({ lights }: PremiumStreetLightProps) {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!poleRef.current || !armRef.current || !bulbRef.current || !capRef.current) return;

    lights.forEach((l, i) => {
      // Need to determine rotation. Simple heuristic: if x is near the center boulevard, face outward, etc.
      // But we can just have them all face a certain way or point to the nearest road.
      // Since layout alternates, we can just rotate them based on x and z slightly or just use a generic rotation.
      // For simplicity, let's make it an omni-directional top or a simple curved top.
      
      const px = l.position.x;
      const pz = l.position.z;
      const h = 2.5;

      // Pole (Base + Main Cylinder)
      dummy.position.set(px, h / 2, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      poleRef.current!.setMatrixAt(i, dummy.matrix);

      // Top Cap
      dummy.position.set(px, h, pz);
      dummy.scale.set(1.5, 0.2, 1.5);
      dummy.updateMatrix();
      capRef.current!.setMatrixAt(i, dummy.matrix);

      // Arm (Ring or double arm) - making it unique
      // Let's make a halo ring at the top instead of a directional arm!
      dummy.position.set(px, h - 0.2, pz);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      armRef.current!.setMatrixAt(i, dummy.matrix);

      // Bulb inside the halo
      dummy.position.set(px, h - 0.2, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulbRef.current!.setMatrixAt(i, dummy.matrix);
    });

    poleRef.current.instanceMatrix.needsUpdate = true;
    capRef.current.instanceMatrix.needsUpdate = true;
    armRef.current.instanceMatrix.needsUpdate = true;
    bulbRef.current.instanceMatrix.needsUpdate = true;
  }, [lights, dummy]);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, lights.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.12, 1, 8]} />
        <meshStandardMaterial color={COLORS.pole} roughness={0.4} metalness={0.6} />
      </instancedMesh>

      <instancedMesh ref={capRef} args={[undefined, undefined, lights.length]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
        <meshStandardMaterial color={COLORS.pole} roughness={0.4} metalness={0.6} />
      </instancedMesh>

      <instancedMesh ref={armRef} args={[undefined, undefined, lights.length]} castShadow>
        <torusGeometry args={[0.25, 0.03, 8, 16]} />
        <meshStandardMaterial color={COLORS.pole} roughness={0.4} metalness={0.6} />
      </instancedMesh>

      <instancedMesh ref={bulbRef} args={[undefined, undefined, lights.length]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={COLORS.lightBulb} emissive={COLORS.lightBulb} emissiveIntensity={1} />
      </instancedMesh>

      {/* Point Lights - Added as requested, with low distance to avoid performance drops */}
      {lights.map((l, i) => (
        <pointLight
          key={i}
          position={[l.position.x, 2.3, l.position.z]}
          color={COLORS.lightBulb}
          intensity={0.5}
          distance={8}
          decay={2}
        />
      ))}
    </group>
  );
}
