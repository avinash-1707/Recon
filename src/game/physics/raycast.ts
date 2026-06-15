import * as THREE from "three";
import { Ray } from "@dimforge/rapier3d-compat";
import type { World, Collider } from "@dimforge/rapier3d-compat";
import { playerPhysics } from "@/game/state/runtime";

export interface ShotHit {
  hit: boolean;
  /** World-space hit point (or ray end if no hit). */
  point: THREE.Vector3;
  /** Collider struck (null on miss) — resolve to a rigid body / enemy. */
  collider: Collider | null;
  /** Distance to hit (or maxDist on miss). */
  distance: number;
}

const _ray = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

/**
 * Hitscan against the Rapier world, excluding the player's own body. Writes
 * into `out` (reused, zero-alloc) and returns it.
 */
export function castShot(
  world: World,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  out: ShotHit,
): ShotHit {
  _ray.origin.x = origin.x;
  _ray.origin.y = origin.y;
  _ray.origin.z = origin.z;
  _ray.dir.x = dir.x;
  _ray.dir.y = dir.y;
  _ray.dir.z = dir.z;

  const hit = world.castRay(
    _ray,
    maxDist,
    true,
    undefined,
    undefined,
    undefined,
    playerPhysics.body ?? undefined,
  );

  if (hit) {
    out.hit = true;
    out.distance = hit.timeOfImpact;
    out.collider = hit.collider;
    out.point.copy(origin).addScaledVector(dir, hit.timeOfImpact);
  } else {
    out.hit = false;
    out.distance = maxDist;
    out.collider = null;
    out.point.copy(origin).addScaledVector(dir, maxDist);
  }
  return out;
}
