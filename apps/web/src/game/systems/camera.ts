import * as THREE from "three";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { playerRuntime } from "@/game/state/runtime";

const tmpCenter = new THREE.Vector3();

/**
 * First-person camera. Anchors to the interpolated player eye and applies
 * mouse-look yaw/pitch. (First-person only - third person was removed.)
 */
export class CameraSystem implements GameModule {
  readonly id = "system.camera";
  readonly order = SystemOrder.Camera;

  private cam: THREE.PerspectiveCamera | null = null;

  init(ctx: GameContext): void {
    this.cam = ctx.camera;
    this.cam.rotation.order = "YXZ"; // yaw then pitch - no roll/gimbal surprises
  }

  update(_dt: number, alpha: number): void {
    const cam = this.cam;
    if (!cam) return;
    // Interpolate the logical (fixed-step) position for smooth render.
    tmpCenter.lerpVectors(playerRuntime.prevPosition, playerRuntime.position, alpha);
    cam.position.set(tmpCenter.x, tmpCenter.y + playerRuntime.eyeHeight, tmpCenter.z);
    cam.rotation.set(playerRuntime.pitch, playerRuntime.yaw, 0);
  }

  dispose(): void {
    this.cam = null;
  }
}
