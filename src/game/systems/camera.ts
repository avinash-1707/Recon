import * as THREE from "three";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { playerRuntime } from "@/game/state/runtime";
import { input } from "@/game/systems/input";
import { usePlayerStore } from "@/game/state/playerStore";

const tmpCenter = new THREE.Vector3();

/**
 * First-person camera. Anchors to the interpolated player eye and applies
 * mouse-look yaw/pitch. Step 4 extends this to a dual FP/TP controller with a
 * collision-aware third-person spring arm and a V toggle.
 */
export class CameraSystem implements GameModule {
  readonly id = "system.camera";
  readonly order = SystemOrder.Camera;

  private cam: THREE.PerspectiveCamera | null = null;

  init(ctx: GameContext): void {
    this.cam = ctx.camera;
    this.cam.rotation.order = "YXZ"; // yaw then pitch — no roll/gimbal surprises
  }

  update(_dt: number, alpha: number): void {
    if (!this.cam) return;

    // V toggles camera mode (read here — variable rate, never missed).
    if (input.toggleCameraPressed) usePlayerStore.getState().toggleCameraMode();

    // Interpolate the logical (fixed-step) position for smooth render.
    tmpCenter.lerpVectors(playerRuntime.prevPosition, playerRuntime.position, alpha);
    this.cam.position.set(
      tmpCenter.x,
      tmpCenter.y + playerRuntime.eyeHeight,
      tmpCenter.z,
    );
    this.cam.rotation.set(playerRuntime.pitch, playerRuntime.yaw, 0);
  }

  dispose(): void {
    this.cam = null;
  }
}
