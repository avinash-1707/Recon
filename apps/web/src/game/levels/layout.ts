import * as THREE from "three";

/**
 * Town building grid - single source of truth shared by the level renderer,
 * pickups, and respawn. A 7x7 block grid with the central N-S and E-W avenues
 * cleared (the main streets + plaza), leaving four 3x3 residential blocks =
 * 36 buildings. Houses face the nearer avenue so the town reads as ordered
 * streets rather than scattered structures.
 */
export interface Plot {
  x: number;
  z: number;
  /** Yaw so the door faces the nearest main street. */
  yaw: number;
  /** 0 = 1-storey house, 1 = 2-storey house, 2 = warehouse. */
  kind: 0 | 1 | 2;
  alt: boolean;
}

const SPACING = 14; // metres between plot centres
const HALF = 3; // grid extends -HALF..HALF on each axis (7x7)

export const PLOTS: ReadonlyArray<Plot> = (() => {
  const out: Plot[] = [];
  let i = 0;
  for (let gx = -HALF; gx <= HALF; gx++) {
    for (let gz = -HALF; gz <= HALF; gz++) {
      // Clear the central cross: x=0 is the N-S avenue, z=0 the E-W avenue.
      if (gx === 0 || gz === 0) continue;
      const x = gx * SPACING;
      const z = gz * SPACING;
      // Face the nearer avenue (smaller absolute coordinate wins).
      let fx = 0;
      let fz = 0;
      if (Math.abs(x) < Math.abs(z)) fx = -Math.sign(x);
      else fz = -Math.sign(z);
      const yaw = Math.atan2(fx, fz);
      // A few warehouses on the outer ring; everything else is a house.
      const edge = Math.abs(gx) === HALF || Math.abs(gz) === HALF;
      const kind: 0 | 1 | 2 = edge && i % 4 === 0 ? 2 : ((i % 2) as 0 | 1);
      out.push({ x, z, yaw, kind, alt: (gx + gz) % 2 === 0 });
      i++;
    }
  }
  return out;
})();

/** Centres of the houses (not warehouses) - interior-safe spawn/pickup spots. */
export const HOUSE_POSITIONS: ReadonlyArray<THREE.Vector3> = PLOTS.filter((p) => p.kind !== 2).map(
  (p) => new THREE.Vector3(p.x, 0, p.z),
);
