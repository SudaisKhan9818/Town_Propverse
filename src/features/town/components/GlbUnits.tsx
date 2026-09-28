'use client';

// GlbUnits — renders a set of unit placements through <GlbUnit>.

import { useGLTF } from '@react-three/drei';
import { DRACO_DECODER_PATH } from '../data/town.config';
import type { UnitPlacement } from '../data/unit-placement';
import GlbUnit from './GlbUnit';

/** Start downloading a stage's models (both LODs) before it mounts. */
export function preloadUnits(placements: UnitPlacement[]) {
  const urls = new Set(placements.flatMap((p) => [p.model.url, p.model.lod1].filter(Boolean) as string[]));
  urls.forEach((url) => useGLTF.preload(url, DRACO_DECODER_PATH));
}

export default function GlbUnits({ placements }: { placements: UnitPlacement[] }) {
  return (
    <>
      {placements.map((p) => (
        <GlbUnit
          key={`${p.unitId}:${p.kind}`}
          unitId={p.unitId}
          unitType={p.unitType}
          modelPath={p.model.url}
          lod1Path={p.model.lod1}
          lodDistance={p.lodDistance}
          footprint={p.footprint}
          margin={p.margin}
          position={p.position}
          rotationY={p.rotationY}
        />
      ))}
    </>
  );
}
