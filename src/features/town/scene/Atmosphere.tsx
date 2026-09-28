'use client';

// ═══════════════════════════════════════════════════════════════════
// Atmosphere — kills the black void. Warm cream→sand gradient sky, warm
// exponential fog that dissolves the outer land, golden-hour light rig
// with exactly ONE shadow-casting light (tight town frustum).
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { COLORS } from '@/src/shared/theme/tokens';
import { useCanvasTexture } from '../materials/canvas-texture';
import { drawSky } from '../materials/textures';
import { useTownStore } from '../store/town-store';

const ATMOSPHERE = {
  fogDensity: 0.0016,
  fogDensityLow: 0.0012,
  sunElevationDeg: 35,
  sunAzimuthDeg: 217, // from the south-west: long shadows fall north-east
  sunIntensity: 2.2,
  ambientIntensity: 0.7,
  hemiIntensity: 0.55,
  shadowMap: 2048,
  shadowMapLow: 1024,
  shadowExtent: 125,
  exposure: 1.0,
} as const;

function sunDirection(): THREE.Vector3 {
  const el = THREE.MathUtils.degToRad(ATMOSPHERE.sunElevationDeg);
  const az = THREE.MathUtils.degToRad(ATMOSPHERE.sunAzimuthDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

export default function Atmosphere() {
  const { scene, gl, invalidate } = useThree();
  const sky = useCanvasTexture('sky', drawSky, [4, 512]);
  const quality = useTownStore((s) => s.quality);
  const sun = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = ATMOSPHERE.exposure;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    const prevBackground = scene.background;
    const prevFog = scene.fog;
    scene.background = sky;
    scene.fog = new THREE.FogExp2(COLORS.fog, ATMOSPHERE.fogDensity);
    return () => {
      scene.background = prevBackground;
      scene.fog = prevFog;
    };
  }, [gl, scene, sky]);

  // Performance fallback: halve the shadow map, thin the fog.
  useEffect(() => {
    const light = sun.current;
    if (light) {
      const size = quality === 'high' ? ATMOSPHERE.shadowMap : ATMOSPHERE.shadowMapLow;
      if (light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size);
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = quality === 'high' ? ATMOSPHERE.fogDensity : ATMOSPHERE.fogDensityLow;
    }
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, quality, scene]);

  const dir = sunDirection();
  const e = ATMOSPHERE.shadowExtent;
  return (
    <>
      <ambientLight color={COLORS.ambient} intensity={ATMOSPHERE.ambientIntensity} />
      <hemisphereLight args={[COLORS.hemiSky, COLORS.hemiGround, ATMOSPHERE.hemiIntensity]} />
      <directionalLight
        ref={sun}
        color={COLORS.sunKey}
        intensity={ATMOSPHERE.sunIntensity}
        position={[dir.x * 320, dir.y * 320, dir.z * 320]}
        castShadow
        shadow-mapSize={[ATMOSPHERE.shadowMap, ATMOSPHERE.shadowMap]}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={120}
        shadow-camera-far={560}
        shadow-bias={-0.0004}
        shadow-normalBias={0.4}
        shadow-radius={2.5}
      />
    </>
  );
}
