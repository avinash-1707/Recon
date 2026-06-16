import * as THREE from "three";
import { WeaponType } from "@/game/weapons/types";

/**
 * Procedurally-built first-person weapon models. Procedural (not GLB) on
 * purpose: the spec requires the slide/bolt and magazine to visibly animate, so
 * the models expose real movable parts the viewmodel drives. Each is a detailed
 * set of beveled primitives with two-tone PBR metal/polymer materials, iron
 * sights / optics, trigger guards, stocks, and a muzzle anchor for FX.
 */
export interface WeaponModel {
  group: THREE.Group;
  slide: THREE.Group; // slide / bolt / charging handle - travels back on fire
  mag: THREE.Group; // magazine - drops + swaps on reload
  muzzle: THREE.Object3D; // muzzle tip anchor (world pos for tracer/flash)
  /** Local position of the aiming optic/sight - used to center it on ADS. */
  sightOffset: THREE.Vector3;
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

  const metal = new THREE.MeshStandardMaterial({ color: 0x33373c, roughness: 0.38, metalness: 0.9 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.78, metalness: 0.12 });
  const fde = new THREE.MeshStandardMaterial({ color: 0x6b5d44, roughness: 0.7, metalness: 0.1 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x44494f, roughness: 0.5, metalness: 0.7 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x0c1a24, roughness: 0.08, metalness: 0.5, emissive: 0x0a2230, emissiveIntensity: 0.4 });
  // Bright polished steel for blades / bare metal.
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c1c9, roughness: 0.22, metalness: 0.96 });
  mats.push(metal, poly, fde, accent, lens, steel);

  const box = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0): THREE.Mesh => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);
    return m;
  };
  const cyl = (parent: THREE.Object3D, r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, axis: "x" | "y" | "z" = "z"): THREE.Mesh => {
    const g = new THREE.CylinderGeometry(r, r, len, 16);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    if (axis === "z") m.rotation.x = Math.PI / 2;
    else if (axis === "x") m.rotation.z = Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // simple trigger guard loop (front + bottom + rear bars)
  const triggerGuard = (cx: number, y: number, z: number): void => {
    box(group, 0.018, 0.05, 0.02, accent, cx, y - 0.02, z + 0.05);
    box(group, 0.018, 0.018, 0.12, accent, cx, y - 0.05, z);
    box(group, 0.018, 0.05, 0.02, accent, cx, y - 0.02, z - 0.05);
  };

  switch (type) {
    case WeaponType.Pistol: {
      // Frame: dust cover under the slide + grip angled back, mag well in grip.
      box(group, 0.046, 0.05, 0.2, poly, 0, -0.02, -0.03); // dust cover / lower frame
      box(group, 0.044, 0.026, 0.12, accent, 0, -0.046, -0.07); // underbarrel rail
      box(group, 0.056, 0.155, 0.082, poly, 0, -0.105, 0.06, -0.22); // grip (raked back)
      box(group, 0.05, 0.02, 0.086, accent, 0, -0.18, 0.066, -0.22); // grip floorplate
      triggerGuard(0, -0.018, 0.0);
      box(group, 0.01, 0.028, 0.012, accent, 0, -0.034, 0.002); // trigger
      box(group, 0.016, 0.026, 0.02, accent, 0, 0.052, 0.108, -0.55); // exposed hammer (rear)
      // Slide (upper, travels back on fire): body + flat top + serrations + sights.
      box(slide, 0.048, 0.05, 0.235, metal, 0, 0.05, -0.03); // slide body
      box(slide, 0.05, 0.018, 0.235, accent, 0, 0.076, -0.03); // top flat
      for (let i = 0; i < 6; i++) box(slide, 0.05, 0.04, 0.005, poly, 0, 0.05, 0.06 + i * 0.013); // rear serrations
      for (let i = 0; i < 4; i++) box(slide, 0.05, 0.04, 0.005, poly, 0, 0.05, -0.13 + i * 0.013); // front serrations
      box(slide, 0.03, 0.016, 0.012, metal, 0, 0.086, 0.1); // rear sight
      box(slide, 0.012, 0.018, 0.012, metal, 0, 0.087, -0.14); // front sight
      // Exposed barrel at the muzzle (fixed to the frame).
      cyl(group, 0.011, 0.05, steel, 0, 0.05, -0.165);
      // Magazine - drops + swaps on reload.
      box(mag, 0.042, 0.15, 0.07, poly, 0, -0.11, 0.06); // mag body
      box(mag, 0.05, 0.016, 0.078, accent, 0, -0.19, 0.06); // baseplate
      muzzle.position.set(0, 0.05, -0.19);
      break;
    }
    case WeaponType.AR: {
      box(group, 0.05, 0.07, 0.28, poly, 0, -0.01, 0.06); // lower receiver
      box(group, 0.055, 0.06, 0.4, metal, 0, 0.04, -0.04); // upper receiver
      box(group, 0.05, 0.06, 0.26, fde, 0, 0.01, -0.28); // handguard
      for (let i = 0; i < 4; i++) box(group, 0.052, 0.012, 0.02, poly, 0, 0.04, -0.2 - i * 0.05); // vents
      cyl(group, 0.013, 0.24, metal, 0, 0.04, -0.52); // barrel
      box(group, 0.03, 0.03, 0.05, accent, 0, 0.04, -0.64); // muzzle brake
      box(group, 0.06, 0.085, 0.16, poly, 0, 0.0, 0.26, 0.04); // stock
      box(group, 0.05, 0.045, 0.06, poly, 0, 0.06, 0.24); // cheek
      box(group, 0.05, 0.13, 0.07, poly, 0, -0.1, 0.08, -0.14); // pistol grip
      triggerGuard(0, -0.02, 0.04);
      box(group, 0.04, 0.022, 0.34, accent, 0, 0.082, -0.05); // top rail
      box(slide, 0.028, 0.03, 0.09, accent, 0.0, 0.075, 0.16); // charging handle
      box(group, 0.04, 0.05, 0.05, fde, 0, -0.07, -0.18, -0.5); // angled foregrip
      box(mag, 0.046, 0.2, 0.072, poly, 0, -0.16, -0.06, 0.3); // curved mag
      // red-dot sight: bottom-half frame, open glass, tiny dot
      const sightGlass = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.32 });
      const redMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
      mats.push(sightGlass, redMat);
      const sz = -0.04;
      box(group, 0.082, 0.012, 0.026, accent, 0, 0.105, sz);
      box(group, 0.012, 0.05, 0.026, accent, -0.035, 0.128, sz);
      box(group, 0.012, 0.05, 0.026, accent, 0.035, 0.128, sz);
      cyl(group, 0.034, 0.01, sightGlass, 0, 0.14, sz);
      const dotGeo = new THREE.SphereGeometry(0.0006, 8, 8);
      geos.push(dotGeo);
      const dot = new THREE.Mesh(dotGeo, redMat);
      dot.position.set(0, 0.14, sz - 0.006);
      group.add(dot);
      muzzle.position.set(0, 0.04, -0.66);
      break;
    }
    case WeaponType.Sniper: {
      box(group, 0.06, 0.08, 0.5, poly, 0, 0, 0.05); // receiver
      cyl(group, 0.014, 0.46, metal, 0, 0.01, -0.5); // long barrel
      cyl(group, 0.024, 0.08, accent, 0, 0.01, -0.74); // muzzle brake
      box(group, 0.062, 0.11, 0.22, poly, 0, -0.03, 0.34); // stock
      box(group, 0.058, 0.05, 0.1, poly, 0, 0.05, 0.3); // cheek riser
      box(group, 0.07, 0.04, 0.06, poly, 0, -0.1, 0.46); // buttpad
      box(group, 0.05, 0.13, 0.07, poly, 0, -0.1, 0.12, -0.1); // pistol grip
      triggerGuard(0, -0.02, 0.08);
      // scope: tube + lenses + mounts + turret
      cyl(group, 0.036, 0.26, metal, 0, 0.095, -0.04);
      box(group, 0.018, 0.06, 0.02, accent, 0, 0.05, -0.16); // mount front
      box(group, 0.018, 0.06, 0.02, accent, 0, 0.05, 0.08); // mount rear
      cyl(group, 0.034, 0.012, lens, 0, 0.095, -0.175); // front lens
      cyl(group, 0.03, 0.012, lens, 0, 0.095, 0.095); // rear lens
      cyl(group, 0.016, 0.04, accent, 0, 0.135, -0.04, "y"); // elevation turret
      // bipod legs (folded down) near front
      cyl(group, 0.008, 0.22, accent, -0.05, -0.1, -0.42, "y");
      cyl(group, 0.008, 0.22, accent, 0.05, -0.1, -0.42, "y");
      box(slide, 0.025, 0.025, 0.1, accent, 0.058, 0.02, 0.12); // bolt handle
      box(mag, 0.05, 0.11, 0.09, poly, 0, -0.11, 0.02); // mag
      muzzle.position.set(0, 0.01, -0.78);
      break;
    }
    case WeaponType.Knife: {
      // Handle - dark grip with finger ridges + pommel.
      box(group, 0.024, 0.032, 0.115, poly, 0, -0.022, 0.08); // handle body
      for (let i = 0; i < 4; i++) box(group, 0.026, 0.005, 0.013, accent, 0, -0.04, 0.05 + i * 0.02); // grip ridges
      box(group, 0.026, 0.026, 0.018, accent, 0, -0.022, 0.14); // pommel
      // Guard / bolster.
      box(group, 0.062, 0.03, 0.016, accent, 0, -0.012, 0.018); // crossguard
      box(group, 0.03, 0.03, 0.026, steel, 0, -0.012, -0.002); // bolster
      // Blade - extruded clip-point profile for a clean tapered silhouette.
      const bt = 0.006;
      const blade = new THREE.Shape();
      blade.moveTo(0, -0.02); // edge at the guard
      blade.lineTo(0.115, -0.022); // straight edge / belly
      blade.lineTo(0.175, -0.004); // point
      blade.lineTo(0.1, 0.022); // clip - spine angles down to the tip
      blade.lineTo(0, 0.022); // spine at the guard
      blade.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(blade, {
        depth: bt,
        bevelEnabled: true,
        bevelThickness: 0.0012,
        bevelSize: 0.0012,
        bevelSegments: 1,
      });
      bladeGeo.translate(0, 0, -bt / 2); // centre thickness on X
      geos.push(bladeGeo);
      const bladeMesh = new THREE.Mesh(bladeGeo, steel);
      // local X(length) → world -Z (forward); local Y(height) → world Y.
      bladeMesh.rotation.y = Math.PI / 2;
      bladeMesh.position.set(0, -0.018, -0.01);
      group.add(bladeMesh);
      muzzle.position.set(0, -0.01, -0.2);
      break;
    }
  }

  const sightOffset =
    type === WeaponType.AR
      ? new THREE.Vector3(0, 0.14, -0.04)
      : type === WeaponType.Sniper
        ? new THREE.Vector3(0, 0.095, 0.095)
        : new THREE.Vector3(0, 0.086, 0.05);

  return {
    group,
    slide,
    mag,
    muzzle,
    sightOffset,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
