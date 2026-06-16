import * as THREE from "three";
import { Ray } from "@dimforge/rapier3d-compat";
import type { World, RigidBody } from "@dimforge/rapier3d-compat";
import { playerPhysics } from "@/game/state/runtime";

const _to = new THREE.Vector3();
const _ray = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

export interface VisionResult {
  visible: boolean;
  /** Distance to the player (m). */
  distance: number;
}

/**
 * Vision cone test: player within range + inside the FOV cone + clear line of
 * sight (a Rapier ray from the eye reaches the player's collider without a wall
 * in between). `self` is excluded so the enemy never blocks its own view.
 */
export function checkVision(
  world: World,
  eye: THREE.Vector3,
  forward: THREE.Vector3,
  target: THREE.Vector3,
  fovCos: number,
  range: number,
  self: RigidBody,
  out: VisionResult,
): VisionResult {
  out.visible = false;
  _to.subVectors(target, eye);
  const dist = _to.length();
  out.distance = dist;
  if (dist > range || dist < 0.001) return out;
  _to.divideScalar(dist);

  // inside the cone?
  if (forward.dot(_to) < fovCos) return out;

  // line of sight: nearest hit along the ray must be the player's collider
  _ray.origin.x = eye.x;
  _ray.origin.y = eye.y;
  _ray.origin.z = eye.z;
  _ray.dir.x = _to.x;
  _ray.dir.y = _to.y;
  _ray.dir.z = _to.z;
  const hit = world.castRay(_ray, dist + 0.5, true, undefined, undefined, undefined, self);
  if (!hit) return out;
  const playerCollider = playerPhysics.collider;
  out.visible = playerCollider !== null && hit.collider.handle === playerCollider.handle;
  return out;
}
