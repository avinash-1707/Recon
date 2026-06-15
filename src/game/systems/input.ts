import * as THREE from "three";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { playerRuntime } from "@/game/state/runtime";

/** Logical actions, decoupled from physical keys. */
export enum Action {
  MoveForward,
  MoveBack,
  MoveLeft,
  MoveRight,
  Sprint,
  Crouch,
  Jump,
  Reload,
  Interact,
  ToggleCamera,
  Weapon1,
  Weapon2,
  Weapon3,
}

/** Physical-key → action bindings (KeyboardEvent.code). Single source of truth. */
const KEY_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: Action.MoveForward,
  ArrowUp: Action.MoveForward,
  KeyS: Action.MoveBack,
  ArrowDown: Action.MoveBack,
  KeyA: Action.MoveLeft,
  ArrowLeft: Action.MoveLeft,
  KeyD: Action.MoveRight,
  ArrowRight: Action.MoveRight,
  ShiftLeft: Action.Sprint,
  ShiftRight: Action.Sprint,
  ControlLeft: Action.Crouch,
  ControlRight: Action.Crouch,
  KeyC: Action.Crouch,
  Space: Action.Jump,
  KeyR: Action.Reload,
  KeyE: Action.Interact,
  KeyV: Action.ToggleCamera,
  Digit1: Action.Weapon1,
  Digit2: Action.Weapon2,
  Digit3: Action.Weapon3,
};

/** Shared input snapshot, refreshed once per frame by InputSystem. */
export interface InputState {
  /** Strafe axis, -1 (left) .. 1 (right). */
  moveX: number;
  /** Forward axis, -1 (back) .. 1 (forward). */
  moveZ: number;
  /** Accumulated mouse delta consumed this frame. */
  lookDeltaX: number;
  lookDeltaY: number;
  // held
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  aim: boolean;
  /**
   * Jump latch — set on keydown, consumed by the fixed-step controller. A latch
   * (not a per-frame edge) so a jump is never lost on a frame that runs zero
   * fixed steps (high-refresh displays).
   */
  jumpQueued: boolean;
  // edges — true for exactly one frame on press
  reloadPressed: boolean;
  interactPressed: boolean;
  toggleCameraPressed: boolean;
  /** 1/2/3 if a weapon slot was pressed this frame, else 0. */
  weaponSlot: number;
  pointerLocked: boolean;
}

export const input: InputState = {
  moveX: 0,
  moveZ: 0,
  lookDeltaX: 0,
  lookDeltaY: 0,
  sprint: false,
  crouch: false,
  fire: false,
  aim: false,
  jumpQueued: false,
  reloadPressed: false,
  interactPressed: false,
  toggleCameraPressed: false,
  weaponSlot: 0,
  pointerLocked: false,
};

const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = THREE.MathUtils.degToRad(88);

/**
 * Captures keyboard + mouse, maps to logical actions, and writes the shared
 * `input` snapshot + look angles. Edges are derived by diffing held-state
 * against the previous frame, so each "pressed" is true for one frame and self-
 * clears — no manual consumption needed. Runs first in the pipeline.
 */
export class InputSystem implements GameModule {
  readonly id = "system.input";
  readonly order = SystemOrder.Input;

  private dom: HTMLElement | null = null;
  private readonly held = new Set<Action>();
  private readonly prevHeld = new Set<Action>();
  private accumDX = 0;
  private accumDY = 0;

  init(ctx: GameContext): void {
    this.dom = ctx.gl.domElement;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.dom.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    // Suppress the context menu so RMB can drive aim-down-sights.
    this.dom.addEventListener("contextmenu", this.preventDefault);
    window.addEventListener("blur", this.onBlur);
  }

  update(): void {
    // Mouse look → yaw/pitch (only while locked).
    input.lookDeltaX = this.accumDX;
    input.lookDeltaY = this.accumDY;
    if (input.pointerLocked) {
      playerRuntime.yaw -= this.accumDX * LOOK_SENSITIVITY;
      playerRuntime.pitch -= this.accumDY * LOOK_SENSITIVITY;
      playerRuntime.pitch = THREE.MathUtils.clamp(playerRuntime.pitch, -MAX_PITCH, MAX_PITCH);
    }
    this.accumDX = 0;
    this.accumDY = 0;

    // Movement axes.
    input.moveZ = this.axis(Action.MoveForward, Action.MoveBack);
    input.moveX = this.axis(Action.MoveRight, Action.MoveLeft);
    input.sprint = this.held.has(Action.Sprint);
    input.crouch = this.held.has(Action.Crouch);

    // Edge detection via held vs prevHeld. (Jump is a keydown latch instead.)
    input.reloadPressed = this.pressed(Action.Reload);
    input.interactPressed = this.pressed(Action.Interact);
    input.toggleCameraPressed = this.pressed(Action.ToggleCamera);
    input.weaponSlot = this.pressed(Action.Weapon1)
      ? 1
      : this.pressed(Action.Weapon2)
        ? 2
        : this.pressed(Action.Weapon3)
          ? 3
          : 0;

    // Snapshot held set for next-frame edge diffing (reuse, no alloc).
    this.prevHeld.clear();
    this.held.forEach((a) => this.prevHeld.add(a));
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.dom?.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.dom?.removeEventListener("contextmenu", this.preventDefault);
    window.removeEventListener("blur", this.onBlur);
    this.held.clear();
    this.prevHeld.clear();
  }

  private axis(pos: Action, neg: Action): number {
    return (this.held.has(pos) ? 1 : 0) - (this.held.has(neg) ? 1 : 0);
  }

  private pressed(a: Action): boolean {
    return this.held.has(a) && !this.prevHeld.has(a);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_BINDINGS[e.code];
    if (action === undefined) return;
    e.preventDefault();
    if (e.repeat) return; // ignore auto-repeat for latches
    this.held.add(action);
    if (action === Action.Jump) input.jumpQueued = true;
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_BINDINGS[e.code];
    if (action === undefined) return;
    this.held.delete(action);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!input.pointerLocked) return;
    if (e.button === 0) input.fire = true;
    else if (e.button === 2) input.aim = true;
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) input.fire = false;
    else if (e.button === 2) input.aim = false;
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!input.pointerLocked) return;
    this.accumDX += e.movementX;
    this.accumDY += e.movementY;
  };

  private readonly onPointerLockChange = (): void => {
    input.pointerLocked = document.pointerLockElement === this.dom;
  };

  private readonly onBlur = (): void => {
    // Drop all held inputs when focus is lost so movement doesn't stick.
    this.held.clear();
    input.fire = false;
    input.aim = false;
  };

  private readonly preventDefault = (e: Event): void => e.preventDefault();
}
