import * as THREE from "three";
import { makeBloodTexture } from "@/game/utils/proceduralTextures";

/**
 * Ground blood decals, dropped where an enemy dies. A single shared texture +
 * material + geometry back every stain (one draw setup); each stain is a
 * flat circle with random scale/rotation. Call disposeDecals() on teardown.
 */
let mat: THREE.MeshBasicMaterial | null = null;
let geo: THREE.CircleGeometry | null = null;

function ensure(): void {
  if (mat) return;
  mat = new THREE.MeshBasicMaterial({
    map: makeBloodTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  geo = new THREE.CircleGeometry(0.9, 24);
}

/** Spawns a stain on the ground at (x,z) and returns it for later removal. */
export function spawnBloodStain(scene: THREE.Scene, x: number, z: number): THREE.Object3D {
  ensure();
  const m = new THREE.Mesh(geo!, mat!);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.random() * Math.PI * 2;
  m.position.set(x, 0.02, z);
  m.scale.setScalar(0.8 + Math.random() * 0.6);
  m.renderOrder = 1;
  scene.add(m);
  return m;
}

export function disposeDecals(): void {
  mat?.map?.dispose();
  mat?.dispose();
  geo?.dispose();
  mat = null;
  geo = null;
}
