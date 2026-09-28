'use client';

// DebugBridge — exposes `window.__propverseTown` for QA scripts (camera
// poses, renderer stats, placement audit, hover timing). See debug.ts.

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { OrbitControlsImpl } from '../controls/types';
import { useTownStore } from '../store/town-store';
import { auditPlacements } from '../data/unit-placement';
import { isTownDebug } from './debug';
import { getLastRenderStats } from './PerformanceSystem';

export default function DebugBridge() {
  const { camera, gl, invalidate, scene, raycaster, pointer, setDpr } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;

  useEffect(() => {
    if (!isTownDebug()) return;
    const bridge = {
      camera,
      gl,
      scene,
      controls,
      invalidate,
      store: useTownStore,
      stats: getLastRenderStats,
      /** Placement audit: every unit inside its footprint, clear of roads, facing its street. */
      audit: auditPlacements,
      setDpr,
      setView(position: [number, number, number], target: [number, number, number]) {
        camera.position.set(...position);
        if (controls) {
          controls.target.set(...target);
          controls.update();
        } else {
          camera.lookAt(new THREE.Vector3(...target));
        }
        gl.shadowMap.needsUpdate = true;
        invalidate();
      },
      /** Average ms for a raycast against every interactive unit target. */
      measureHover(samples = 200) {
        const targets: THREE.Object3D[] = [];
        scene.traverse((o) => { if (o.userData.boxes) targets.push(o); });
        const t0 = performance.now();
        for (let i = 0; i < samples; i += 1) {
          pointer.set(Math.random() * 2 - 1, Math.random() * 2 - 1);
          raycaster.setFromCamera(pointer, camera);
          raycaster.intersectObjects(targets, false);
        }
        return (performance.now() - t0) / samples;
      },
    };
    (window as unknown as { __propverseTown?: typeof bridge }).__propverseTown = bridge;
    return () => {
      delete (window as unknown as { __propverseTown?: typeof bridge }).__propverseTown;
    };
  }, [camera, controls, gl, invalidate, pointer, raycaster, scene, setDpr]);

  return null;
}
