import type * as THREE from "three";

/**
 * Decoupled hit registry. Damageable entities (enemies) register their collider
 * handle + a handler; WeaponSystem reports hitscan impacts by handle. Keeps
 * weapons ignorant of what they hit. The handler reports back whether it was a
 * headshot / kill so the shooter can show feedback (hitmarker).
 */
export interface HitInfo {
  headshot: boolean;
  killed: boolean;
}

export type HitHandler = (damage: number, point: THREE.Vector3) => HitInfo;

const handlers = new Map<number, HitHandler>();

export function registerHittable(colliderHandle: number, handler: HitHandler): void {
  handlers.set(colliderHandle, handler);
}

export function unregisterHittable(colliderHandle: number): void {
  handlers.delete(colliderHandle);
}

/** @returns hit info if something damageable was at that handle, else null. */
export function reportHit(colliderHandle: number, damage: number, point: THREE.Vector3): HitInfo | null {
  const h = handlers.get(colliderHandle);
  return h ? h(damage, point) : null;
}
