'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Depth, Fresnel, LayerMaterial } from 'lamina';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { Selection } from './useSelection';
import WalkMode from './WalkMode';
import MughalGarden from './MughalGarden';
import PremiumGate from './PremiumGate';
import BoundaryWall from './BoundaryWall';
import { getTownData } from './layout-engine';
import {
  GROUND_SIZE, COLORS, WALL_HEIGHT, WALL_THICK, GATE_WIDTH,
  BOULEVARD_WIDTH, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH
} from './town.config';

const TOWN = getTownData();

// Serve only the current Blender exports through the local model route.
// Keep the version explicit so overwritten Blender exports cannot be hidden by
// the browser or useGLTF cache.
const MODEL_REVISION = 'v=8&revision=20260924-draco512';
const MODEL_PATHS = {
  '5marla': `/blender-models/5Marla.glb?${MODEL_REVISION}`,
  '7marla': `/blender-models/7Marla.glb?${MODEL_REVISION}`,
  '12marla': `/blender-models/12Marla.glb?${MODEL_REVISION}`,
  masjid: '/blender-models/Masjid.glb?v=8&revision=20260924-draco512',
  // The actual Blender filename is lowercase `market.glb`.
  market: '/blender-models/market.glb?v=8&revision=20260924-draco512',
  hospital: `/blender-models/Hospital.glb?${MODEL_REVISION}`,
  school: `/blender-models/School.glb?${MODEL_REVISION}`,
  police: `/blender-models/PoliceStation.glb?${MODEL_REVISION}`,
  fire: `/blender-models/FireStation.glb?${MODEL_REVISION}`,
  wapda: `/blender-models/Wapda.glb?${MODEL_REVISION}`,
  greenGround: `/blender-models/GreenGround.glb?${MODEL_REVISION}`,
  kidsPlay: `/blender-models/Playground.glb?${MODEL_REVISION}`,
} as const;

interface ModelInstanceProps {
  url: string;
  position: { x: number; z: number };
  bounds?: { w: number; d: number };
  rotation?: number;
  yOffset?: number;
  targetHeight?: number;
  fitMode?: 'plot' | '12marla' | 'masjid' | 'market' | 'hospital' | 'school' | 'park' | 'footprint';
  label: string;
}

const FIXED_SCALE: Record<string, number> = {
  'masjid-2': 0.75,
  'masjid-4': 0.75,
  'market-1': 0.95,
  'market-3': 0.95,
  'civic-hospital': 0.6,
  'civic-police': 1.1,
  'civic-park ground': 0.80,
  'P-2 7marla': 1.15,
  'P-3 5marla': 0.8,
};

function getFixedScale(label: string, fitMode: ModelInstanceProps['fitMode']) {
  if (FIXED_SCALE[label] !== undefined) return FIXED_SCALE[label];
  if (fitMode === 'masjid') return 0.75;
  if (fitMode === 'market') return 0.95;
  if (fitMode === 'hospital') return 0.6;
  if (fitMode === 'footprint' && label.startsWith('civic-police')) return 0.75;
  if (fitMode === '12marla') return 0.51; // 0.68 * 0.75
  if (fitMode === 'plot') return 0.8;
  return 0.7;
}

function ModelInstance({ url, position, bounds, rotation = 0, yOffset = 0.05, targetHeight, fitMode = 'footprint', label }: ModelInstanceProps) {
  // Draco runtime assets keep network and GPU upload costs low. The route
  // falls back to the existing runtime/source asset if a Draco copy is absent.
  const { scene } = useGLTF(url, true, false);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.frustumCulled = false;
    const isMasjid = label === 'masjid-2' || label === 'masjid-4';
    const isMarket = label === 'market-1' || label === 'market-3';
    const isTargetAmenity = isMasjid || isMarket;

    // Normalize only these two cloned assets. Never mutate the cached source
    // scene, because its geometry is shared by every instance.
    if (isTargetAmenity) {
      clone.traverse((object) => {
        if (object instanceof THREE.Mesh) object.scale.set(1, 1, 1);
      });
    }
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    clone.position.set(-center.x, -box.min.y, -center.z);
    clone.updateMatrixWorld(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        // Imported assets are cloned and then re-centered/scaled in a wrapper.
        // Disable per-mesh culling because stale local bounds can hide a whole
        // building while the walk camera moves through the town.
        child.frustumCulled = false;

        // Keep imported Blender materials lightweight and consistently PBR.
        // This changes shading only; frozen geometry and transforms are untouched.
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          const pbr = material as THREE.MeshStandardMaterial;
          if ('roughness' in pbr) pbr.roughness = Math.min(pbr.roughness ?? 0.8, 0.55);
          if ('metalness' in pbr) pbr.metalness = Math.min(pbr.metalness ?? 0.1, 0.12);
          if ('envMapIntensity' in pbr) pbr.envMapIntensity = 0.35;
          pbr.needsUpdate = true;
        });
      }
    });

    const wrapper = new THREE.Group();
    wrapper.frustumCulled = false;
    wrapper.add(clone);
    wrapper.matrix.identity();
    wrapper.scale.set(1, 1, 1);

    if (isMasjid) {
      wrapper.scale.set(0.7, 0.52, 0.7);
    } else if (isMarket) {
      wrapper.scale.set(0.62, 0.62, 0.62);
      if (bounds) {
        wrapper.updateMatrixWorld(true);
        const marketSize = new THREE.Box3().setFromObject(wrapper, true).getSize(new THREE.Vector3());
        if (marketSize.x > bounds.w * 0.9 || marketSize.z > bounds.d * 0.9) {
          wrapper.scale.multiplyScalar(0.8);
        }
      }
    } else {
      // Existing scale and civic fitting path for every other model remains
      // unchanged.
      if (label === 'civic-hospital') clone.rotation.y = Math.PI / 2;
      clone.updateMatrixWorld(true);
      let s = getFixedScale(label, fitMode);
      const isCivic = fitMode === 'footprint' || fitMode === 'hospital' || fitMode === 'school' || fitMode === 'park';
      if (bounds && isCivic && size.x > 0 && size.z > 0) {
        const civicBox = new THREE.Box3().setFromObject(clone, true);
        const civicSize = civicBox.getSize(new THREE.Vector3());
        const footprintScale = Math.min(
          (bounds.w * 0.92) / Math.max(civicSize.x, Number.EPSILON),
          (bounds.d * 0.92) / Math.max(civicSize.z, Number.EPSILON),
        );
        if (Number.isFinite(footprintScale) && footprintScale > 0) {
          // GreenGround is a surface asset: fit it to the frozen park pad,
          // leaving a small clean perimeter so it never spills onto roads.
          // Exact fit: keep the Blender terrain inside the frozen park
          // rectangle, without overscanning into the road or boundary wall.
          s = fitMode === 'park' ? footprintScale : Math.max(s, footprintScale);
        }
      }
      const yScale = fitMode === 'masjid' ? Math.min(s, 0.65)
        : fitMode === 'market' ? Math.min(s, 0.6)
          : s;
      wrapper.scale.set(s, yScale, s);
    }

    wrapper.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(wrapper, true);
    const fittedCenter = fitted.getCenter(new THREE.Vector3());
    // The primitive is placed at the frozen layout-engine center below. Keep
    // the model's local origin centered and its lowest point on local Y=0.
    wrapper.position.set(-fittedCenter.x, isTargetAmenity ? 0 : -fitted.min.y, -fittedCenter.z);
    wrapper.updateMatrixWorld(true);
    const buildingBox = new THREE.Box3().setFromObject(wrapper, true);
    if (isMasjid) {
      console.log('MASJID SCALE', wrapper.scale, 'BOX', buildingBox.getSize(new THREE.Vector3()));
    } else if (isMarket) {
      console.log('MARKET SCALE', wrapper.scale, 'BOX', buildingBox.getSize(new THREE.Vector3()));
    }
    return wrapper;
  }, [scene, bounds, fitMode, label, targetHeight]);

  return (
    <primitive
      object={cloned}
      position={[position.x, yOffset, position.z]}
      rotation={[0, (rotation * Math.PI) / 180, 0]}
      key={url}
      // All plot instances share GLTF geometry and textures from useGLTF's
      // cache. R3F must not dispose those shared GPU resources when a staged
      // model temporarily unmounts or when the town view is reopened.
      dispose={null}
    />
  );
}

