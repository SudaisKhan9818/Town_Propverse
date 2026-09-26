'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { getTownData } from './layout-engine';
import type { Selection } from './useSelection';
import { useRaycaster } from './useRaycaster';
import WalkMode from './WalkMode';
import {
  GROUND_SIZE, COLORS, WALL_HEIGHT, WALL_THICK, GATE_WIDTH,
  BOULEVARD_WIDTH, LEFT_BOUND_X, LEFT_BOUND_Z_NORTH, LEFT_BOUND_Z_SOUTH
} from './town.config';

const TOWN = getTownData();

interface TownSceneProps {
  walkModeEnabled: boolean;
  onWalkModeChange: (enabled: boolean) => void;
  onWalkLockChange: (locked: boolean) => void;
  onSelectionChange: (selection: Selection | null, center: { x: number; z: number } | null) => void;
  onFocusRequest: (center: { x: number; z: number }) => void;
  focusTarget: { x: number; z: number } | null;
  selectionResetKey: number;
  walkLockRequest: number;
}

function AmenityOutline({ target }: { target: { x: number; y: number; z: number; w: number; h: number; d: number } | null }) {
  const geometry = useMemo(() => {
    if (!target) return null;
    const box = new THREE.BoxGeometry(target.w + 0.5, target.h + 0.5, target.d + 0.5);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [target]);
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  if (!target || !geometry) return null;
  return (
    <lineSegments position={[target.x, target.y, target.z]} geometry={geometry}>
      <lineBasicMaterial color="#C0562F" transparent opacity={0.9} depthWrite={false} />
    </lineSegments>
  );
}

// ── Procedural Sand Ground Texture ──
function makeGroundTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    const a = Math.random() > 0.5 ? 0.06 : 0.03;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

export default function TownScene({ walkModeEnabled, onWalkModeChange, onWalkLockChange, onSelectionChange, onFocusRequest, focusTarget, selectionResetKey, walkLockRequest }: TownSceneProps) {
  const { gl, camera, invalidate } = useThree();
  useEffect(() => { gl.shadowMap.type = THREE.PCFShadowMap; }, [gl]);

  const groundTex = useMemo(() => (typeof window !== 'undefined' ? makeGroundTexture() : null), []);
  useEffect(() => () => { groundTex?.dispose(); }, [groundTex]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Instanced Refs
  const roadsRef        = useRef<THREE.InstancedMesh>(null);
  const roadMarkingsRef = useRef<THREE.InstancedMesh>(null);
  const curbsRef        = useRef<THREE.InstancedMesh>(null);
  const plotGroundRef   = useRef<THREE.InstancedMesh>(null);
  const plotBoundaryRef = useRef<THREE.InstancedMesh>(null);
  const amenityRef      = useRef<THREE.InstancedMesh>(null);
  const amenityRoofRef  = useRef<THREE.InstancedMesh>(null);
  const amenityPlinthRef= useRef<THREE.InstancedMesh>(null);
  const masjidDomeRef   = useRef<THREE.InstancedMesh>(null);
  const masjidMinaretRef= useRef<THREE.InstancedMesh>(null);
  const civicRef        = useRef<THREE.InstancedMesh>(null);
  const civicRoofRef    = useRef<THREE.InstancedMesh>(null);
  const parkGrassRef    = useRef<THREE.InstancedMesh>(null);
  const greenBeltRef    = useRef<THREE.InstancedMesh>(null);
  const concreteBorderRef = useRef<THREE.InstancedMesh>(null);
  const bushRef         = useRef<THREE.InstancedMesh>(null);
  const treeTrunkRef    = useRef<THREE.InstancedMesh>(null);
  const treeFoliageRef  = useRef<THREE.InstancedMesh>(null);
  const benchRef        = useRef<THREE.InstancedMesh>(null);
  const lightPoleRef    = useRef<THREE.InstancedMesh>(null);
  const lightBulbRef    = useRef<THREE.InstancedMesh>(null);
  const wallRef         = useRef<THREE.InstancedMesh>(null);
  const gatePiersRef    = useRef<THREE.InstancedMesh>(null);
  const orbitRef = useRef<any>(null);
  const frozenBaselineRef = useRef<string | null>(null);
  const focusOriginRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const focusAnimationRef = useRef<number | null>(null);
  const [focusActive, setFocusActive] = React.useState(false);


  const { hovered, handlePointerMove, handleClick, handleDoubleClick, clearHighlight } = useRaycaster({
    plotBoundaryRef,
    plotGroundRef,
    amenityRef,
    civicRef,
    amenityRoofRef,
    masjidDomeRef,
    masjidMinaretRef,
    civicRoofRef,
    parkGrassRef,
    resetKey: selectionResetKey,
    onSelectionChange,
    onFocusRequest,
  });

  // Derived counts
  const plotCount      = TOWN.plots.length;
  const amenityCount   = TOWN.amenities.length;
  const masjidCount    = TOWN.amenities.filter((a) => a.type === 'masjid').length;
  const civicCount     = TOWN.civic.length;
  const lightCount     = TOWN.lights.length;
  const treeCount      = TOWN.trees.length;
  const bushCount      = TOWN.bushes?.length ?? 0;
  const benchCount     = TOWN.benches.length;
  const greenBeltCount = TOWN.greenBelts.length;
  const borderCount    = TOWN.greenBelts.length * 4;



  const hoveredAmenity = useMemo(() => {
    if (!hovered || hovered.type !== 'amenity') return null;
    if (hovered.index < TOWN.amenities.length) {
      const a = TOWN.amenities[hovered.index];
      return { x: a.position.x, y: 0.5 + a.bounds.h / 2, z: a.position.z, w: a.bounds.w, h: a.bounds.h, d: a.bounds.d };
    }
    const c = TOWN.civic[hovered.index - TOWN.amenities.length];
    return c ? { x: c.position.x, y: c.type === 'park' ? 0.03 : 0.5 + c.bounds.h / 2, z: c.position.z, w: c.bounds.w, h: c.bounds.h, d: c.bounds.d } : null;
  }, [hovered]);

  useEffect(() => {
    if (plotBoundaryRef.current) {
      plotBoundaryRef.current.userData = {
        type: 'plot',
        instances: TOWN.plots.map((plot) => ({
          type: 'plot', plotId: plot.id, size: plot.size === '5marla' ? '5M' : plot.size === '7marla' ? '7M' : '12M',
          status: plot.status, streetId: plot.streetId, side: plot.side === 'north' ? 'left' : 'right',
        })),
      };
      for (let i = 0; i < plotCount * 4; i += 1) plotBoundaryRef.current.setColorAt(i, new THREE.Color('#B85C37'));
      if (plotBoundaryRef.current.instanceColor) plotBoundaryRef.current.instanceColor.needsUpdate = true;
    }
    if (amenityRef.current) {
      amenityRef.current.userData = {
        type: 'amenity',
        instances: TOWN.amenities.map((a) => ({ type: 'amenity', amenityId: a.id, name: a.type[0].toUpperCase() + a.type.slice(1) })),
      };
    }
    if (civicRef.current) {
      civicRef.current.userData = {
        type: 'amenity',
        instances: TOWN.civic.map((c) => ({ type: 'amenity', amenityId: c.id, name: c.type[0].toUpperCase() + c.type.slice(1) })),
      };
    }
  }, [amenityRef, civicRef, plotBoundaryRef, plotCount]);

  useEffect(() => {
    if (focusAnimationRef.current !== null) cancelAnimationFrame(focusAnimationRef.current);

    const animate = (fromPosition: THREE.Vector3, toPosition: THREE.Vector3, fromTarget: THREE.Vector3, toTarget: THREE.Vector3, done: () => void) => {
      const started = performance.now();
      const tick = () => {
        const progress = Math.min((performance.now() - started) / 800, 1);
        const eased = 1 - (1 - progress) ** 3;
        camera.position.lerpVectors(fromPosition, toPosition, eased);
        if (orbitRef.current) orbitRef.current.target.lerpVectors(fromTarget, toTarget, eased);
        camera.lookAt(orbitRef.current?.target ?? toTarget);
        invalidate();
        if (progress < 1) focusAnimationRef.current = requestAnimationFrame(tick);
        else { focusAnimationRef.current = null; done(); }
      };
      tick();
    };

    if (focusTarget) {
      if (!focusOriginRef.current) {
        focusOriginRef.current = {
          position: camera.position.clone(),
          target: orbitRef.current?.target?.clone() ?? new THREE.Vector3(0, 0, 0),
        };
      }
      setFocusActive(true);
      const fromPosition = camera.position.clone();
      const fromTarget = orbitRef.current?.target?.clone() ?? new THREE.Vector3(0, 0, 0);
      const unitTarget = new THREE.Vector3(focusTarget.x, 0, focusTarget.z);
      const offset = fromPosition.clone().sub(fromTarget);
      if (offset.lengthSq() < 100) offset.set(0, 28, 38);
      const toPosition = unitTarget.clone().add(offset);
      toPosition.y = Math.max(8, toPosition.y);
      animate(fromPosition, toPosition, fromTarget, unitTarget, () => {
        if (orbitRef.current) orbitRef.current.target.copy(unitTarget);
      });
    } else if (focusOriginRef.current && !walkModeEnabled) {
      const origin = focusOriginRef.current;
      animate(camera.position.clone(), origin.position, orbitRef.current?.target?.clone() ?? new THREE.Vector3(), origin.target, () => {
        if (orbitRef.current) orbitRef.current.target.copy(origin.target);
        focusOriginRef.current = null;
        setFocusActive(false);
      });
    } else if (focusOriginRef.current && walkModeEnabled) {
      focusOriginRef.current = null;
      setFocusActive(false);
    } else {
      setFocusActive(false);
    }

    return () => {
      if (focusAnimationRef.current !== null) cancelAnimationFrame(focusAnimationRef.current);
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

    // ── 5. Plot Boundaries (4 edges per plot) ──
    if (plotBoundaryRef.current) {
      let bi = 0;
      const bh = 0.20;
      const bt = 0.12;

      TOWN.plots.forEach((p) => {
        const hw = p.bounds.w / 2;
        const hd = p.bounds.d / 2;
        const cy = 0.02 + bh / 2;

        // Front
        dummy.position.set(p.position.x, cy, p.position.z + hd);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.bounds.w, bh, bt);
        dummy.updateMatrix();
        plotBoundaryRef.current!.setMatrixAt(bi++, dummy.matrix);
        // Back
        dummy.position.set(p.position.x, cy, p.position.z - hd);
        dummy.scale.set(p.bounds.w, bh, bt);
        dummy.updateMatrix();
        plotBoundaryRef.current!.setMatrixAt(bi++, dummy.matrix);
        // Left
        dummy.position.set(p.position.x - hw, cy, p.position.z);
        dummy.scale.set(bt, bh, p.bounds.d);
        dummy.updateMatrix();
        plotBoundaryRef.current!.setMatrixAt(bi++, dummy.matrix);
        // Right
        dummy.position.set(p.position.x + hw, cy, p.position.z);
        dummy.scale.set(bt, bh, p.bounds.d);
        dummy.updateMatrix();
        plotBoundaryRef.current!.setMatrixAt(bi++, dummy.matrix);
      });
      plotBoundaryRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 6. Amenities (Market & Masjid) + Foundation Plinths ──
    if (amenityRef.current && amenityRoofRef.current && amenityPlinthRef.current) {
      let domeIdx = 0;
      let minaretIdx = 0;
      const plinthH = 0.4;

      TOWN.amenities.forEach((a, i) => {
        // Foundation Plinth Pad (solid base, no ground gaps / floating)
        dummy.position.set(a.position.x, plinthH / 2, a.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(a.bounds.w + 0.6, plinthH, a.bounds.d + 0.6);
        dummy.updateMatrix();
        amenityPlinthRef.current!.setMatrixAt(i, dummy.matrix);

        // Body
        const cy = plinthH + a.bounds.h / 2;
        dummy.position.set(a.position.x, cy, a.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(a.bounds.w, a.bounds.h, a.bounds.d);
        dummy.updateMatrix();
        amenityRef.current!.setMatrixAt(i, dummy.matrix);

        // Roof
        dummy.position.set(a.position.x, plinthH + a.bounds.h + 0.15, a.position.z);
        dummy.scale.set(a.bounds.w + 0.6, 0.3, a.bounds.d + 0.6);
        dummy.updateMatrix();
        amenityRoofRef.current!.setMatrixAt(i, dummy.matrix);

        if (a.type === 'masjid' && masjidDomeRef.current && masjidMinaretRef.current) {
          // Dome
          dummy.position.set(a.position.x, plinthH + a.bounds.h + 1.8, a.position.z);
          dummy.scale.set(2.2, 2.2, 2.2);
          dummy.updateMatrix();
          masjidDomeRef.current.setMatrixAt(domeIdx++, dummy.matrix);

          // 2 Minarets
          const margin = 3.0;
          const mx = a.position.x + a.bounds.w / 2 - margin;
          dummy.position.set(mx, plinthH + a.bounds.h + 4.0, a.position.z - a.bounds.d / 2 + margin);
          dummy.scale.set(0.7, 8.0, 0.7);
          dummy.updateMatrix();
          masjidMinaretRef.current.setMatrixAt(minaretIdx++, dummy.matrix);

          dummy.position.set(mx, plinthH + a.bounds.h + 4.0, a.position.z + a.bounds.d / 2 - margin);
          dummy.updateMatrix();
          masjidMinaretRef.current.setMatrixAt(minaretIdx++, dummy.matrix);
        }
      });

      amenityPlinthRef.current.instanceMatrix.needsUpdate = true;
      amenityRef.current.instanceMatrix.needsUpdate = true;
      amenityRoofRef.current.instanceMatrix.needsUpdate = true;
      if (masjidDomeRef.current) masjidDomeRef.current.instanceMatrix.needsUpdate = true;
      if (masjidMinaretRef.current) masjidMinaretRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 7. Civic Zone Blocks ──
    if (civicRef.current && civicRoofRef.current) {
      TOWN.civic.forEach((c, i) => {
        const plinthH = 0.5;

        if (c.type === 'park') {
          // Park = flat green slab
          dummy.position.set(c.position.x, 0.03, c.position.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(c.bounds.w, c.bounds.h, c.bounds.d);
          dummy.updateMatrix();
          civicRef.current!.setMatrixAt(i, dummy.matrix);

          // Flat green roof (same height)
          dummy.position.set(c.position.x, 0.04, c.position.z);
          dummy.scale.set(c.bounds.w, 0.01, c.bounds.d);
          dummy.updateMatrix();
          civicRoofRef.current!.setMatrixAt(i, dummy.matrix);
        } else {
          const cy = plinthH + c.bounds.h / 2;
          dummy.position.set(c.position.x, cy, c.position.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(c.bounds.w, c.bounds.h, c.bounds.d);
          dummy.updateMatrix();
          civicRef.current!.setMatrixAt(i, dummy.matrix);

          // Roof
          dummy.position.set(c.position.x, plinthH + c.bounds.h + 0.2, c.position.z);
          dummy.scale.set(c.bounds.w + 0.4, 0.4, c.bounds.d + 0.4);
          dummy.updateMatrix();
          civicRoofRef.current!.setMatrixAt(i, dummy.matrix);
        }
      });

      civicRef.current.instanceMatrix.needsUpdate = true;
      civicRoofRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── 8. Park Grass Overlay ──
    if (parkGrassRef.current) {
      const park = TOWN.civic.find((c) => c.type === 'park');
      if (park) {
        dummy.position.set(park.position.x, 0.04, park.position.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(park.bounds.w - 2, park.bounds.d - 2, 1);
        dummy.updateMatrix();
        parkGrassRef.current.setMatrixAt(0, dummy.matrix);
        parkGrassRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // ── 9. Streetlights ──
    if (lightPoleRef.current && lightBulbRef.current) {
      const poleH = 6.0;
      TOWN.lights.forEach((l, i) => {
        dummy.position.set(l.position.x, poleH / 2, l.position.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.16, poleH, 0.16);
        dummy.updateMatrix();
        lightPoleRef.current!.setMatrixAt(i, dummy.matrix);

        dummy.position.set(l.position.x, poleH + 0.2, l.position.z);
        dummy.scale.set(0.45, 0.35, 0.45);
        dummy.updateMatrix();
        lightBulbRef.current!.setMatrixAt(i, dummy.matrix);
      });
      lightPoleRef.current.instanceMatrix.needsUpdate = true;
      lightBulbRef.current.instanceMatrix.needsUpdate = true;
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

    // ── 11. Perimeter Wall + Gate (Tight Left Boundary Wrap with Off-Road Step Walls & Gate Passages) ──
    if (wallRef.current && gatePiersRef.current) {
      const half = GROUND_SIZE / 2; // 90
      const bvdHalf = BOULEVARD_WIDTH / 2; // 6
      let wi = 0;

      // 1. Right North Wall (x: +6 to 90 at z = -90, leaving x = -6 to +6 OPEN for North Gate)
      const rightNorthLen = half - bvdHalf; // 84
      dummy.position.set(bvdHalf + rightNorthLen / 2, WALL_HEIGHT / 2, -half);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(rightNorthLen, WALL_HEIGHT, WALL_THICK);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 2. East Wall (x = 90, z: -90 to 90)
      dummy.position.set(half, WALL_HEIGHT / 2, 0);
      dummy.scale.set(WALL_THICK, WALL_HEIGHT, GROUND_SIZE);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 3. Right South Wall (x: +7 to 90 at z = 90)
      const gateHalf = GATE_WIDTH / 2; // 7
      const rightSegLen = half - gateHalf; // 83
      dummy.position.set(gateHalf + rightSegLen / 2, WALL_HEIGHT / 2, half);
      dummy.scale.set(rightSegLen, WALL_HEIGHT, WALL_THICK);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 4. Shrunk Left North Wall (x: -93 to -6 at z = -62)
      const leftWidth = Math.abs(LEFT_BOUND_X) - bvdHalf; // 87
      dummy.position.set(-bvdHalf - leftWidth / 2, WALL_HEIGHT / 2, LEFT_BOUND_Z_NORTH);
      dummy.scale.set(leftWidth, WALL_HEIGHT, WALL_THICK);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 5. Shrunk Left South Wall (x: -93 to -6 at z = 62)
      dummy.position.set(-bvdHalf - leftWidth / 2, WALL_HEIGHT / 2, LEFT_BOUND_Z_SOUTH);
      dummy.scale.set(leftWidth, WALL_HEIGHT, WALL_THICK);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 6. Shrunk West Wall (x = -93, z: -62 to 62)
      const leftDepth = LEFT_BOUND_Z_SOUTH - LEFT_BOUND_Z_NORTH; // 124
      dummy.position.set(LEFT_BOUND_X, WALL_HEIGHT / 2, 0);
      dummy.scale.set(WALL_THICK, WALL_HEIGHT, leftDepth);
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 7. North Step Wall at x = -6 (connecting z: -90 to -62 along Boulevard curb, OFF ROAD)
      dummy.position.set(-bvdHalf, WALL_HEIGHT / 2, (-half + LEFT_BOUND_Z_NORTH) / 2);
      dummy.scale.set(WALL_THICK, WALL_HEIGHT, Math.abs(-half - LEFT_BOUND_Z_NORTH));
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      // 8. South Step Wall at x = -6 (connecting z: 62 to 90 along Boulevard curb, OFF ROAD)
      dummy.position.set(-bvdHalf, WALL_HEIGHT / 2, (half + LEFT_BOUND_Z_SOUTH) / 2);
      dummy.scale.set(WALL_THICK, WALL_HEIGHT, Math.abs(half - LEFT_BOUND_Z_SOUTH));
      dummy.updateMatrix();
      wallRef.current.setMatrixAt(wi++, dummy.matrix);

      wallRef.current.instanceMatrix.needsUpdate = true;

      // Gate piers (South Gate)
      const pierH = WALL_HEIGHT * 1.6;
      dummy.position.set(-gateHalf, pierH / 2, half);
      dummy.scale.set(1.4, pierH, 1.4);
      dummy.updateMatrix();
      gatePiersRef.current.setMatrixAt(0, dummy.matrix);

      dummy.position.set(gateHalf, pierH / 2, half);
      dummy.updateMatrix();
      gatePiersRef.current.setMatrixAt(1, dummy.matrix);

      gatePiersRef.current.instanceMatrix.needsUpdate = true;
    }



  }, [dummy, markingCount]);

  useEffect(() => {
    const frozenMeshes = [plotBoundaryRef.current, amenityRef.current, civicRef.current, roadsRef.current, wallRef.current, gatePiersRef.current];
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
    <>
      <color attach="background" args={[COLORS.fog]} />
      <fog attach="fog" args={[COLORS.fog, 100, 360]} />

      {/* Warm Golden Hour Lighting */}
      <ambientLight intensity={0.55} color="#FFE8D6" />
      <directionalLight
        position={[120, 180, -90]}
        intensity={1.4}
        color="#FFDDBE"
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
      <mesh position={[45, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <planeGeometry args={[90, 180]} />
        <meshStandardMaterial map={groundTex ?? undefined} color={groundTex ? undefined : COLORS.ground} roughness={0.95} />
      </mesh>
      {/* Left Side Ground (93m x 124m, x: -93..0, z: -62..62) */}
      <mesh position={[-46.5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <planeGeometry args={[93, 124]} />
        <meshStandardMaterial map={groundTex ?? undefined} color={groundTex ? undefined : COLORS.ground} roughness={0.95} />
      </mesh>

      {/* Luxury Linear Park Green Belt Base */}
      <instancedMesh ref={greenBeltRef} args={[undefined, undefined, greenBeltCount]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.gardenBase} roughness={0.8} />
      </instancedMesh>

      {/* Concrete Stone Borders around Green Belts */}
      <instancedMesh ref={concreteBorderRef} args={[undefined, undefined, borderCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.concreteBorder} roughness={0.7} />
      </instancedMesh>

      {/* Low-Poly Trees in Straight 8m Lines */}
      <instancedMesh ref={treeTrunkRef} args={[undefined, undefined, treeCount]} castShadow>
        <cylinderGeometry args={[0.2, 0.35, 1.8, 6]} />
        <meshStandardMaterial color={COLORS.wood} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={treeFoliageRef} args={[undefined, undefined, treeCount]} castShadow>
        <coneGeometry args={[1.5, 3.2, 6]} />
        <meshStandardMaterial color={COLORS.foliage} roughness={0.8} />
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
      <instancedMesh ref={roadsRef} args={[undefined, undefined, TOWN.streets.length]} receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.road} roughness={0.85} />
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
      <instancedMesh ref={plotGroundRef} args={[undefined, undefined, plotCount]} receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.plotGround} roughness={0.90} />
      </instancedMesh>

      {/* Plot Boundaries (4 edges per plot) */}
      <instancedMesh ref={plotBoundaryRef} args={[undefined, undefined, plotCount * 4]} castShadow receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.accent} roughness={0.68} vertexColors />
      </instancedMesh>

      {/* Amenity Foundation Plinth Bases (No floating / zero gaps) */}
      <instancedMesh ref={amenityPlinthRef} args={[undefined, undefined, amenityCount]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.buildingPlinth} roughness={0.85} />
      </instancedMesh>

      {/* Amenity Blocks (Market & Masjid) */}
      <instancedMesh ref={amenityRef} args={[undefined, undefined, amenityCount]} castShadow receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.market} roughness={0.75} />
      </instancedMesh>

      {/* Amenity Roofs */}
      <instancedMesh ref={amenityRoofRef} args={[undefined, undefined, amenityCount]} castShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicTrim} roughness={0.6} />
      </instancedMesh>

      {/* Gold Domes on Masjids */}
      <instancedMesh ref={masjidDomeRef} args={[undefined, undefined, masjidCount]} castShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <sphereGeometry args={[1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={COLORS.masjidDome} metalness={0.6} roughness={0.35} />
      </instancedMesh>


      {/* Minarets */}
      <instancedMesh ref={masjidMinaretRef} args={[undefined, undefined, masjidCount * 2]} castShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <cylinderGeometry args={[0.7, 0.9, 1, 12]} />
        <meshStandardMaterial color={COLORS.civicBody} roughness={0.7} />
      </instancedMesh>

      {/* Civic Zone Building Bodies */}
      <instancedMesh ref={civicRef} args={[undefined, undefined, civicCount]} castShadow receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicBody} roughness={0.75} />
      </instancedMesh>

      {/* Civic Zone Roofs */}
      <instancedMesh ref={civicRoofRef} args={[undefined, undefined, civicCount]} castShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.civicTrim} roughness={0.6} />
      </instancedMesh>

      {/* Park Grass Overlay */}
      <instancedMesh ref={parkGrassRef} args={[undefined, undefined, 1]} receiveShadow onPointerMove={handlePointerMove} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerLeave={clearHighlight}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={COLORS.parkGround} roughness={0.9} />
      </instancedMesh>

      {/* Streetlight Poles */}
      <instancedMesh ref={lightPoleRef} args={[undefined, undefined, lightCount]} castShadow>
        <cylinderGeometry args={[0.07, 0.14, 1, 12]} />
        <meshStandardMaterial color={COLORS.pole} roughness={0.4} metalness={0.3} />
      </instancedMesh>

      {/* Lamp Bulbs */}
      <instancedMesh ref={lightBulbRef} args={[undefined, undefined, lightCount]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={COLORS.lightBulb} emissive={COLORS.lightBulb} emissiveIntensity={0.6} />
      </instancedMesh>

      {/* Perimeter Wall (8 tight segments) */}
      <instancedMesh ref={wallRef} args={[undefined, undefined, 8]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.80} />
      </instancedMesh>

      {/* Gate Piers */}
      <instancedMesh ref={gatePiersRef} args={[undefined, undefined, 2]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.70} />
      </instancedMesh>

      {/* Gate Lintel Arch */}
      <mesh position={[0, WALL_HEIGHT * 1.6, GROUND_SIZE / 2]} castShadow>
        <boxGeometry args={[GATE_WIDTH + 2, 0.6, 0.8]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.70} />
      </mesh>


      {/* Orbit Controls */}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enabled={!walkModeEnabled}
        enablePan={!focusActive}
        target={[0, 0, 0]}
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
      <AmenityOutline target={hoveredAmenity} />

    </>
  );
}
