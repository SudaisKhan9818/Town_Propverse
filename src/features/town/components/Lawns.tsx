'use client';

// Lawns.tsx — every sage lawn in town (3 linear green belts + the Central
// Park lawn) as ONE merged, world-UV mesh, with stone edging, benches and
// the clay pad under the park playground GLB.

import { useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances } from '@react-three/drei';
import { getTownData } from '../data/layout-engine';
import { BENCHES } from '../data/decor';
import { PARK_LAWN, PLAYGROUND_CENTER, PLAYGROUND_PAD } from '../data/park';
import { COMPLEX } from '../data/gov-complex';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawLawn } from '../materials/textures';
import { TOWN_PALETTE } from '../materials/palette';
import { mergeGeometries, mergedRects, worldUv, type RectXZ } from './geometry';

const TOWN = getTownData();
const LAWN_Y = 0.01;

const LAWNS: RectXZ[] = [
  ...TOWN.greenBelts.map((g) => ({ x: g.position.x, z: g.position.z, w: g.bounds.w, d: g.bounds.d })),
  PARK_LAWN,
];

/** Government-complex gardens share the lawn mesh but get no stone edging. */
const ALL_LAWNS: RectXZ[] = [...LAWNS, ...COMPLEX.lawns];

function edging(): Array<{ p: [number, number, number]; s: [number, number, number] }> {
  const h = 0.14;
  const t = 0.28;
  return LAWNS.flatMap((l) => [
    { p: [l.x, h / 2, l.z - l.d / 2] as [number, number, number], s: [l.w + t, h, t] as [number, number, number] },
    { p: [l.x, h / 2, l.z + l.d / 2] as [number, number, number], s: [l.w + t, h, t] as [number, number, number] },
    { p: [l.x - l.w / 2, h / 2, l.z] as [number, number, number], s: [t, h, l.d] as [number, number, number] },
    { p: [l.x + l.w / 2, h / 2, l.z] as [number, number, number], s: [t, h, l.d] as [number, number, number] },
  ]);
}

function createBenchGeometry(): THREE.BufferGeometry {
  const seat = new THREE.BoxGeometry(1.8, 0.08, 0.45).translate(0, 0.45, 0);
  const back = new THREE.BoxGeometry(1.8, 0.36, 0.06).translate(0, 0.72, -0.2);
  const legL = new THREE.BoxGeometry(0.08, 0.45, 0.42).translate(-0.8, 0.225, 0);
  const legR = new THREE.BoxGeometry(0.08, 0.45, 0.42).translate(0.8, 0.225, 0);
  const merged = mergeGeometries([seat, back, legL, legR], false)!;
  [seat, back, legL, legR].forEach((g) => g.dispose());
  return merged;
}

export default function Lawns() {
  const lawn = useCanvasTexture('lawn', drawLawn, 512, { repeat: [1, 1] });
  const lawnGeometry = useMemo(() => mergedRects(ALL_LAWNS, LAWN_Y, worldUv(9)), []);
  const edges = useMemo(edging, []);
  const benchGeometry = useMemo(createBenchGeometry, []);

  return (
    <group>
      <mesh geometry={lawnGeometry} receiveShadow>
        <meshStandardMaterial map={lawn} roughness={0.92} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Instances limit={edges.length} range={edges.length} frames={2} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={TOWN_PALETTE.beltBorder} roughness={0.85} />
        {edges.map((e, i) => <Instance key={i} position={e.p} scale={e.s} />)}
      </Instances>
      <mesh position={[PLAYGROUND_CENTER.x, 0.012, PLAYGROUND_CENTER.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PLAYGROUND_PAD.w, PLAYGROUND_PAD.d]} />
        <meshStandardMaterial color={TOWN_PALETTE.playPad} roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Instances limit={BENCHES.length} range={BENCHES.length} frames={2} geometry={benchGeometry} receiveShadow>
        <meshStandardMaterial color={TOWN_PALETTE.bench} roughness={0.75} />
        {BENCHES.map((b, i) => <Instance key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotation, 0]} />)}
      </Instances>
    </group>
  );
}
