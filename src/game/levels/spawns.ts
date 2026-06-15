import * as THREE from "three";

/**
 * Typed level data — single source of truth for spawn points and AI patrol
 * routes. Consumed by the player entity and (Step 7) the enemy spawner, so
 * adding/retuning encounters is data, not code.
 */

export const PLAYER_SPAWN = new THREE.Vector3(0, 2, 12);

export interface PatrolRoute {
  id: string;
  /** Looping waypoints on the ground (y = 0). */
  waypoints: THREE.Vector3[];
}

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export const PATROL_ROUTES: ReadonlyArray<PatrolRoute> = [
  {
    id: "central",
    waypoints: [v(-3, -2), v(4, -2), v(6, 3), v(-2, 4), v(-5, 0)],
  },
  {
    id: "east",
    waypoints: [v(8, -4), v(13, -3), v(13, 3), v(8, 2)],
  },
  {
    id: "west",
    waypoints: [v(-8, 1), v(-12, 3), v(-10, 9), v(-6, 6)],
  },
];

export interface EnemySpawn {
  id: string;
  routeId: string;
  /** Index into the route's waypoints to start from. */
  startWaypoint: number;
}

export const ENEMY_SPAWNS: ReadonlyArray<EnemySpawn> = [
  { id: "guard-1", routeId: "central", startWaypoint: 0 },
  { id: "guard-2", routeId: "east", startWaypoint: 0 },
  { id: "guard-3", routeId: "west", startWaypoint: 0 },
];