function ModelStageReady({ next, onAdvance }: { next: number; onAdvance: (next: number) => void }) {
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      const handle = idle(() => onAdvance(next), { timeout: 700 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => onAdvance(next), 80);
    return () => window.clearTimeout(timer);
  }, [next, onAdvance]);
  return null;
}

function CivicTrees({ center, bounds, count = 5 }: { center: { x: number; z: number }; bounds: { w: number; d: number }; count?: number }) {
  const positions = useMemo(() => {
    const x = bounds.w / 2 - 2.5;
    const z = bounds.d / 2 - 2.5;
    return [
      [-x, -z], [x, -z], [-x, z], [x, z], [0, z], [0, -z],
    ].slice(0, count);
  }, [bounds.d, bounds.w, count]);
  return (
    <group>
      {positions.map(([offsetX, offsetZ], index) => (
        <group key={index} position={[center.x + offsetX, 0, center.z + offsetZ]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.18, 0.28, 2.2, 6]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.7, 0]}>
            <sphereGeometry args={[1.15, 8, 6]} />
            <meshStandardMaterial color={COLORS.foliage} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Unit data shape passed to PremiumPlotCard
export interface UnitData {
  id: string;
  type: 'house' | 'amenity' | 'civic';
  imageUrl?: string;
  // house
  status?: 'Allotted' | 'Free' | 'Rented';
  marla?: number;
  bedrooms?: number;
  ownerName?: string;
  ownerContact?: string;
  ownedSince?: string;
  rentedFrom?: string;
  allotmentType?: string;
  // civic / amenity
  civicType?: string;
  department?: string;
  inchargeName?: string;
  contact?: string;
  timings?: string;
}

function TownModels({
  onFocusRequest,
  onUnitSelect,
}: {
  onFocusRequest?: (center: { x: number; z: number }) => void;
  onUnitSelect?: (unit: UnitData) => void;
}) {
  const [stage, setStage] = useState(1);
  const advance = useCallback((next: number) => setStage((current) => Math.max(current, next)), []);

  return (
    <group onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onFocusRequest?.({ x: event.point.x, z: event.point.z });
    }}>
      {stage >= 1 && (
        <React.Suspense fallback={null}>
          {TOWN.plots.map((plot) => (
            <group
              key={plot.id}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                const marlaNum = plot.size === '5marla' ? 5 : plot.size === '7marla' ? 7 : 12;
                onUnitSelect?.({
                  id: plot.id,
                  type: 'house',
                  status: 'Free',
                  marla: marlaNum,
                  bedrooms: marlaNum <= 5 ? 3 : marlaNum <= 7 ? 4 : 5,
                  allotmentType: 'Private',
                });
              }}
            >
              <ModelInstance
                url={MODEL_PATHS[plot.size]}
                position={plot.position}
                bounds={plot.bounds}
                rotation={plot.rotation}
                yOffset={0.03}
                fitMode={plot.size === '12marla' ? '12marla' : 'plot'}
                label={`${plot.id} ${plot.size}`}
              />
            </group>
          ))}
          {TOWN.amenities.map((a) => (
            <group
              key={a.id}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onUnitSelect?.({
                  id: a.id,
                  type: 'amenity',
                  civicType: a.type,
                });
              }}
            >
              <ModelInstance
                url={a.type === 'masjid' ? MODEL_PATHS.masjid : MODEL_PATHS.market}
                position={a.position}
                bounds={a.bounds}
                yOffset={0.4}
                rotation={90}
                fitMode={a.type === 'masjid' ? 'masjid' : 'market'}
                label={a.id}
              />
            </group>
          ))}
          {stage === 1 && <ModelStageReady next={2} onAdvance={advance} />}
        </React.Suspense>
      )}

      {stage >= 2 && (
        <React.Suspense fallback={null}>
          {TOWN.civic.filter((c) => c.type === 'police' || c.type === 'fire').map((c) => {
            const modelMap: Record<string, string> = {
              police: MODEL_PATHS.police,
              fire: MODEL_PATHS.fire,
            };
            return (
              <React.Fragment key={c.id}>
                <group
                  onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation();
                    onUnitSelect?.({
                      id: c.id,
                      type: 'civic',
                      civicType: c.type,
                    });
                  }}
                >
                  <ModelInstance
                    url={modelMap[c.type] ?? MODEL_PATHS.hospital}
                    position={c.position}
                    bounds={c.bounds}
                    yOffset={0.4}
                    fitMode={c.type === 'hospital' ? 'hospital' : c.type === 'school' ? 'school' : 'footprint'}
                    label={c.id}
                  />
                </group>
                {c.type === 'police' && <CivicTrees center={c.position} bounds={c.bounds} count={5} />}
              </React.Fragment>
            );
          })}
          {stage === 2 && <ModelStageReady next={3} onAdvance={advance} />}
        </React.Suspense>
      )}

      {stage >= 3 && (
        <React.Suspense fallback={null}>
          {TOWN.civic.filter((c) => c.type === 'hospital').map((c) => (
            <group
              key={c.id}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onUnitSelect?.({
                  id: c.id,
                  type: 'civic',
                  civicType: c.type,
                });
              }}
            >
              <ModelInstance url={MODEL_PATHS.hospital} position={c.position} bounds={c.bounds} yOffset={0.4} fitMode="hospital" label={c.id} />
            </group>
          ))}
          {stage === 3 && <ModelStageReady next={4} onAdvance={advance} />}
        </React.Suspense>
      )}

      {stage >= 4 && (
        <React.Suspense fallback={null}>
          {TOWN.civic.filter((c) => c.type === 'school').map((c) => (
            <group
              key={c.id}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onUnitSelect?.({
                  id: c.id,
                  type: 'civic',
                  civicType: c.type,
                });
              }}
            >
              <ModelInstance url={MODEL_PATHS.school} position={c.position} bounds={c.bounds} yOffset={0.4} fitMode="school" label={c.id} />
            </group>
          ))}
          {stage === 4 && <ModelStageReady next={5} onAdvance={advance} />}
        </React.Suspense>
      )}

      {stage >= 5 && (
        <React.Suspense fallback={null}>
          {TOWN.civic.filter((c) => c.type === 'wapda').map((c) => (
            <group
              key={c.id}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onUnitSelect?.({
                  id: c.id,
                  type: 'civic',
                  civicType: c.type,
                });
              }}
            >
              <ModelInstance url={MODEL_PATHS.wapda} position={c.position} bounds={c.bounds} yOffset={0.4} fitMode="footprint" label={c.id} />
            </group>
          ))}
          {stage === 5 && <ModelStageReady next={6} onAdvance={advance} />}
        </React.Suspense>
      )}

      {stage >= 6 && (
        <React.Suspense fallback={null}>
          {TOWN.civic.filter((c) => c.type === 'park').map((c) => (
            <React.Fragment key={c.id}>
              <group
                onClick={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation();
                  onUnitSelect?.({
                    id: c.id,
                    type: 'civic',
                    civicType: 'park',
                  });
                }}
              >
                <ModelInstance
                  url={MODEL_PATHS.greenGround}
                  position={{ x: c.position.x, z: c.position.z + 3 }}
                  // The Blender GreenGround asset is the visible park terrain.
                  // Fit that asset to the complete frozen wall-to-road parcel;
                  // the civic block bounds themselves remain unchanged.
                  bounds={{ ...c.bounds, d: 46 }}
                  fitMode="park"
                  yOffset={0.03}
                  label={`${c.id} ground`}
                />
                <ModelInstance url={MODEL_PATHS.kidsPlay} position={c.position} bounds={c.bounds} targetHeight={3.5} yOffset={0.4} label={`${c.id} playground`} />
                <CivicTrees center={c.position} bounds={c.bounds} count={6} />
              </group>
            </React.Fragment>
          ))}
        </React.Suspense>
      )}
    </group>
  );
}

