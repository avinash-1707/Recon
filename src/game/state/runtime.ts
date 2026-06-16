import * as THREE from "three";
import type { Collider, RigidBody } from "@dimforge/rapier3d-compat";

/**
 * Transient, per-frame game state — mutated directly in the loop, NEVER through
 * React/Zustand (which would re-render). Systems read/write these shared objects
 * to avoid allocation and cross-module plumbing. Discrete, UI-facing state
 * (health, ammo, camera mode) lives in the Zustand stores instead.
 */

export interface PlayerRuntime {
  /** Capsule center, world space — the logical (fixed-step) position. */
  position: THREE.Vector3;
  /** Previous fixed-step center, for render interpolation. */
  prevPosition: THREE.Vector3;
  /** Current velocity (m/s). */
  velocity: THREE.Vector3;
  /** Mouse-look yaw (rad), rotation about +Y. yaw 0 faces -Z. */
  yaw: number;
  /** Mouse-look pitch (rad), clamped. */
  pitch: number;
  /** On the ground this step (from the character controller). */
  grounded: boolean;
  /** Eye offset above the capsule center (shrinks when crouched). */
  eyeHeight: number;
  crouching: boolean;
  sprinting: boolean;
  /** Pending teleport target (respawn) — consumed by the controller. */
  teleport: THREE.Vector3 | null;
}

export const playerRuntime: PlayerRuntime = {
  position: new THREE.Vector3(0, 2, 6),
  prevPosition: new THREE.Vector3(0, 2, 6),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  grounded: false,
  eyeHeight: 0.7,
  crouching: false,
  sprinting: false,
  teleport: null,
};

/**
 * Live Rapier handles for the player, published by PlayerController. Lets other
 * systems (e.g. the TP camera ray) reference/exclude the player body without
 * routing through React.
 */
export interface PlayerPhysics {
  body: RigidBody | null;
  collider: Collider | null;
}

export const playerPhysics: PlayerPhysics = { body: null, collider: null };

/**
 * Transient weapon animation state, written by WeaponSystem (logic) and read by
 * ViewmodelSystem (presentation) — keeps the two decoupled without re-renders.
 * All scalars are 0..1.
 */
export interface WeaponRuntime {
  recoil: number; // decays after each shot → kick
  slide: number; // slide/bolt travel
  reload: number; // reload progress (0 = idle)
  ads: number; // aim-down-sights blend
  switchT: number; // 1 = weapon fully raised after a swap
  /** Muzzle tip in world space, published by the viewmodel for tracer origin. */
  muzzlePos: THREE.Vector3;
}

export const weaponRuntime: WeaponRuntime = {
  recoil: 0,
  slide: 0,
  reload: 0,
  ads: 0,
  switchT: 1,
  muzzlePos: new THREE.Vector3(),
};
