'use client';

// BoundaryWall.tsx — 2.4m stone perimeter on the frozen wall lines.
// Each run is split into near-6m instanced segments so the stone-panel
// texture keeps its scale; pilasters mark every joint, a darker cap runs
// along the top.

import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { BOULEVARD_WIDTH, GATE_WIDTH, GROUND_SIZE, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH } from '../data/town.config';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawStonePanel } from '../materials/textures';
import { TOWN_PALETTE } from '../materials/palette';

const WALL = { height: 2.4, thick: 0.5, panel: 6, capH: 0.14, pilaster: 0.72 } as const;

interface Run { axis: 'x' | 'z'; from: number; to: number; at: number }

/** The same eight runs the town has always had (frozen outline). */
function wallRuns(): Run[] {
  const half = GROUND_SIZE / 2;
  const bvd = BOULEVARD_WIDTH / 2;
  return [
    { axis: 'x', from: bvd, to: half, at: -half },                          // east block, north
    { axis: 'z', from: -half, to: half, at: half },                         // east wall
    { axis: 'x', from: GATE_WIDTH / 2, to: half, at: half },                // east block, south (to gate)
    { axis: 'x', from: LEFT_BOUND_X, to: -bvd, at: LEFT_BOUND_Z_NORTH },    // west block, north
    { axis: 'x', from: LEFT_BOUND_X, to: -bvd, at: LEFT_BOUND_Z_SOUTH },    // west block, south
    { axis: 'z', from: LEFT_BOUND_Z_NORTH, to: LEFT_BOUND_Z_SOUTH, at: LEFT_BOUND_X }, // west wall
    { axis: 'z', from: -half, to: LEFT_BOUND_Z_NORTH, at: -bvd },           // north step
    { axis: 'z', from: LEFT_BOUND_Z_SOUTH, to: half, at: -bvd },            // south step
  ];
}

type Box = { p: [number, number, number]; s: [number, number, number] };

function layout() {
  const segments: Box[] = [];
  const caps: Box[] = [];
  const pilasters: Box[] = [];
  wallRuns().forEach((run) => {
    const length = run.to - run.from;
    const n = Math.max(1, Math.round(length / WALL.panel));
    const seg = length / n;
    for (let i = 0; i < n; i += 1) {
      const c = run.from + seg * (i + 0.5);
      const [x, z] = run.axis === 'x' ? [c, run.at] : [run.at, c];
      const size: [number, number, number] = run.axis === 'x' ? [seg, WALL.height, WALL.thick] : [WALL.thick, WALL.height, seg];
      segments.push({ p: [x, WALL.height / 2, z], s: size });
    }
    const capSize: [number, number, number] = run.axis === 'x'
      ? [length + 0.2, WALL.capH, WALL.thick + 0.18]
      : [WALL.thick + 0.18, WALL.capH, length + 0.2];
    const mid = (run.from + run.to) / 2;
    caps.push({ p: run.axis === 'x' ? [mid, WALL.height + WALL.capH / 2, run.at] : [run.at, WALL.height + WALL.capH / 2, mid], s: capSize });
    for (let i = 0; i <= n; i += 1) {
      const c = run.from + seg * i;
      const [x, z] = run.axis === 'x' ? [c, run.at] : [run.at, c];
      pilasters.push({ p: [x, (WALL.height + 0.3) / 2, z], s: [WALL.pilaster, WALL.height + 0.3, WALL.pilaster] });
    }
  });
  return { segments, caps, pilasters };
}

export default function BoundaryWall() {
  const stone = useCanvasTexture('stone-panel', drawStonePanel, [512, 256]);
  const { segments, caps, pilasters } = useMemo(layout, []);
  const trims = [...caps, ...pilasters];
  return (
    <group>
      <Instances limit={segments.length} range={segments.length} frames={2} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={stone} roughness={0.9} />
        {segments.map((b, i) => <Instance key={i} position={b.p} scale={b.s} />)}
      </Instances>
      <Instances limit={trims.length} range={trims.length} frames={2} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={TOWN_PALETTE.wallCap} roughness={0.85} />
        {trims.map((b, i) => <Instance key={i} position={b.p} scale={b.s} />)}
      </Instances>
    </group>
  );
}
