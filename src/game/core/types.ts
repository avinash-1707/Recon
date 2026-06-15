import type * as THREE from "three";
import type { World } from "@dimforge/rapier3d-compat";

/**
 * Shared engine handle passed to every module's `init`. Holds the live Three.js
 * objects and the Rapier physics world. Systems/entities pull what they need
 * from here rather than reaching through React.
 */
export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  gl: THREE.WebGLRenderer;
  /** Rapier physics world (driven by @react-three/rapier's fixed stepper). */
  world: World;
}

/**
 * Uniform lifecycle every system and entity implements. The engine drives them
 * all the same way and tears them down deterministically.
 */
export interface GameModule {
  /** Unique id — used for registration dedupe and targeted unregister. */
  readonly id: string;

  /** Allocate resources, subscribe to stores, build meshes/colliders. */
  init(ctx: GameContext): void;

  /**
   * Deterministic step at fixed `dt` seconds. Optional — implement only for
   * logic that must be framerate-independent (integration, AI ticks, timers).
   */
  fixedUpdate?(dt: number): void;

  /**
   * Per-frame variable update.
   * @param dt    real frame delta in seconds
   * @param alpha interpolation factor into the current fixed step (0..1)
   */
  update(dt: number, alpha: number): void;

  /** Free GPU resources (geometry/material/texture) and unsubscribe. */
  dispose(): void;
}
