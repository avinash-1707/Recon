import * as THREE from "three";
import { WeaponType } from "@/game/weapons/types";

/**
 * Procedurally-built first-person weapon models. No GLB needed — each is a
 * small set of beveled-ish primitives with PBR metal/polymer materials, plus
 * named animatable parts (slide/bolt, magazine) and a muzzle anchor for FX.
 * Animations are driven by transform tweens in the viewmodel (FSM-fed).
 */
export interface WeaponModel {
  group: THREE.Group;
  /** Slide / bolt — travels back on fire. */
  slide: THREE.Group;
  /** Magazine — drops out + swaps during reload. */
  mag: THREE.Group;
  /** Muzzle tip (empty) — world position via getWorldPosition for tracers/flash. */
  muzzle: THREE.Object3D;
  dispose(): void;
}

export function buildWeapon(type: WeaponType): WeaponModel {
  const group = new THREE.Group();
  const slide = new THREE.Group();
  const mag = new THREE.Group();
  const muzzle = new THREE.Object3D();
  group.add(slide, mag, muzzle);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.4, metalness: 0.85 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x161819, roughness: 0.75, metalness: 0.15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3d4147, roughness: 0.5, metalness: 0.6 });
  mats.push(metal, poly, accent);

  const box = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
  ): THREE.Mesh => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);
    return m;
  };
  const cyl = (
    parent: THREE.Object3D,
    r: number,
    len: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): void => {
    const g = new THREE.CylinderGeometry(r, r, len, 14);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = Math.PI / 2; // align along Z
    m.position.set(x, y, z);
    parent.add(m);
  };

  // forward is -Z
  switch (type) {
    case WeaponType.Pistol:
      box(group, 0.06, 0.16, 0.1, poly, 0, -0.085, 0.04, -0.18); // grip
      box(group, 0.05, 0.07, 0.22, metal, 0, 0, -0.04, 0); // frame
      box(group, 0.012, 0.02, 0.02, metal, 0, 0.085, -0.14, 0); // front sight
      box(slide, 0.056, 0.05, 0.24, accent, 0, 0.055, -0.04, 0);
      box(mag, 0.045, 0.13, 0.075, poly, 0, -0.11, 0.04, 0);
      muzzle.position.set(0, 0.055, -0.18);
      break;

    case WeaponType.AR: {
      box(group, 0.055, 0.08, 0.4, poly, 0, 0, 0, 0); // receiver
      box(group, 0.05, 0.055, 0.26, accent, 0, -0.005, -0.26, 0); // handguard
      cyl(group, 0.014, 0.22, metal, 0, 0.005, -0.5); // barrel
      box(group, 0.05, 0.075, 0.15, poly, 0, -0.01, 0.24, 0); // stock
      box(group, 0.05, 0.13, 0.08, poly, 0, -0.1, 0.06, -0.12); // grip
      box(group, 0.04, 0.02, 0.34, metal, 0, 0.05, -0.05, 0); // top rail
      box(slide, 0.03, 0.03, 0.1, accent, 0, 0.055, 0.12, 0); // charging handle
      box(mag, 0.045, 0.17, 0.07, poly, 0, -0.13, -0.1, 0.25); // mag

      // minimal red-dot sight: bottom-half frame, open glass, red dot
      const sightGlass = new THREE.MeshStandardMaterial({
        color: 0x0a1418,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
      });
      const redMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
      mats.push(sightGlass, redMat);
      const sz = -0.05;
      box(group, 0.082, 0.012, 0.026, accent, 0, 0.06, sz, 0); // bottom bar
      box(group, 0.012, 0.05, 0.026, accent, -0.035, 0.083, sz, 0); // left post
      box(group, 0.012, 0.05, 0.026, accent, 0.035, 0.083, sz, 0); // right post
      cyl(group, 0.034, 0.01, sightGlass, 0, 0.095, sz); // glass lens (open top)
      const dotGeo = new THREE.SphereGeometry(0.0022, 8, 8);
      geos.push(dotGeo);
      const dot = new THREE.Mesh(dotGeo, redMat);
      dot.position.set(0, 0.095, sz - 0.006);
      group.add(dot);

      muzzle.position.set(0, 0.005, -0.62);
      break;
    }

    case WeaponType.Sniper:
      box(group, 0.06, 0.075, 0.52, poly, 0, 0, 0.02, 0); // receiver
      cyl(group, 0.013, 0.4, metal, 0, 0.004, -0.5); // long barrel
      box(group, 0.06, 0.1, 0.2, poly, 0, -0.02, 0.3, 0); // stock
      box(group, 0.05, 0.12, 0.08, poly, 0, -0.1, 0.08, -0.1); // grip
      cyl(group, 0.032, 0.2, metal, 0, 0.075, -0.06); // scope tube
      box(group, 0.02, 0.05, 0.02, accent, 0, 0.05, -0.16, 0); // scope mount front
      box(group, 0.02, 0.05, 0.02, accent, 0, 0.05, 0.04, 0); // scope mount rear
      box(slide, 0.025, 0.025, 0.09, accent, 0.05, 0.02, 0.1, 0); // bolt
      box(mag, 0.05, 0.1, 0.09, poly, 0, -0.1, 0, 0); // mag
      muzzle.position.set(0, 0.004, -0.72);
      break;
  }

  return {
    group,
    slide,
    mag,
    muzzle,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
