import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { COLORS } from './town.config';

interface SmallStreetLightProps {
  lights: { position: { x: number; z: number } }[];
}

export default function SmallStreetLight({ lights }: SmallStreetLightProps) {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!poleRef.current || !capRef.current || !bulbRef.current) return;

    lights.forEach((l, i) => {
      const px = l.position.x;
      const pz = l.position.z;
      const h = 0.9;

      // Pole (0.9 height, radius 0.02)
      dummy.position.set(px, h / 2, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleRef.current!.setMatrixAt(i, dummy.matrix);

      // Top Cap (0.08 x 0.04 x 0.08)
      dummy.position.set(px, h, pz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      capRef.current!.setMatrixAt(i, dummy.matrix);

      // Bulb (tiny sphere under cap, radius 0.03)
      dummy.position.set(px, h - 0.04, pz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulbRef.current!.setMatrixAt(i, dummy.matrix);
    });

    poleRef.current.instanceMatrix.needsUpdate = true;
    capRef.current.instanceMatrix.needsUpdate = true;
    bulbRef.current.instanceMatrix.needsUpdate = true;
  }, [lights, dummy]);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, lights.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
        <meshBasicMaterial color={COLORS.pole} />
      </instancedMesh>

      <instancedMesh ref={capRef} args={[undefined, undefined, lights.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <boxGeometry args={[0.08, 0.04, 0.08]} />
        <meshBasicMaterial color={COLORS.wall} />
      </instancedMesh>

      <instancedMesh ref={bulbRef} args={[undefined, undefined, lights.length]} castShadow={false} receiveShadow={false} frustumCulled={false}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshBasicMaterial color={COLORS.lightBulb} />
      </instancedMesh>
    </group>
  );
}
