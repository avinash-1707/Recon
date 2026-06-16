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

// Routes run along the cross-streets and ring lanes of the town grid.
export const PATROL_ROUTES: ReadonlyArray<PatrolRoute> = [
  { id: "main-ns", waypoints: [v(0, 40), v(0, 12), v(0, -12), v(0, -40)] },
  { id: "main-ew", waypoints: [v(-40, 0), v(-12, 0), v(12, 0), v(40, 0)] },
  { id: "ring", waypoints: [v(-33, -33), v(33, -33), v(33, 33), v(-33, 33)] },
  { id: "nw", waypoints: [v(-33, 11), v(-11, 11), v(-11, 33), v(-33, 33)] },
  { id: "ne", waypoints: [v(33, 11), v(11, 11), v(11, 33), v(33, 33)] },
  { id: "sw", waypoints: [v(-33, -11), v(-11, -11), v(-11, -33), v(-33, -33)] },
];

export interface EnemySpawn {
  id: string;
  routeId: string;
  startWaypoint: number;
}

export const ENEMY_SPAWNS: ReadonlyArray<EnemySpawn> = [
  { id: "g1", routeId: "main-ns", startWaypoint: 1 },
  { id: "g2", routeId: "main-ew", startWaypoint: 2 },
  { id: "g3", routeId: "ring", startWaypoint: 0 },
  { id: "g4", routeId: "ring", startWaypoint: 2 },
  { id: "g5", routeId: "nw", startWaypoint: 0 },
  { id: "g6", routeId: "ne", startWaypoint: 1 },
  { id: "g7", routeId: "sw", startWaypoint: 2 },
  { id: "g8", routeId: "main-ns", startWaypoint: 3 },
];
