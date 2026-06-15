import * as THREE from "three";
import { Ray } from "@dimforge/rapier3d-compat";
import type { World } from "@dimforge/rapier3d-compat";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { playerRuntime, playerPhysics } from "@/game/state/runtime";
import { input } from "@/game/systems/input";
import { CameraMode, usePlayerStore } from "@/game/state/playerStore";

// Third-person rig tuning.
const TP_DISTANCE = 4.2; // ideal camera distance behind the pivot
const TP_PIVOT_HEIGHT = 1.0; // pivot above capsule center (~head)
const TP_MIN_DISTANCE = 1.0; // never closer than this when a wall pulls us in
const TP_WALL_SKIN = 0.3; // keep off the wall by this much
const SWITCH_RATE = 9; // FP↔TP blend speed
const SPRING_RATE = 16; // wall pull-in / push-out smoothing

const tmpCenter = new THREE.Vector3();
const tmpFwd = new THREE.Vector3();
const tmpFp = new THREE.Vector3();
const tmpPivot = new THREE.Vector3();
const tmpTp = new THREE.Vector3();
const tmpFinal = new THREE.Vector3();

/**
 * Dual first/third-person camera. One controller, two modes:
 *  - FP: head-anchored, looks along yaw/pitch.
 *  - TP: collision-aware spring arm behind the pivot; a Rapier ray (excluding
 *    the player) pulls the camera in when a wall is between it and the pivot.
 * Switching blends smoothly (no cut). Both modes share the same look rotation,
 * so the aim direction is consistent across the toggle.
 */
export class CameraSystem implements GameModule {
  readonly id = "system.camera";
  readonly order = SystemOrder.Camera;

  private cam: THREE.PerspectiveCamera | null = null;
  private world: World | null = null;
  private readonly ray = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

  /** 0 = FP, 1 = TP. Lerps toward the store's mode for a smooth switch. */
  private blend = 0;
  /** Smoothed TP arm length (after wall collision). */
  private springDist = TP_DISTANCE;

  init(ctx: GameContext): void {
    this.cam = ctx.camera;
    this.world = ctx.world;
    this.cam.rotation.order = "YXZ"; // yaw then pitch — no roll/gimbal surprises
    this.blend = usePlayerStore.getState().cameraMode === CameraMode.ThirdPerson ? 1 : 0;
  }

  update(dt: number, alpha: number): void {
    const cam = this.cam;
    if (!cam) return;

    // V toggles mode (read here — variable rate, never missed by a fixed step).
    if (input.toggleCameraPressed) usePlayerStore.getState().toggleCameraMode();

    const yaw = playerRuntime.yaw;
    const pitch = playerRuntime.pitch;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // Unit look-forward for YXZ(pitch, yaw).
    tmpFwd.set(-sy * cp, sp, -cy * cp);

    // Interpolated logical position.
    tmpCenter.lerpVectors(playerRuntime.prevPosition, playerRuntime.position, alpha);

    // FP eye position.
    tmpFp.set(tmpCenter.x, tmpCenter.y + playerRuntime.eyeHeight, tmpCenter.z);

    // Blend toward the target mode.
    const targetBlend =
      usePlayerStore.getState().cameraMode === CameraMode.ThirdPerson ? 1 : 0;
    this.blend += (targetBlend - this.blend) * Math.min(1, SWITCH_RATE * dt);

    if (this.blend > 0.001) {
      // TP: pivot above the head, camera arm behind along -forward.
      tmpPivot.set(tmpCenter.x, tmpCenter.y + TP_PIVOT_HEIGHT, tmpCenter.z);
      let allowed = TP_DISTANCE;
      if (this.world) {
        this.ray.origin.x = tmpPivot.x;
        this.ray.origin.y = tmpPivot.y;
        this.ray.origin.z = tmpPivot.z;
        this.ray.dir.x = -tmpFwd.x;
        this.ray.dir.y = -tmpFwd.y;
        this.ray.dir.z = -tmpFwd.z;
        const hit = this.world.castRay(
          this.ray,
          TP_DISTANCE,
          true,
          undefined,
          undefined,
          undefined,
          playerPhysics.body ?? undefined,
        );
        if (hit) {
          allowed = THREE.MathUtils.clamp(
            hit.timeOfImpact - TP_WALL_SKIN,
            TP_MIN_DISTANCE,
            TP_DISTANCE,
          );
        }
      }
      // Smooth the arm so wall transitions don't pop.
      this.springDist += (allowed - this.springDist) * Math.min(1, SPRING_RATE * dt);
      tmpTp.copy(tmpPivot).addScaledVector(tmpFwd, -this.springDist);

      tmpFinal.lerpVectors(tmpFp, tmpTp, this.blend);
    } else {
      this.springDist = TP_DISTANCE; // reset so re-entry doesn't lurch
      tmpFinal.copy(tmpFp);
    }

    cam.position.copy(tmpFinal);
    cam.rotation.set(pitch, yaw, 0);
  }

  dispose(): void {
    this.cam = null;
    this.world = null;
  }
}
