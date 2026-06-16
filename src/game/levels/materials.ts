import * as THREE from "three";

/**
 * Shared PBR materials for the level. Reused across many meshes to keep GPU
 * state changes / material count low. They live for the session (single level),
 * and are disposed together via `disposeLevelMaterials()` on level unmount.
 */
export const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: "#6c7177", roughness: 0.92, metalness: 0.04 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: "#4a4f54", roughness: 0.95, metalness: 0.04 }),
  plinth: new THREE.MeshStandardMaterial({ color: "#3c4045", roughness: 0.9, metalness: 0.05 }),
  trim: new THREE.MeshStandardMaterial({ color: "#23262a", roughness: 0.55, metalness: 0.5 }),
  accent: new THREE.MeshStandardMaterial({ color: "#c75b3a", roughness: 0.65, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({
    color: "#13242e",
    roughness: 0.12,
    metalness: 0.35,
    transparent: true,
    opacity: 0.6,
    emissive: "#0a1c26",
    emissiveIntensity: 0.35,
  }),
  roof: new THREE.MeshStandardMaterial({ color: "#34383d", roughness: 0.88, metalness: 0.08 }),
  crate: new THREE.MeshStandardMaterial({ color: "#8a5a2b", roughness: 0.85, metalness: 0.05 }),
  barrel: new THREE.MeshStandardMaterial({ color: "#3f6e4a", roughness: 0.5, metalness: 0.45 }),
  barrier: new THREE.MeshStandardMaterial({ color: "#9a9690", roughness: 0.9, metalness: 0.03 }),
  ductMetal: new THREE.MeshStandardMaterial({ color: "#6a6f74", roughness: 0.45, metalness: 0.6 }),
  // house materials
  plaster: new THREE.MeshStandardMaterial({ color: "#c7bfa6", roughness: 0.95, metalness: 0.0 }),
  plasterAlt: new THREE.MeshStandardMaterial({ color: "#b08d6a", roughness: 0.95, metalness: 0.0 }),
  roofShingle: new THREE.MeshStandardMaterial({ color: "#5a2f28", roughness: 0.85, metalness: 0.05 }),
  woodTrim: new THREE.MeshStandardMaterial({ color: "#e6dfce", roughness: 0.7, metalness: 0.0 }),
  doorWood: new THREE.MeshStandardMaterial({ color: "#5a3b22", roughness: 0.7, metalness: 0.05 }),
  stoneBase: new THREE.MeshStandardMaterial({ color: "#5b554c", roughness: 0.95, metalness: 0.02 }),
  chimney: new THREE.MeshStandardMaterial({ color: "#7a4a3a", roughness: 0.9, metalness: 0.03 }),
} as const;

export function disposeLevelMaterials(): void {
  for (const m of Object.values(MAT)) m.dispose();
}
