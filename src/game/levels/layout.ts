import * as THREE from "three";

/**
 * Town building grid — single source of truth shared by the level renderer,
 * pickups, and respawn. 5×5 grid minus the central plus (plaza + street stubs).
 */
export interface Plot {
  x: number;
  z: number;
  /** Yaw so the door faces the town centre. */
  yaw: number;
  /** 0 = 1-storey house, 1 = 2-storey house, 2 = warehouse. */
  kind: 0 | 1 | 2;
  alt: boolean;
}

const COORD = [-44, -22, 0, 22, 44];
const SKIP = new Set(["0,0", "0,22", "0,-22", "22,0", "-22,0"]);

export const PLOTS: ReadonlyArray<Plot> = (() => {
  const out: Plot[] = [];
  let i = 0;
  for (const x of COORD) {
    for (const z of COORD) {
      if (SKIP.has(`${x},${z}`)) continue;
      out.push({ x, z, yaw: Math.atan2(-x, -z), kind: (i % 3) as 0 | 1 | 2, alt: i % 2 === 0 });
      i++;
    }
  }
  return out;
})();

/** Centres of the houses (not warehouses) — interior-safe spawn/pickup spots. */
export const HOUSE_POSITIONS: ReadonlyArray<THREE.Vector3> = PLOTS.filter((p) => p.kind !== 2).map(
  (p) => new THREE.Vector3(p.x, 0, p.z),
);
