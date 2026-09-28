'use client';

// Roads.tsx — road network: asphalt (1 merged mesh, world-UV tiling),
// dashed centre lines, terracotta curbs and the boulevard's raised median
// (instanced). Curbs and median open at every junction.

import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { COLORS } from '@/src/shared/theme/tokens';
import { getTownData } from '../data/layout-engine';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawAsphalt } from '../materials/textures';
import { SURFACE } from '../materials/palette';
import { mergedRects, worldUv } from './geometry';
import { STREETLIGHT, medianSegments } from '../data/streetlights';

const TOWN = getTownData();
const ROAD_Y = 0.02;
const CURB_H = 0.15;
const CURB_W = 0.35;
const DASH = 4;
const DASH_GAP = 3;

type Segment = { x: number; z: number; w: number; d: number };

function buildMarkings(): Segment[] {
  const dashes: Segment[] = [];
  // Main roads carry a raised median instead of a painted centre line.
  TOWN.streets.filter((st) => st.width <= STREETLIGHT.mainRoadWidth).forEach((st) => {
    for (let s = -st.length / 2 + 10; s <= st.length / 2 - 10; s += DASH + DASH_GAP) {
      dashes.push(st.orientation === 'NS'
        ? { x: st.position.x, z: st.position.z + s, w: 0.3, d: DASH }
        : { x: st.position.x + s, z: st.position.z, w: DASH, d: 0.3 });
    }
  });
  return dashes;
}

function buildCurbs(): Segment[] {
  const curbs: Segment[] = [];
  const ew = TOWN.streets.filter((s) => s.orientation === 'EW');
  TOWN.streets.forEach((st) => {
    const half = st.width / 2;
    if (st.orientation === 'EW') {
      for (const side of [-half, half]) curbs.push({ x: st.position.x, z: st.position.z + side, w: st.length, d: CURB_W });
      return;
    }
    // NS boulevard: split each curb line around the side-street mouths.
    for (const sideSign of [-1, 1]) {
      const edgeX = st.position.x + sideSign * half;
      const gaps = ew
        .filter((e) => Math.abs((e.position.x - sideSign * e.length / 2) - edgeX) < 0.5)
        .map((e) => [e.position.z - e.width / 2, e.position.z + e.width / 2] as const)
        .sort((a, b) => a[0] - b[0]);
      let start = st.position.z - st.length / 2;
      const end = st.position.z + st.length / 2;
      for (const [g0, g1] of [...gaps, [end, end] as const]) {
        if (g0 - start > 0.2) curbs.push({ x: edgeX, z: (start + g0) / 2, w: CURB_W, d: g0 - start });
        start = g1;
      }
    }
  });
  return curbs;
}

export default function Roads() {
  const asphalt = useCanvasTexture('asphalt', drawAsphalt, 512, { repeat: [1, 1] });
  const roadGeometry = useMemo(() => mergedRects(
    TOWN.streets.map((st) => st.orientation === 'NS'
      ? { x: st.position.x, z: st.position.z, w: st.width, d: st.length }
      : { x: st.position.x, z: st.position.z, w: st.length, d: st.width }),
    ROAD_Y,
    worldUv(10),
  ), []);
  const markings = useMemo(buildMarkings, []);
  const curbs = useMemo(buildCurbs, []);
  const median = useMemo(medianSegments, []);

  return (
    <group>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial map={asphalt} {...SURFACE.asphalt} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Instances limit={markings.length} range={markings.length} frames={2}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.roadMarking} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
        {markings.map((m, i) => (
          <Instance key={i} position={[m.x, ROAD_Y + 0.005, m.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[m.w, m.d, 1]} />
        ))}
      </Instances>
      <Instances limit={curbs.length} range={curbs.length} frames={2} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.curb} roughness={0.8} />
        {curbs.map((c, i) => (
          <Instance key={i} position={[c.x, CURB_H / 2, c.z]} scale={[c.w, CURB_H, c.d]} />
        ))}
      </Instances>
      <Instances limit={median.length} range={median.length} frames={2} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.plinth} roughness={0.85} />
        {median.map((m, i) => (
          <Instance key={i} position={[m.x, 0.11, (m.z0 + m.z1) / 2]} scale={[STREETLIGHT.medianWidth, 0.2, m.z1 - m.z0]} />
        ))}
      </Instances>
    </group>
  );
}
