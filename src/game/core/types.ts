import type * as THREE from "three";
import type { World } from "@dimforge/rapier3d-compat";
import type { useRapier } from "@react-three/rapier";

/** The Rapier API (RigidBodyDesc, ColliderDesc, …) for creating bodies in code. */
export type RapierAPI = ReturnType<typeof useRapier>["rapier"];

/** Canonical update-order slots so the per-frame pipeline is deterministic. */
export const SystemOrder = {
  Input: 0,
  PlayerController: 10,
  AI: 20,
  Weapons: 30,
  Viewmodel: 40,
  Camera: 50,
  Entity: 60,
} as const;

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
  /** Rapier API for creating bodies/colliders in code. */
  rapier: RapierAPI;
}

/**
 * Uniform lifecycle every system and entity implements. The engine drives them
 * all the same way and tears them down deterministically.
 */
export interface GameModule {
  /** Unique id - used for registration dedupe and targeted unregister. */
  readonly id: string;

  /**
   * Update order (ascending). Lets us pin the pipeline - input → controllers →
   * weapons/ai → camera - independent of React mount order. Default 0.
   */
  readonly order?: number;

  /** Allocate resources, subscribe to stores, build meshes/colliders. */
  init(ctx: GameContext): void;

  /**
   * Deterministic step at fixed `dt` seconds. Optional - implement only for
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
