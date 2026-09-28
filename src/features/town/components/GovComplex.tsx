'use client';

// GovComplex — walls, gate posts, paved parking forecourts, bay lines and
// hedges of the Police · Fire · WAPDA complex (lawns render with <Lawns>,
// trees with <Trees>). 5 draw calls; nothing here is pickable.

import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { COMPLEX, type Box } from '../data/gov-complex';
import { TOWN_PALETTE } from '../materials/palette';
import { mergedRects, worldUv } from './geometry';

function BoxSet({ boxes, color, castShadow = false, roughness = 0.85, overlay = false }: {
  boxes: Box[]; color: string; castShadow?: boolean; roughness?: number; overlay?: boolean;
}) {
  return (
    <Instances limit={boxes.length} range={boxes.length} frames={2} castShadow={castShadow} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={roughness} polygonOffset={overlay} polygonOffsetFactor={overlay ? -3 : 0} />
      {boxes.map((b, i) => <Instance key={i} position={[b.x, b.y, b.z]} scale={[b.w, b.h, b.d]} />)}
    </Instances>
  );
}

export default function GovComplex() {
  const parking = useMemo(() => mergedRects(COMPLEX.parking, 0.02, worldUv(10)), []);
  return (
    <group name="GovComplex">
      <mesh geometry={parking} receiveShadow>
        <meshStandardMaterial color={TOWN_PALETTE.forecourt} roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <BoxSet boxes={COMPLEX.bayLines} color={TOWN_PALETTE.bayLine} roughness={0.6} overlay />
      <BoxSet boxes={COMPLEX.walls} color={TOWN_PALETTE.complexWall} castShadow />
      <BoxSet boxes={COMPLEX.posts} color={TOWN_PALETTE.wallCap} castShadow />
      <BoxSet boxes={COMPLEX.hedges} color={TOWN_PALETTE.hedge} roughness={0.95} />
    </group>
  );
}
