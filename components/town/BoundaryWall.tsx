import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { COLORS, GROUND_SIZE, BOULEVARD_WIDTH, GATE_WIDTH, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH } from './town.config';

export default function BoundaryWall() {
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);

  const { walls, caps } = useMemo(() => {
    const half = GROUND_SIZE / 2;
    const bvdHalf = BOULEVARD_WIDTH / 2;
    const gateHalf = GATE_WIDTH / 2;
    const leftWidth = Math.abs(LEFT_BOUND_X) - bvdHalf;

    const segments = [
      // Right North Wall
      { startX: bvdHalf, endX: half, z: -half, axis: 'x' },
      // East Wall
      { startZ: -half, endZ: half, x: half, axis: 'z' },
      // Right South Wall (excluding gate)
      { startX: gateHalf, endX: half, z: half, axis: 'x' },
      // Shrunk Left North Wall
      { startX: -bvdHalf - leftWidth, endX: -bvdHalf, z: LEFT_BOUND_Z_NORTH, axis: 'x' },
      // Shrunk Left South Wall
      { startX: -bvdHalf - leftWidth, endX: -bvdHalf, z: LEFT_BOUND_Z_SOUTH, axis: 'x' },
      // Shrunk West Wall
      { startZ: LEFT_BOUND_Z_NORTH, endZ: LEFT_BOUND_Z_SOUTH, x: LEFT_BOUND_X, axis: 'z' },
      // North Step Wall
      { startZ: -half, endZ: LEFT_BOUND_Z_NORTH, x: -bvdHalf, axis: 'z' },
      // South Step Wall
      { startZ: LEFT_BOUND_Z_SOUTH, endZ: half, x: -bvdHalf, axis: 'z' },
    ];

    const wallThickness = 0.5;
    const wallHeight = 0.8;
    const capHeight = 0.1;

    const wallsData: { x: number; z: number; w: number; d: number; h: number }[] = [];
    const capsData: { x: number; z: number; w: number; d: number; h: number }[] = [];

    segments.forEach((seg) => {
      const len = seg.axis === 'x' ? seg.endX! - seg.startX! : seg.endZ! - seg.startZ!;
      const cx = seg.axis === 'x' ? seg.startX! + len / 2 : seg.x!;
      const cz = seg.axis === 'z' ? seg.startZ! + len / 2 : seg.z!;

      // Main Solid Wall
      wallsData.push({
        x: cx, z: cz,
        w: seg.axis === 'x' ? len : wallThickness,
        d: seg.axis === 'z' ? len : wallThickness,
        h: wallHeight,
      });

      // Wall Concrete Cap
      capsData.push({
        x: cx, z: cz,
        w: seg.axis === 'x' ? len + 0.1 : wallThickness + 0.1,
        d: seg.axis === 'z' ? len + 0.1 : wallThickness + 0.1,
        h: capHeight,
      });
    });

    return { walls: wallsData, caps: capsData };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (wallRef.current && capRef.current) {
      walls.forEach((w, i) => {
        dummy.position.set(w.x, w.h / 2, w.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(w.w, w.h, w.d);
        dummy.updateMatrix();
        wallRef.current!.setMatrixAt(i, dummy.matrix);
      });

      caps.forEach((c, i) => {
        dummy.position.set(c.x, 0.8 + c.h / 2, c.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(c.w, c.h, c.d);
        dummy.updateMatrix();
        capRef.current!.setMatrixAt(i, dummy.matrix);
      });

      wallRef.current.instanceMatrix.needsUpdate = true;
      capRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [walls, caps, dummy]);

  return (
    <group>
      {/* Solid Wall Base */}
      <instancedMesh ref={wallRef} args={[undefined, undefined, walls.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
      </instancedMesh>
      
      {/* Wall Concrete Cap */}
      <instancedMesh ref={capRef} args={[undefined, undefined, caps.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.gate} roughness={0.6} />
      </instancedMesh>
    </group>
  );
}
