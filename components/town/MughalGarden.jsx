'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

function createInstances(count, makeMatrix) {
  const matrices = [];
  for (let index = 0; index < count; index += 1) {
    const matrix = new THREE.Matrix4();
    makeMatrix(matrix, index);
    matrices.push(matrix);
  }
  return matrices;
}

function InstanceSet({ geometry, material, matrices }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    matrices.forEach((matrix, index) => ref.current.setMatrixAt(index, matrix));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} />;
}

export default function MughalGarden({ position = [0, 0, 0], width = 28, depth = 20 }) {
  const channel = 0.2;
  const margin = 1.4;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const treeRadius = Math.min(width, depth) * 0.06;

  const treeMatrices = useMemo(() => createInstances(4, (matrix, index) => {
    const x = index % 2 === 0 ? -halfWidth + margin : halfWidth - margin;
    const z = index < 2 ? -halfDepth + margin : halfDepth - margin;
    matrix.compose(
      new THREE.Vector3(x, 2.1, z),
      new THREE.Quaternion(),
      new THREE.Vector3(treeRadius, 4.2, treeRadius),
    );
  }), [halfDepth, halfWidth, margin, treeRadius]);

  const roseMatrices = useMemo(() => createInstances(12, (matrix, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const radiusX = halfWidth * 0.34;
    const radiusZ = halfDepth * 0.34;
    matrix.compose(
      new THREE.Vector3(Math.cos(angle) * radiusX, 0.34, Math.sin(angle) * radiusZ),
      new THREE.Quaternion(),
      new THREE.Vector3(0.28, 0.28, 0.28),
    );
  }), [halfDepth, halfWidth]);

  const sprayPositions = useMemo(() => {
    const positions = [];
    for (let index = 0; index < 36; index += 1) {
      const angle = (index / 36) * Math.PI * 2;
      const radius = 0.3 + (index % 6) * 0.055;
      positions.push(
        Math.cos(angle) * radius,
        2.6 + (index % 5) * 0.18,
        Math.sin(angle) * radius,
      );
    }
    return new Float32Array(positions);
  }, []);

  return (
    <group position={position}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[width, 0.05, depth]} />
        <meshStandardMaterial color="#3A8A3A" roughness={0.9} />
      </mesh>

      <mesh position={[0, channel / 2, 0]}>
        <boxGeometry args={[width - margin * 2, channel, 0.42]} />
        <meshStandardMaterial color="#4B9ED1" roughness={0.2} metalness={0.05} />
      </mesh>
      <mesh position={[0, channel / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[depth - margin * 2, channel, 0.42]} />
        <meshStandardMaterial color="#4B9ED1" roughness={0.2} metalness={0.05} />
      </mesh>

      <InstanceSet
        geometry={useMemo(() => new THREE.ConeGeometry(1, 1, 7), [])}
        material={useMemo(() => new THREE.MeshStandardMaterial({ color: '#28572C', roughness: 0.84 }), [])}
        matrices={treeMatrices}
      />

      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[1.4, 1.7, 0.9, 12]} />
        <meshStandardMaterial color="#A6A19A" roughness={0.48} metalness={0.18} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.8, 1.05, 0.25, 12]} />
        <meshStandardMaterial color="#D0CBC3" roughness={0.42} metalness={0.2} />
      </mesh>
      <points position={[0, 0.1, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sprayPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#BFEAFF" size={0.07} transparent opacity={0.85} sizeAttenuation />
      </points>

      <InstanceSet
        geometry={useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])}
        material={useMemo(() => new THREE.MeshStandardMaterial({ color: '#D54B65', roughness: 0.78 }), [])}
        matrices={roseMatrices}
      />
    </group>
  );
}
