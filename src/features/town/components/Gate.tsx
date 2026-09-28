'use client';

// Gate.tsx — main gate at the south end of the boulevard: two 4m stone
// piers, a lintel carrying the canvas-drawn "PropVerse" nameplate (both
// faces), two terracotta planters (their trees render with <Trees />).

import { useMemo } from 'react';
import { GATE_WIDTH, GROUND_SIZE } from '../data/town.config';
import { PLANTER_TREES } from '../data/decor';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawNameplate, drawStonePanel } from '../materials/textures';
import { TOWN_PALETTE } from '../materials/palette';

const PIER = { w: 1.8, h: 4, d: 1.8 } as const;
const LINTEL_H = 1.5;

export default function Gate() {
  const stone = useCanvasTexture('stone-panel', drawStonePanel, [512, 256]);
  const plaque = useCanvasTexture('nameplate', drawNameplate, [1024, 256]);
  const z = GROUND_SIZE / 2;
  const pierX = GATE_WIDTH / 2 + PIER.w / 2;
  const span = pierX * 2 + PIER.w;
  const lintelY = PIER.h + LINTEL_H / 2;
  const plaqueW = 7.2;
  const plaqueH = plaqueW / 4;

  const planters = useMemo(() => PLANTER_TREES.map((t) => [t.x, t.z] as const), []);

  return (
    <group>
      {[-pierX, pierX].map((x) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position={[0, PIER.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[PIER.w, PIER.h, PIER.d]} />
            <meshStandardMaterial map={stone} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <boxGeometry args={[PIER.w + 0.3, 0.4, PIER.d + 0.3]} />
            <meshStandardMaterial color={TOWN_PALETTE.wallCap} roughness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, lintelY, z]} castShadow receiveShadow>
        <boxGeometry args={[span, LINTEL_H, 1.4]} />
        <meshStandardMaterial map={stone} roughness={0.9} />
      </mesh>
      <mesh position={[0, lintelY + LINTEL_H / 2 + 0.1, z]}>
        <boxGeometry args={[span + 0.4, 0.2, 1.7]} />
        <meshStandardMaterial color={TOWN_PALETTE.wallCap} roughness={0.85} />
      </mesh>
      {/* Nameplate on the outer (south) and inner (north) faces */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, lintelY, z + side * 0.71]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[plaqueW, plaqueH]} />
          <meshStandardMaterial map={plaque} roughness={0.6} />
        </mesh>
      ))}
      {/* Terracotta planters */}
      {planters.map(([x, pz]) => (
        <mesh key={x} position={[x, 0.42, pz]} receiveShadow>
          <boxGeometry args={[1.5, 0.84, 1.5]} />
          <meshStandardMaterial color={TOWN_PALETTE.planter} roughness={0.85} />
        </mesh>
      ))}
      {/* Paved apron outside the gate */}
      <mesh position={[0, 0.012, z + 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[span + 6, 11]} />
        <meshStandardMaterial color={TOWN_PALETTE.pavers} roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  );
}
