import type * as THREE from "three";

/**
 * Decoupled hit registry. Damageable entities (enemies — Step 7) register their
 * collider handle + a handler; WeaponSystem reports hitscan impacts by handle.
 * Keeps weapons ignorant of what they hit.
 */
export type HitHandler = (damage: number, point: THREE.Vector3) => void;

const handlers = new Map<number, HitHandler>();

export function registerHittable(colliderHandle: number, handler: HitHandler): void {
  handlers.set(colliderHandle, handler);
}

export function unregisterHittable(colliderHandle: number): void {
  handlers.delete(colliderHandle);
}

/** @returns true if something damageable was at that handle. */
export function reportHit(colliderHandle: number, damage: number, point: THREE.Vector3): boolean {
  const h = handlers.get(colliderHandle);
  if (!h) return false;
  h(damage, point);
  return true;
}
