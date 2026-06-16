import * as THREE from "three";

/**
 * Typed level data - spawn points and AI patrol routes for the town map.
 * Consumed by the player entity and the enemy spawner.
 */

export const PLAYER_SPAWN = new THREE.Vector3(0, 2, 22);

export interface PatrolRoute {
  id: string;
  /** Looping waypoints on the ground (y = 0). */
  waypoints: THREE.Vector3[];
}

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

/**
 * Patrol routes blanket the whole town - the perimeter ring, both main
 * avenues, the four residential blocks, and the side edges. Every waypoint is
 * kept well clear (>~20m) of the player spawn at (0, 22) so enemies never
 * appear on top of the player; the spawner also randomises each enemy's start
 * waypoint, so they disperse across the map every match.
 */
export const PATROL_ROUTES: ReadonlyArray<PatrolRoute> = [
  { id: "ring", waypoints: [v(-50, -50), v(50, -50), v(50, 50), v(-50, 50)] },
  { id: "ave-ew", waypoints: [v(-46, 0), v(-16, 0), v(16, 0), v(46, 0)] },
  { id: "ave-ns-south", waypoints: [v(0, -8), v(0, -30), v(0, -48)] },
  { id: "block-sw", waypoints: [v(-7, -7), v(-35, -7), v(-35, -35), v(-7, -35)] },
  { id: "block-se", waypoints: [v(7, -7), v(35, -7), v(35, -35), v(7, -35)] },
  { id: "block-ne", waypoints: [v(21, 14), v(42, 14), v(42, 42), v(21, 42)] },
  { id: "block-nw", waypoints: [v(-21, 14), v(-42, 14), v(-42, 42), v(-21, 42)] },
  { id: "edge-e", waypoints: [v(48, 30), v(48, -30)] },
  { id: "edge-w", waypoints: [v(-48, 30), v(-48, -30)] },
];

export interface EnemySpawn {
  id: string;
  routeId: string;
  startWaypoint: number;
}

/**
 * 20 enemies spread across the routes. `startWaypoint` is a sensible default;
 * the spawner randomises it at runtime so positions vary per match.
 */
const SPAWN_PLAN: ReadonlyArray<readonly [string, number]> = [
  ["ring", 3],
  ["ave-ew", 3],
  ["ave-ns-south", 2],
  ["block-sw", 3],
  ["block-se", 3],
  ["block-ne", 2],
  ["block-nw", 2],
  ["edge-e", 1],
  ["edge-w", 1],
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