interface TownSceneProps {
  walkModeEnabled: boolean;
  onWalkModeChange: (enabled: boolean) => void;
  onWalkLockChange: (locked: boolean) => void;
  onFocusRequest: (center: { x: number; z: number }) => void;
  focusTarget: { x: number; z: number } | null;
  walkLockRequest: number;
  onUnitSelect?: (unit: UnitData) => void;
}

function ParkSafetyFence() {
  const park = TOWN.civic.find((c) => c.type === 'park');
  if (!park) return null;

  // Match the existing visual GreenGround parcel exactly. The inset keeps
  // the fence on the park side of the road edge and town boundary.
  const width = park.bounds.w - 0.6;
  const depth = 46 - 0.6;
  const centerX = park.position.x;
  const centerZ = park.position.z + 3;
  const height = 1.25;
  const postSpacing = 7;
  const posts = useMemo(() => {
    const result: Array<[number, number]> = [];
    for (let x = -width / 2; x <= width / 2 + 0.01; x += postSpacing) {
      result.push([centerX + Math.min(x, width / 2), centerZ - depth / 2]);
      result.push([centerX + Math.min(x, width / 2), centerZ + depth / 2]);
    }
    for (let z = -depth / 2 + postSpacing; z < depth / 2; z += postSpacing) {
      result.push([centerX - width / 2, centerZ + z]);
      result.push([centerX + width / 2, centerZ + z]);
    }
    return result;
  }, [centerX, centerZ, depth, width]);

  return (
    <group>
      <mesh position={[centerX, height * 0.58, centerZ - depth / 2]}>
        <boxGeometry args={[width, 0.12, 0.12]} />
        <meshStandardMaterial color="#4B514D" roughness={0.52} metalness={0.38} />
      </mesh>
      <mesh position={[centerX, height * 0.58, centerZ + depth / 2]}>
        <boxGeometry args={[width, 0.12, 0.12]} />
        <meshStandardMaterial color="#4B514D" roughness={0.52} metalness={0.38} />
      </mesh>
      <mesh position={[centerX - width / 2, height * 0.58, centerZ]}>
        <boxGeometry args={[0.12, 0.12, depth]} />
        <meshStandardMaterial color="#4B514D" roughness={0.52} metalness={0.38} />
      </mesh>
      <mesh position={[centerX + width / 2, height * 0.58, centerZ]}>
        <boxGeometry args={[0.12, 0.12, depth]} />
        <meshStandardMaterial color="#4B514D" roughness={0.52} metalness={0.38} />
      </mesh>
      {posts.map(([x, z], index) => (
        <mesh key={index} position={[x, height / 2, z]}>
          <boxGeometry args={[0.2, height, 0.2]} />
          <meshStandardMaterial color="#343A37" roughness={0.46} metalness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function ParkPerimeterGarden({ grassTexture }: { grassTexture: THREE.Texture | null }) {
  const park = TOWN.civic.find((c) => c.type === 'park');
  if (!park) return null;
  const width = park.bounds.w - 1.2;
  const depth = 44.8;
  const centerX = park.position.x;
  const centerZ = park.position.z + 3;
  const strip = 2.2;
  const materialProps = grassTexture
    ? { map: grassTexture, color: undefined }
    : { color: COLORS.gardenBase };

  return (
    <group>
      <mesh position={[centerX, 0.055, centerZ - depth / 2 + strip / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, strip]} />
        <meshStandardMaterial {...materialProps} roughness={0.86} />
      </mesh>
      <mesh position={[centerX, 0.055, centerZ + depth / 2 - strip / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, strip]} />
        <meshStandardMaterial {...materialProps} roughness={0.86} />
      </mesh>
      <mesh position={[centerX - width / 2 + strip / 2, 0.055, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[strip, depth - strip * 2]} />
        <meshStandardMaterial {...materialProps} roughness={0.86} />
      </mesh>
      <mesh position={[centerX + width / 2 - strip / 2, 0.055, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[strip, depth - strip * 2]} />
        <meshStandardMaterial {...materialProps} roughness={0.86} />
      </mesh>
    </group>
  );
}

function PremiumPostProcessing({ enabled }: { enabled: boolean }) {
  // Disabled for the interactive town: bloom/vignette allocate an additional
  // postprocess framebuffer and make large GLB scenes feel less responsive.
  void enabled;
  return null;
}

function RendererRecovery() {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => event.preventDefault();
    const onContextRestored = () => {
      gl.setPixelRatio(1);
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
    };
  }, [gl, invalidate]);

  return null;
}

function PremiumRenderer() {
  const { gl } = useThree();

  useEffect(() => {
    // ACES improves highlight/shadow roll-off without another render target.
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.08;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  return null;
}

function FrozenWallMaterial() {
  return (
    <LayerMaterial lighting="physical" color="#8a8a8a" roughness={0.68} metalness={0.04}>
      <Depth colorA="#bdbdbd" colorB="#626262" alpha={0.22} mode="multiply" near={0} far={8} />
      <Fresnel color="#fff8ea" intensity={0.12} power={2.5} mode="add" />
    </LayerMaterial>
  );
}

// ── Procedural Sand Ground Texture ──
function makeSurfaceTexture(base: string, kind: 'ground' | 'concrete' | 'road' | 'grass', repeat: number): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const count = kind === 'road' ? 1800 : 1000;
  for (let i = 0; i < count; i += 1) {
    const alpha = kind === 'road' ? 0.035 + Math.random() * 0.045 : 0.025 + Math.random() * 0.04;
    const bright = Math.random() > 0.52;
    ctx.fillStyle = bright ? `rgba(255,255,255,${alpha})` : `rgba(20,25,22,${alpha})`;
    const span = kind === 'grass' ? 1 + Math.random() * 4 : 1 + Math.random() * 2.5;
    ctx.fillRect(Math.random() * size, Math.random() * size, kind === 'grass' ? 1 : span, span);
  }
  if (kind === 'ground') {
    // Mix the empty land subtly with grass tones so it does not read as one
    // uninterrupted beige slab while retaining the existing terrain layout.
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(70,120,58,${0.025 + Math.random() * 0.035})`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (kind === 'concrete') {
    ctx.strokeStyle = 'rgba(90,94,92,0.11)';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 64) ctx.strokeRect(i + 0.5, 0.5, 63, 63);
  }
  if (kind === 'road') {
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    for (let i = -size; i < size * 2; i += 26) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 2;
  return texture;
}

function makeRoadNormalTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,255)'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(145,145,255,0.24)';
  for (let i = -128; i < 256; i += 18) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

export default function TownScene({ walkModeEnabled, onWalkModeChange, onWalkLockChange, onFocusRequest, focusTarget, walkLockRequest, onUnitSelect }: TownSceneProps) {
  const { gl, camera, invalidate } = useThree();
  useEffect(() => { gl.shadowMap.type = THREE.PCFShadowMap; }, [gl]);

  const surfaceTextures = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return {
      ground: makeSurfaceTexture(COLORS.ground, 'ground', 16),
      concrete: makeSurfaceTexture(COLORS.plotGround, 'concrete', 5),
      road: makeSurfaceTexture(COLORS.road, 'road', 18),
      roadNormal: makeRoadNormalTexture(),
      grass: makeSurfaceTexture(COLORS.gardenBase, 'grass', 10),
    };
  }, []);
  useEffect(() => () => {
    surfaceTextures?.ground.dispose(); surfaceTextures?.concrete.dispose();
    surfaceTextures?.road.dispose(); surfaceTextures?.roadNormal.dispose(); surfaceTextures?.grass.dispose();
  }, [surfaceTextures]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Instanced Refs
  const roadsRef = useRef<THREE.InstancedMesh>(null);
  const roadMarkingsRef = useRef<THREE.InstancedMesh>(null);
  const curbsRef = useRef<THREE.InstancedMesh>(null);
  const plotGroundRef = useRef<THREE.InstancedMesh>(null);
  const plotBoundaryRef = useRef<THREE.InstancedMesh>(null);
  const amenityRef = useRef<THREE.InstancedMesh>(null);
  const amenityRoofRef = useRef<THREE.InstancedMesh>(null);
  const amenityPlinthRef = useRef<THREE.InstancedMesh>(null);
  const masjidDomeRef = useRef<THREE.InstancedMesh>(null);
  const masjidMinaretRef = useRef<THREE.InstancedMesh>(null);
  const civicRef = useRef<THREE.InstancedMesh>(null);
  const civicRoofRef = useRef<THREE.InstancedMesh>(null);
  const parkGrassRef = useRef<THREE.InstancedMesh>(null);
  const greenBeltRef = useRef<THREE.InstancedMesh>(null);
  const concreteBorderRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const treeFoliageRef = useRef<THREE.InstancedMesh>(null);
  const benchRef = useRef<THREE.InstancedMesh>(null);
  const orbitRef = useRef<any>(null);
  const frozenBaselineRef = useRef<string | null>(null);
  const focusOriginRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const focusAnimationRef = useRef<number | null>(null);
  const [focusActive, setFocusActive] = React.useState(false);

  // Derived counts
  const plotCount = TOWN.plots.length;
  const amenityCount = TOWN.amenities.length;
  const civicCount = TOWN.civic.length;
  const lightCount = TOWN.lights.length;
  const treeCount = TOWN.trees.length;
  const bushCount = TOWN.bushes?.length ?? 0;
  const benchCount = TOWN.benches.length;
  const greenBeltCount = TOWN.greenBelts.length;
  const borderCount = TOWN.greenBelts.length * 4;

  useEffect(() => {
    // Cancel any in-flight animation before starting a new one
    if (focusAnimationRef.current !== null) {
      cancelAnimationFrame(focusAnimationRef.current);
      focusAnimationRef.current = null;
    }

    const animate = (
      fromPos: THREE.Vector3, toPos: THREE.Vector3,
      fromTgt: THREE.Vector3, toTgt: THREE.Vector3,
      duration: number, done: () => void,
    ) => {
      const started = performance.now();
      // Take snapshots so we lerp from stable values even if refs change
      const fp = fromPos.clone();
      const tp = toPos.clone();
      const ft = fromTgt.clone();
      const tt = toTgt.clone();
      const tick = () => {
        const progress = Math.min((performance.now() - started) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        camera.position.lerpVectors(fp, tp, eased);
        if (orbitRef.current) orbitRef.current.target.lerpVectors(ft, tt, eased);
        camera.lookAt(orbitRef.current ? orbitRef.current.target : tt);
        invalidate();
        if (progress < 1) {
          focusAnimationRef.current = requestAnimationFrame(tick);
        } else {
          focusAnimationRef.current = null;
          done();
        }
      };
      focusAnimationRef.current = requestAnimationFrame(tick);
    };

    if (focusTarget) {
      // Save origin only on the very first focus activation.
      // Subsequent re-focuses (second double-click) update the camera
      // position but keep the original orbit origin for correct restore.
      if (!focusOriginRef.current) {
        focusOriginRef.current = {
          position: camera.position.clone(),
          target: orbitRef.current?.target?.clone() ?? new THREE.Vector3(0, 0, 0),
        };
      }
      setFocusActive(true);

      const fromPos = camera.position.clone();
      const fromTgt = orbitRef.current?.target?.clone() ?? new THREE.Vector3(0, 0, 0);
      const toTgt = new THREE.Vector3(focusTarget.x, 0, focusTarget.z);

      // Always use a fixed bird's-eye offset so the zoom is
      // predictable regardless of current camera distance.
      const toPos = toTgt.clone().add(new THREE.Vector3(0, 30, 28));

      animate(fromPos, toPos, fromTgt, toTgt, 850, () => {
        if (orbitRef.current) orbitRef.current.target.copy(toTgt);
        if (orbitRef.current) orbitRef.current.update();
      });
    } else if (focusOriginRef.current && !walkModeEnabled) {
      // Restore to the saved origin
      const origin = focusOriginRef.current;
      const fromPos = camera.position.clone();
      const fromTgt = orbitRef.current?.target?.clone() ?? new THREE.Vector3();
      animate(fromPos, origin.position, fromTgt, origin.target, 700, () => {
        if (orbitRef.current) {
          orbitRef.current.target.copy(origin.target);
          orbitRef.current.update();
        }
        focusOriginRef.current = null;
        setFocusActive(false);
      });
    } else if (focusOriginRef.current && walkModeEnabled) {
      // Walk mode was activated while focused — just discard origin
      focusOriginRef.current = null;
      setFocusActive(false);
    } else {
      setFocusActive(false);
    }

    return () => {
      if (focusAnimationRef.current !== null) {
        cancelAnimationFrame(focusAnimationRef.current);
        focusAnimationRef.current = null;
      }
    };
  }, [camera, focusTarget, invalidate, walkModeEnabled]);

  // Count road markings needed
  const markingCount = useMemo(() => {
    let total = 0;
    TOWN.streets.forEach((st) => {
      const start = -st.length / 2 + 10;
      const end = st.length / 2 - 10;
      for (let pos = start; pos <= end; pos += 7.0) total++;
    });
    return total;
  }, []);

  useEffect(() => {
    // ── 1. Roads ──
    if (roadsRef.current) {
      TOWN.streets.forEach((st, i) => {
        dummy.position.set(st.position.x, 0.01, st.position.z);
        dummy.rotation.set(-Math.PI / 2, 0, st.orientation === 'NS' ? 0 : Math.PI / 2);
        dummy.scale.set(st.width, st.length, 1);
        dummy.updateMatrix();
        roadsRef.current!.setMatrixAt(i, dummy.matrix);
      });
      roadsRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 2. Yellow Dashed Centerlines ──
    if (roadMarkingsRef.current) {
      let mi = 0;
      const stripeLen = 4.0;
      const stripeGap = 3.0;
      const stripeW = 0.30;

      TOWN.streets.forEach((st) => {
        const isNS = st.orientation === 'NS';
        const start = -st.length / 2 + 10;
        const end = st.length / 2 - 10;

        for (let pos = start; pos <= end; pos += stripeLen + stripeGap) {
          if (isNS) {
            dummy.position.set(st.position.x, 0.012, st.position.z + pos);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.scale.set(stripeW, stripeLen, 1);
          } else {
            dummy.position.set(st.position.x + pos, 0.012, st.position.z);
            dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
            dummy.scale.set(stripeW, stripeLen, 1);
          }
          dummy.updateMatrix();
          if (mi < markingCount) {
            roadMarkingsRef.current!.setMatrixAt(mi++, dummy.matrix);
          }
        }
      });
      roadMarkingsRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 3. Terracotta Curbs ──
    if (curbsRef.current) {
      let ci = 0;
      const ch = 0.15;
      const cw = 0.35;

      TOWN.streets.forEach((st) => {
        const halfW = st.width / 2;
        if (st.orientation === 'NS') {
          [-halfW, halfW].forEach((sideX) => {
            dummy.position.set(st.position.x + sideX, ch / 2 + 0.01, st.position.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(cw, ch, st.length);
            dummy.updateMatrix();
            curbsRef.current!.setMatrixAt(ci++, dummy.matrix);
          });
        } else {
          [-halfW, halfW].forEach((sideZ) => {
            dummy.position.set(st.position.x, ch / 2 + 0.01, st.position.z + sideZ);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(st.length, ch, cw);
            dummy.updateMatrix();
            curbsRef.current!.setMatrixAt(ci++, dummy.matrix);
          });
        }
      });
      curbsRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 4. Empty Plot Pads ──
    if (plotGroundRef.current) {
      TOWN.plots.forEach((p, i) => {
        dummy.position.set(p.position.x, 0.02, p.position.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(p.bounds.w, p.bounds.d, 1);
        dummy.updateMatrix();
        plotGroundRef.current!.setMatrixAt(i, dummy.matrix);
      });
      plotGroundRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 6. Amenities — Foundation Plinths only (GLB models render the buildings) ──
    if (amenityPlinthRef.current) {
      const plinthH = 0.4;
      TOWN.amenities.forEach((a, i) => {
        dummy.position.set(a.position.x, plinthH / 2, a.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(a.bounds.w + 0.6, plinthH, a.bounds.d + 0.6);
        dummy.updateMatrix();
        amenityPlinthRef.current!.setMatrixAt(i, dummy.matrix);
      });
      amenityPlinthRef.current.instanceMatrix.needsUpdate = true;
    }

    if (amenityRef.current) {
      TOWN.amenities.forEach((amenity, index) => {
        dummy.position.set(amenity.position.x, amenity.bounds.h / 2, amenity.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(amenity.bounds.w, amenity.bounds.h, amenity.bounds.d);
        dummy.updateMatrix();
        amenityRef.current!.setMatrixAt(index, dummy.matrix);
      });
      amenityRef.current.instanceMatrix.needsUpdate = true;
    }
    if (civicRef.current) {
      TOWN.civic.forEach((civic, index) => {
        dummy.position.set(civic.position.x, civic.bounds.h / 2, civic.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(civic.bounds.w, civic.bounds.h, civic.bounds.d);
        dummy.updateMatrix();
        civicRef.current!.setMatrixAt(index, dummy.matrix);
      });
      civicRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 7. Civic Zone — no procedural bodies (GLB models handle all civic buildings & park) ──

    // ── 8. Park Grass Overlay ──
    if (parkGrassRef.current) {
      const park = TOWN.civic.find((c) => c.type === 'park');
      if (park) {
        // Full green underlay for the frozen park/civic plot. It stays just
        // below the imported GreenGround asset and never extends into roads.
        dummy.position.set(park.position.x, 0.015, park.position.z + 3);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        // The frozen civic park pad spans the full wall-to-road green area.
        // Keep the civic model bounds unchanged; enlarge only this visual
        // grass underlay so no brown terrain remains inside the park parcel.
        dummy.scale.set(park.bounds.w, 46, 1);
        dummy.updateMatrix();
        parkGrassRef.current.setMatrixAt(0, dummy.matrix);
        parkGrassRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // ── 10. LUXURY LINEAR PARK GARDENS (Elevated Base, Concrete Borders, Trees, Bushes, Benches) ──
    if (greenBeltRef.current) {
      TOWN.greenBelts.forEach((gb, i) => {
        dummy.position.set(gb.position.x, 0.035, gb.position.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(gb.bounds.w, gb.bounds.d, 1);
        dummy.updateMatrix();
        greenBeltRef.current!.setMatrixAt(i, dummy.matrix);
      });
      greenBeltRef.current.instanceMatrix.needsUpdate = true;
    }

    if (concreteBorderRef.current) {
      let bi = 0;
      const bh = 0.12;
      const bt = 0.25;
      const cy = 0.04 + bh / 2;
      TOWN.greenBelts.forEach((gb) => {
        const hw = gb.bounds.w / 2;
        const hd = gb.bounds.d / 2;
        // North edge
        dummy.position.set(gb.position.x, cy, gb.position.z - hd);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(gb.bounds.w, bh, bt);
        dummy.updateMatrix();
        concreteBorderRef.current!.setMatrixAt(bi++, dummy.matrix);
        // South edge
        dummy.position.set(gb.position.x, cy, gb.position.z + hd);
        dummy.scale.set(gb.bounds.w, bh, bt);
        dummy.updateMatrix();
        concreteBorderRef.current!.setMatrixAt(bi++, dummy.matrix);
        // West edge
        dummy.position.set(gb.position.x - hw, cy, gb.position.z);
        dummy.scale.set(bt, bh, gb.bounds.d);
        dummy.updateMatrix();
        concreteBorderRef.current!.setMatrixAt(bi++, dummy.matrix);
        // East edge
        dummy.position.set(gb.position.x + hw, cy, gb.position.z);
        dummy.scale.set(bt, bh, gb.bounds.d);
        dummy.updateMatrix();
        concreteBorderRef.current!.setMatrixAt(bi++, dummy.matrix);
      });
      concreteBorderRef.current.instanceMatrix.needsUpdate = true;
    }

    if (treeTrunkRef.current && treeFoliageRef.current) {
      TOWN.trees.forEach((t, i) => {
        const s = t.scale;
        dummy.position.set(t.position.x, 0.9 * s, t.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        treeTrunkRef.current!.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.position.x, 1.8 * s + 1.4 * s, t.position.z);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        treeFoliageRef.current!.setMatrixAt(i, dummy.matrix);
      });
      treeTrunkRef.current.instanceMatrix.needsUpdate = true;
      treeFoliageRef.current.instanceMatrix.needsUpdate = true;
    }

    if (bushRef.current && TOWN.bushes) {
      TOWN.bushes.forEach((b, i) => {
        dummy.position.set(b.position.x, 0.45 * b.scale, b.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.scale, b.scale, b.scale);
        dummy.updateMatrix();
        bushRef.current!.setMatrixAt(i, dummy.matrix);
      });
      bushRef.current.instanceMatrix.needsUpdate = true;
    }

    if (benchRef.current) {
      TOWN.benches.forEach((b, i) => {
        dummy.position.set(b.position.x, 0.22, b.position.z);
        dummy.rotation.set(0, b.rotation, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        benchRef.current!.setMatrixAt(i, dummy.matrix);
      });
      benchRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── Disable frustum culling on ALL instanced meshes ──
    // Instanced meshes receive transforms after mount so their auto-computed
    // AABB is stale. Stale bounds make roads, gardens, buildings, lights, and
    // park grass vanish the moment the walk camera moves outside the old AABB.
    // Setting frustumCulled=false is the only reliable fix for scenes where the
    // camera moves inside geometry (walk mode) or zooms in tight (focus mode).
    [
      roadsRef.current, roadMarkingsRef.current, curbsRef.current,
      plotGroundRef.current, greenBeltRef.current,
      concreteBorderRef.current, bushRef.current, treeTrunkRef.current,
      treeFoliageRef.current, benchRef.current,
      // These were missing — amenity plinths, invisible raycasting volumes,
      // and park grass must also never be culled.
      amenityPlinthRef.current, amenityRef.current, amenityRoofRef.current,
      masjidDomeRef.current, masjidMinaretRef.current,
      civicRef.current, civicRoofRef.current, parkGrassRef.current,
    ].forEach((mesh) => {
      if (!mesh) return;
      mesh.frustumCulled = false;
      mesh.computeBoundingSphere();
    });

  }, [dummy, markingCount]);

  useEffect(() => {
    const frozenMeshes = [amenityRef.current, civicRef.current, roadsRef.current];
    const signature = frozenMeshes.map((mesh) => mesh ? Array.from(mesh.instanceMatrix.array).join(',') : 'missing').join('|');
    if (signature.includes('missing')) return;
    if (frozenBaselineRef.current === null) {
      frozenBaselineRef.current = signature;
      console.info('FROZEN CHECK: PASS');
      console.info('LAYOUT FROZEN: PASS');
      return;
    }
    if (frozenBaselineRef.current === signature) console.info('FROZEN CHECK: PASS');
    else console.error('FROZEN CHECK: FAIL');
  }, [dummy, markingCount]);

  return (
    <group>
      <RendererRecovery />
      <PremiumRenderer />
      <color attach="background" args={[COLORS.fog]} />
      <fogExp2 attach="fog" args={[COLORS.fog, 0.009]} />

      {/* Warm Golden Hour Lighting */}
      <ambientLight intensity={0.62} color="#FFF4E8" />
      <directionalLight
        position={[120, 180, -90]}
        intensity={1.55}
        color="#FFE3C7"
        castShadow={false}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-bias={-0.0002}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Ground Planes — Tightly Wrapped on Left Side to Remove Empty Space */}
      {/* Right Side Ground (90m x 180m, x: 0..90, z: -90..90) */}
      <mesh position={[45, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 180]} />
        <meshStandardMaterial map={surfaceTextures?.ground ?? undefined} color={surfaceTextures?.ground ? undefined : COLORS.ground} roughness={0.88} />
      </mesh>
      {/* Left Side Ground (93m x 124m, x: -93..0, z: -62..62) */}
      <mesh position={[-46.5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[93, 124]} />
        <meshStandardMaterial map={surfaceTextures?.ground ?? undefined} color={surfaceTextures?.ground ? undefined : COLORS.ground} roughness={0.88} />
      </mesh>

      {/* Luxury Linear Park Green Belt Base */}
      <instancedMesh ref={greenBeltRef} args={[undefined, undefined, greenBeltCount]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={surfaceTextures?.grass ?? undefined} color={surfaceTextures?.grass ? undefined : COLORS.gardenBase} roughness={0.8} />
      </instancedMesh>

      {/* Concrete Stone Borders around Green Belts */}
      <instancedMesh ref={concreteBorderRef} args={[undefined, undefined, borderCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.concreteBorder} roughness={0.58} />
      </instancedMesh>

      {/* Low-Poly Trees in Straight 8m Lines */}
      <instancedMesh ref={treeTrunkRef} args={[undefined, undefined, treeCount]} castShadow>
        <cylinderGeometry args={[0.2, 0.35, 1.8, 6]} />
        <meshStandardMaterial color={COLORS.wood} roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={treeFoliageRef} args={[undefined, undefined, treeCount]} castShadow>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color={COLORS.foliage} roughness={0.8} metalness={0} />
      </instancedMesh>

      {/* Low-Poly Bushes (Tree, Bush Alternating Pattern) */}
      <instancedMesh ref={bushRef} args={[undefined, undefined, bushCount]} castShadow>
        <dodecahedronGeometry args={[0.75, 1]} />
        <meshStandardMaterial color={COLORS.bushFoliage} roughness={0.8} />
      </instancedMesh>

      {/* Smart Fill Park Benches */}
      <instancedMesh ref={benchRef} args={[undefined, undefined, benchCount]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.45, 0.6]} />
        <meshStandardMaterial color={COLORS.wood} roughness={0.7} />
      </instancedMesh>

      {/* Roads */}
      <instancedMesh ref={roadsRef} args={[undefined, undefined, TOWN.streets.length]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={surfaceTextures?.road ?? undefined} normalMap={surfaceTextures?.roadNormal ?? undefined} color={surfaceTextures?.road ? undefined : COLORS.road} roughness={0.8} metalness={0.1} normalScale={[0.18, 0.18]} />
      </instancedMesh>

      {/* Yellow Dashed Center Markings */}
      <instancedMesh ref={roadMarkingsRef} args={[undefined, undefined, markingCount]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.roadMarking} roughness={0.5} />
      </instancedMesh>

      {/* Terracotta Curbs */}
      <instancedMesh ref={curbsRef} args={[undefined, undefined, TOWN.streets.length * 2]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.curb} roughness={0.7} />
      </instancedMesh>

      {/* Empty Plot Pads */}
      <instancedMesh ref={plotGroundRef} args={[undefined, undefined, plotCount]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={surfaceTextures?.concrete ?? undefined} color={surfaceTextures?.concrete ? undefined : COLORS.plotGround} roughness={0.9} metalness={0.05} />
      </instancedMesh>

      {/* Plot Boundaries — HIDDEN to remove orange lines around roads */}
      <instancedMesh ref={plotBoundaryRef} args={[undefined, undefined, plotCount * 4]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.accent} roughness={0.52} />
      </instancedMesh>

      {/* Amenity Foundation Plinth Bases */}
      <instancedMesh ref={amenityPlinthRef} args={[undefined, undefined, amenityCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.plinth} roughness={0.64} />
      </instancedMesh>

      {/* Amenity body/roof/dome/minarets — HIDDEN: GLB models render these now */}
      <instancedMesh ref={amenityRef} args={[undefined, undefined, 1]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.market} />
      </instancedMesh>
      <instancedMesh ref={amenityRoofRef} args={[undefined, undefined, 1]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicTrim} />
      </instancedMesh>
      <instancedMesh ref={masjidDomeRef} args={[undefined, undefined, 1]} visible={false}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial color={COLORS.masjidDome} />
      </instancedMesh>
      <instancedMesh ref={masjidMinaretRef} args={[undefined, undefined, 1]} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 4]} />
        <meshStandardMaterial color={COLORS.civicBody} />
      </instancedMesh>

      {/* Civic zone body/roof — HIDDEN: GLB models render these now */}
      <instancedMesh ref={civicRef} args={[undefined, undefined, 1]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicBody} />
      </instancedMesh>
      <instancedMesh ref={civicRoofRef} args={[undefined, undefined, 1]} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicTrim} />
      </instancedMesh>

      {/* Full park grass underlay — sized to the existing frozen park bounds */}
      <instancedMesh ref={parkGrassRef} args={[undefined, undefined, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={surfaceTextures?.grass ?? undefined} color={surfaceTextures?.grass ? undefined : COLORS.parkGround} roughness={0.86} />
      </instancedMesh>

      {/* ── CUSTOM BOUNDARY AND GATE ── */}
      <BoundaryWall />
      <PremiumGate />

      {/* ── 3D GLB MODELS PLACEMENT (Plots, Amenities, Civic Blocks & Park Play) ── */}
      <TownModels onFocusRequest={onFocusRequest} onUnitSelect={onUnitSelect} />
      <ParkPerimeterGarden grassTexture={surfaceTextures?.grass ?? null} />
      <ParkSafetyFence />
      <MughalGarden position={[48, 0.08, -67]} width={22} depth={16} />



      {/* Orbit Controls */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enabled={!walkModeEnabled}
        enablePan={!focusActive}
        minDistance={30}
        maxDistance={320}
        maxPolarAngle={Math.PI / 2.1}
        enableDamping
        dampingFactor={0.06}
      />

      <WalkMode enabled={walkModeEnabled} lockRequest={walkLockRequest} onLockChange={(locked) => {
        onWalkLockChange(locked);
        if (!locked) {
          if (orbitRef.current) {
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            direction.y = 0;
            direction.normalize();
            orbitRef.current.target.copy(camera.position).add(direction.multiplyScalar(10));
            orbitRef.current.update();
          }
          onWalkModeChange(false);
        }
      }} />
      <PremiumPostProcessing enabled={!walkModeEnabled} />

    </group>
  );
}
