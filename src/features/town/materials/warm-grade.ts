// ═══════════════════════════════════════════════════════════════════
// warm-grade.ts — colour-grade imported GLB materials so the user's
// realistic buildings sit inside the golden-hour, bone/clay town:
//   • −10% saturation
//   • warm-white balance toward #EDE6D8
//   • roughness floor 0.6, no mirror metal (metalness ≤ 0.1)
//   • no transmission (it forces an extra full-scene render pass) and
//     single-pass transparency (no second draw for double-sided glass)
// Runs once per cached GLB: <Clone> instances share these materials.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { COLORS } from '@/src/shared/theme/tokens';

const WARM_GRADE = {
  tint: COLORS.boneWarm,
  saturation: 0.9,
  roughnessFloor: 0.6,
  metalnessCeiling: 0.1,
} as const;

const balance = (() => {
  const tint = new THREE.Color(WARM_GRADE.tint);
  const max = Math.max(tint.r, tint.g, tint.b);
  return new THREE.Color(tint.r / max, tint.g / max, tint.b / max);
})();

const hsl = { h: 0, s: 0, l: 0 };

function gradeColor(color: THREE.Color) {
  color.getHSL(hsl);
  color.setHSL(hsl.h, hsl.s * WARM_GRADE.saturation, hsl.l);
  color.multiply(balance);
}

function gradeMaterial(material: THREE.Material) {
  if (material.userData.warmGraded) return;
  material.userData.warmGraded = true;
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  gradeColor(material.color);
  if (material.emissive.getHex() !== 0) gradeColor(material.emissive);
  material.roughness = Math.max(material.roughness, WARM_GRADE.roughnessFloor);
  material.metalness = Math.min(material.metalness, WARM_GRADE.metalnessCeiling);
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) {
    // Glass: keep it readable as glass without a transmission pass.
    material.transmission = 0;
    material.transparent = true;
    material.opacity = Math.min(material.opacity, 0.55);
    material.depthWrite = false;
  }
  // Double-sided transparent materials otherwise render in two passes.
  if (material.transparent) material.forceSinglePass = true;
  material.needsUpdate = true;
}

/** Grade every material under `root` (idempotent). */
export function warmGrade(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(gradeMaterial);
  });
}
