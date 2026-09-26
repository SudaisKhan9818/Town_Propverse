'use client';
import { useState, useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';

export interface Selection {
  type: 'plot' | 'amenity';
  index: number;
}

interface Handlers {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * Selection state for the town scene.
 *
 * RAYCASTING NOTE: we deliberately do NOT run a manual THREE.Raycaster here.
 * Fiber's built-in pointer events already raycast on pointer move / click only
 * (never per-frame idle) and fire on <instancedMesh> with the correct
 * instanceId. That gives us event-driven selection for free while keeping
 * the render loop at 'always' with zero per-frame ray cost.
 */
export function useSelection() {
  const [hovered, setHovered] = useState<Selection | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);

  const over = useCallback((e: ThreeEvent<PointerEvent>, type: Selection['type']) => {
    e.stopPropagation();
    const idx = e.instanceId ?? -1;
    if (idx >= 0) {
      setHovered({ type, index: idx });
      document.body.style.cursor = 'pointer';
    }
  }, []);

  const out = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(null);
    document.body.style.cursor = 'auto';
  }, []);

  const click = useCallback((e: ThreeEvent<MouseEvent>, type: Selection['type']) => {
    e.stopPropagation();
    const idx = e.instanceId ?? -1;
    if (idx >= 0) setSelected({ type, index: idx });
  }, []);

  const clearSelection = useCallback(() => setSelected(null), []);

  const forType = useCallback(
    (type: Selection['type']): Handlers => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => over(e, type),
      onPointerOut: out,
      onClick: (e: ThreeEvent<MouseEvent>) => click(e, type),
    }),
    [over, out, click],
  );

  return { hovered, selected, forType, clearSelection };
}
