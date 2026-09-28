'use client';

// Trees.tsx — ONE procedural tree (trunk + faceted icosahedron canopy,
// vertex-coloured, merged) drawn for the whole town in a single
// instanced draw call. Seeded scale / squash / hue give variety.

import { useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances } from '@react-three/drei';
import { PLANTER_TREES, TREES, type TreeInstance } from '../data/decor';
import { TOWN_PALETTE, SURFACE } from '../materials/palette';
import { mergeGeometries } from './geometry';

const TRUNK_H = 1.2;
const CANOPY_R = 1.55;

function paint(geometry: THREE.BufferGeometry, hex: string) {
  const color = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function createTreeGeometry(): THREE.BufferGeometry {
  const trunk = paint(new THREE.CylinderGeometry(0.11, 0.17, TRUNK_H, 7).translate(0, TRUNK_H / 2, 0), TOWN_PALETTE.trunk);
  const canopy = paint(
    new THREE.IcosahedronGeometry(CANOPY_R, 1).translate(0, TRUNK_H + CANOPY_R * 0.82, 0),
    TOWN_PALETTE.canopy,
  );
  const trunkFlat = trunk.toNonIndexed();
  trunk.dispose();
  const merged = mergeGeometries([trunkFlat, canopy], false)!;
  trunkFlat.dispose();
  canopy.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Instance tint = jittered canopy colour ÷ base canopy colour (per channel). */
function tint(hue: number): THREE.Color {
  const base = new THREE.Color(TOWN_PALETTE.canopy);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const jittered = new THREE.Color().setHSL((hsl.h + hue * hsl.h + 1) % 1, hsl.s, hsl.l * (1 + hue * 0.5));
  return new THREE.Color(jittered.r / base.r, jittered.g / base.g, jittered.b / base.b);
}

function TreeInstances({ trees }: { trees: TreeInstance[] }) {
  const tints = useMemo(() => trees.map((t) => tint(t.hue)), [trees]);
  return (
    <>
      {trees.map((t, i) => (
        <Instance
          key={i}
          position={[t.x, t.y, t.z]}
          rotation={[0, t.rotation, 0]}
          scale={[t.scale, t.scale * t.squash, t.scale]}
          color={tints[i]}
        />
      ))}
    </>
  );
}

const ALL_TREES = [...TREES, ...PLANTER_TREES];

export default function Trees() {
  const geometry = useMemo(createTreeGeometry, []);
  const trees = ALL_TREES;
  return (
    <Instances limit={trees.length} range={trees.length} frames={2} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors flatShading {...SURFACE.foliage} />
      <TreeInstances trees={trees} />
    </Instances>
  );
}
