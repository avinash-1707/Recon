import * as THREE from "three";

/**
 * Town building grid — single source of truth shared by the level renderer,
 * pickups, respawn, terrain (roads/grass), and the minimap. A 9x9 block grid
 * (SPACING * HALF extent) with the central N-S and E-W avenues cleared (main
 * streets + plaza), leaving four residential blocks. Roughly double the
 * original town. Houses face the nearer avenue so the town reads as ordered
 * streets rather than scattered structures.
 */
export interface Plot {
  x: number;
  z: number;
  /** Yaw so the door faces the nearest main street. */
  yaw: number;
  /**
   * Building archetype:
   *   0 = 1-storey house, 1 = 2-storey house, 2 = warehouse.
   *   3, 4 = richer archetypes (squad house / open-roof tower) — added in a
   *   later phase; the renderer falls back gracefully until then.
   */
  kind: 0 | 1 | 2 | 3 | 4;
  /** Deterministic 0..3 seed for per-building visual variation. */
  variant: 0 | 1 | 2 | 3;
  alt: boolean;
}

export const SPACING = 18; // metres between plot centres (room for big archetypes; was 14)
export const HALF = 4; // grid extends -HALF..HALF on each axis (9x9, was 3/7x7)
/** Half-width of the built area (outermost plot centre). */
export const TOWN_HALF = HALF * SPACING; // 64 (was 42)

/** Deterministic hash → 0..1 from grid coords (stable map every load). */
function hash(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const PLOTS: ReadonlyArray<Plot> = (() => {
  const out: Plot[] = [];
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

      const h = hash(gx, gz);
      const edge = Math.abs(gx) === HALF || Math.abs(gz) === HALF;
      // Big archetypes (squad house / tower) stay OFF the outer ring so their
      // rear stairs / footprints can't clip the perimeter wall. The ring is
      // warehouses + plain houses; inner blocks carry the variety.
      let kind: Plot["kind"];
      if (edge) {
        kind = h < 0.45 ? 2 : h < 0.72 ? 1 : 0;
      } else if (h < 0.1) {
        kind = 4; // open-roof tower (overwatch) — rare
      } else if (h < 0.27) {
        kind = 3; // PUBG squad house
      } else if (h < 0.52) {
        kind = 1; // 2-storey house
      } else {
        kind = 0; // 1-storey house
      }

      const variant = (Math.floor(hash(gz, gx) * 4) % 4) as 0 | 1 | 2 | 3;
      out.push({ x, z, yaw, kind, variant, alt: (gx + gz) % 2 === 0 });
    }
  }
  return out;
})();

/** Centres of the houses (not warehouses) — interior-safe spawn/pickup spots. */
export const HOUSE_POSITIONS: ReadonlyArray<THREE.Vector3> = PLOTS.filter((p) => p.kind !== 2).map(
  (p) => new THREE.Vector3(p.x, 0, p.z),
);
