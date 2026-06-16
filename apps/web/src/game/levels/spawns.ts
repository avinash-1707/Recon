import * as THREE from "three";

/**
 * Typed level data — spawn points and AI patrol routes for the (enlarged) town.
 * Consumed by the player entity and the enemy spawner. Coordinates scale with
 * the ~2x town (±64 built area). Every waypoint is kept well clear (>~18m) of
 * the player spawn at (0, 22) so enemies never appear on top of the player.
 */

export const PLAYER_SPAWN = new THREE.Vector3(0, 2, 22);

export interface PatrolRoute {
  id: string;
  /** Looping waypoints on the ground (y = 0). */
  waypoints: THREE.Vector3[];
}

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export const PATROL_ROUTES: ReadonlyArray<PatrolRoute> = [
  { id: "ring", waypoints: [v(-60, -60), v(60, -60), v(60, 60), v(-60, 60)] },
  { id: "ave-ew", waypoints: [v(-56, 0), v(-20, 0), v(20, 0), v(56, 0)] },
  { id: "ave-ns-south", waypoints: [v(0, -8), v(0, -34), v(0, -58)] },
  { id: "block-sw", waypoints: [v(-8, -8), v(-56, -8), v(-56, -56), v(-8, -56)] },
  { id: "block-se", waypoints: [v(8, -8), v(56, -8), v(56, -56), v(8, -56)] },
  { id: "block-ne", waypoints: [v(24, 16), v(56, 16), v(56, 56), v(24, 56)] },
  { id: "block-nw", waypoints: [v(-24, 16), v(-56, 16), v(-56, 56), v(-24, 56)] },
  { id: "edge-e", waypoints: [v(60, 40), v(60, -40)] },
  { id: "edge-w", waypoints: [v(-60, 40), v(-60, -40)] },
  { id: "mid-ns-e", waypoints: [v(40, -52), v(40, 52)] },
  { id: "mid-ns-w", waypoints: [v(-40, -52), v(-40, 52)] },
];

export interface EnemySpawn {
  id: string;
  routeId: string;
  startWaypoint: number;
}

/**
 * 28 enemies spread across the routes (scaled up for the larger map).
 * `startWaypoint` is a sensible default; the spawner randomises it at runtime
 * so positions vary per match.
 */
const SPAWN_PLAN: ReadonlyArray<readonly [string, number]> = [
  ["ring", 4],
  ["ave-ew", 3],
  ["ave-ns-south", 2],
  ["block-sw", 4],
  ["block-se", 4],
  ["block-ne", 3],
  ["block-nw", 3],
  ["edge-e", 1],
  ["edge-w", 1],
  ["mid-ns-e", 2],
  ["mid-ns-w", 1],
];

export const ENEMY_SPAWNS: ReadonlyArray<EnemySpawn> = (() => {
  const out: EnemySpawn[] = [];
  let n = 0;
  for (const [routeId, count] of SPAWN_PLAN) {
    for (let k = 0; k < count; k++) {
      out.push({ id: `g${++n}`, routeId, startWaypoint: k });
    }
  }
  return out;
})();
