import * as THREE from "three";

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
};
