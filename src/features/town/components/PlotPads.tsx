'use client';

// PlotPads.tsx — "prepared land": one instanced soil border strip (0.5m,
// the full plot) under one instanced bone pad inset by 0.5m.

import { Instance, Instances } from '@react-three/drei';
import { getTownData } from '../data/layout-engine';
import { TOWN_PALETTE } from '../materials/palette';

const TOWN = getTownData();
const BORDER = 0.5;

export default function PlotPads() {
  const count = TOWN.plots.length;
  return (
    <group>
      <Instances limit={count} range={count} frames={2} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={TOWN_PALETTE.soilBorder} roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
        {TOWN.plots.map((p) => (
          <Instance key={p.id} position={[p.position.x, 0.015, p.position.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[p.bounds.w, p.bounds.d, 1]} />
        ))}
      </Instances>
      <Instances limit={count} range={count} frames={2} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={TOWN_PALETTE.plotPad} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
        {TOWN.plots.map((p) => (
          <Instance
            key={p.id}
            position={[p.position.x, 0.02, p.position.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[p.bounds.w - BORDER * 2, p.bounds.d - BORDER * 2, 1]}
          />
        ))}
      </Instances>
    </group>
  );
}
