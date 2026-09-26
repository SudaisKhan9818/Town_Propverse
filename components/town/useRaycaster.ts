'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { getTownData } from './layout-engine';
import type { Selection } from './useSelection';

const TOWN = getTownData();
const BASE_PLOT_COLOUR = new THREE.Color('#B85C37');
const HOVER_PLOT_COLOUR = new THREE.Color('#C0562F');

const sameSelection = (a: Selection | null, b: Selection | null) =>
  a?.type === b?.type && a?.index === b?.index;

interface Props {
  plotBoundaryRef: RefObject<THREE.InstancedMesh | null>;
  plotGroundRef: RefObject<THREE.InstancedMesh | null>;
  amenityRef: RefObject<THREE.InstancedMesh | null>;
  civicRef: RefObject<THREE.InstancedMesh | null>;
  amenityRoofRef: RefObject<THREE.InstancedMesh | null>;
  masjidDomeRef: RefObject<THREE.InstancedMesh | null>;
  masjidMinaretRef: RefObject<THREE.InstancedMesh | null>;
  civicRoofRef: RefObject<THREE.InstancedMesh | null>;
  parkGrassRef: RefObject<THREE.InstancedMesh | null>;
  resetKey?: number;
  onSelectionChange?: (selection: Selection | null, center: { x: number; z: number } | null) => void;
  onFocusRequest?: (center: { x: number; z: number }) => void;
}

function eventToPointer(event: ThreeEvent<PointerEvent | MouseEvent>, element: HTMLElement, target: THREE.Vector2) {
  const rect = element.getBoundingClientRect();
  target.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

export function useRaycaster({ plotBoundaryRef, plotGroundRef, amenityRef, civicRef, amenityRoofRef, masjidDomeRef, masjidMinaretRef, civicRoofRef, parkGrassRef, resetKey = 0, onSelectionChange, onFocusRequest }: Props) {
  const { camera, gl, invalidate } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const collidableRefs = useMemo(() => [plotBoundaryRef, plotGroundRef, amenityRef, amenityRoofRef, masjidDomeRef, masjidMinaretRef, civicRef, civicRoofRef, parkGrassRef], [amenityRef, amenityRoofRef, civicRef, civicRoofRef, masjidDomeRef, masjidMinaretRef, parkGrassRef, plotBoundaryRef, plotGroundRef]);
  const [hovered, setHovered] = useState<Selection | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const previousPlot = useRef<number | null>(null);

  const clearAllPlotColours = useCallback(() => {
    const mesh = plotBoundaryRef.current;
    if (!mesh) return;
    for (let i = 0; i < TOWN.plots.length * 4; i += 1) mesh.setColorAt(i, BASE_PLOT_COLOUR);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plotBoundaryRef]);

  const setPlotColour = useCallback((plotIndex: number, colour: THREE.Color) => {
    const mesh = plotBoundaryRef.current;
    if (!mesh) return;
    for (let edge = 0; edge < 4; edge += 1) mesh.setColorAt(plotIndex * 4 + edge, colour);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [invalidate, plotBoundaryRef]);

  const clearHighlight = useCallback(() => {
    clearAllPlotColours();
    previousPlot.current = null;
    setHovered(null);
    document.body.style.cursor = 'auto';
    invalidate();
  }, [clearAllPlotColours, invalidate]);

  const getCenter = useCallback((selection: Selection) => {
    if (selection.type === 'plot') {
      const plot = TOWN.plots[selection.index];
      return plot ? plot.position : null;
    }
    if (selection.index < TOWN.amenities.length) return TOWN.amenities[selection.index]?.position ?? null;
    return TOWN.civic[selection.index - TOWN.amenities.length]?.position ?? null;
  }, []);

  const resolve = useCallback((event: ThreeEvent<PointerEvent | MouseEvent>): Selection | null => {
    eventToPointer(event, gl.domElement, pointer);
    raycaster.setFromCamera(pointer, camera);
    const targets = collidableRefs.map((ref) => ref.current)
      .filter((mesh): mesh is THREE.InstancedMesh => mesh !== null);
    const hits = raycaster.intersectObjects(targets, false);
    const priority = (object: THREE.Object3D) => object === plotBoundaryRef.current || object === plotGroundRef.current ? 4 : 3;
    hits.sort((a, b) => Math.abs(a.distance - b.distance) < 0.01
      ? priority(b.object) - priority(a.object)
      : a.distance - b.distance);
    const hit = hits[0];
    if (!hit || hit.instanceId === undefined) return null;

    if (hit.object === plotBoundaryRef.current) return { type: 'plot', index: Math.floor(hit.instanceId / 4) };
    if (hit.object === plotGroundRef.current) return { type: 'plot', index: hit.instanceId };
    if (hit.object === amenityRef.current || hit.object === amenityRoofRef.current) return { type: 'amenity', index: hit.instanceId };
    if (hit.object === masjidDomeRef.current) {
      const masjidIndices = TOWN.amenities.map((a, index) => a.type === 'masjid' ? index : -1).filter((index) => index >= 0);
      return { type: 'amenity', index: masjidIndices[hit.instanceId] ?? 0 };
    }
    if (hit.object === masjidMinaretRef.current) {
      const masjidIndices = TOWN.amenities.map((a, index) => a.type === 'masjid' ? index : -1).filter((index) => index >= 0);
      return { type: 'amenity', index: masjidIndices[Math.floor(hit.instanceId / 2)] ?? 0 };
    }
    if (hit.object === civicRef.current || hit.object === civicRoofRef.current) return { type: 'amenity', index: TOWN.amenities.length + hit.instanceId };
    return { type: 'amenity', index: TOWN.amenities.length };
  }, [amenityRef, amenityRoofRef, camera, civicRef, civicRoofRef, collidableRefs, gl.domElement, masjidDomeRef, masjidMinaretRef, parkGrassRef, plotBoundaryRef, plotGroundRef, pointer, raycaster]);

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    const next = resolve(event);
    if (sameSelection(next, hovered)) {
      document.body.style.cursor = next ? 'pointer' : 'auto';
      return;
    }
    clearAllPlotColours();
    if (next?.type === 'plot') {
      setPlotColour(next.index, HOVER_PLOT_COLOUR);
      previousPlot.current = next.index;
      document.body.style.cursor = 'pointer';
    } else if (next?.type === 'amenity') {
      previousPlot.current = null;
      document.body.style.cursor = 'pointer';
    } else {
      clearHighlight();
    }
    setHovered(next);
  }, [clearAllPlotColours, clearHighlight, hovered, resolve, setPlotColour]);

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    // A double-click emits two click events. Let handleDoubleClick own that
    // gesture so the second click cannot immediately clear focus mode.
    if (event.detail > 1) return;
    const next = resolve(event);
    if (next) {
      setSelected(next);
      onSelectionChange?.(next, getCenter(next));
    } else {
      setSelected(null);
      onSelectionChange?.(null, null);
      clearHighlight();
    }
  }, [clearHighlight, getCenter, onSelectionChange, resolve]);

  const handleDoubleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    const next = resolve(event);
    const center = next ? getCenter(next) : { x: event.point.x, z: event.point.z };
    if (center) onFocusRequest?.(center);
  }, [getCenter, onFocusRequest, resolve]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    onSelectionChange?.(null, null);
    clearHighlight();
  }, [clearHighlight, onSelectionChange]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, resetKey]);

  return { hovered, selected, handlePointerMove, handleClick, handleDoubleClick, clearSelection, clearHighlight };
}
