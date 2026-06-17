import * as THREE from "three";
import { Ray } from "@dimforge/rapier3d-compat";
import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World,
} from "@dimforge/rapier3d-compat";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { input } from "@/game/systems/input";
import { playerRuntime, playerPhysics } from "@/game/state/runtime";
import { Stance, usePlayerStore } from "@/game/state/playerStore";
import { findVaultTarget } from "@/game/levels/windowRegistry";

// Movement tuning (m/s, m/s²-ish smoothing factors).
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.0;
const CROUCH_SPEED = 2.0;
const GRAVITY = -24;
const JUMP_SPEED = 7.2;
const GROUND_ACCEL = 16; // exponential approach rate while grounded
const AIR_ACCEL = 5; // reduced air control
const STAND_EYE = 0.7; // eye offset above capsule center
const CROUCH_EYE = 0.15;
const EYE_LERP = 12;

// Window vault (rough scripted hop across a window opening, both directions).
const VAULT_DUR = 0.33; // seconds
const VAULT_ARC = 0.35; // peak rise over the sill
const VAULT_EXIT = 0.95; // land this far past the opening on the far side

// Out-of-bounds: fall through the world or leave the arena → death.
const KILL_Y = -8;
const BOUND_XZ = 90; // beyond the perimeter wall (±80) by a margin

const UP = new THREE.Vector3(0, 1, 0);
const tmpFwd = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpMove = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpNext = new THREE.Vector3();
const _vaultRay = new Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

/**
 * Kinematic FPS character controller built on Rapier's
 * KinematicCharacterController (auto-step, slope handling, snap-to-ground).
 * Runs in `fixedUpdate` for deterministic, framerate-independent motion;
 * the camera interpolates the resulting position with `alpha`.
 */
export class PlayerController implements GameModule {
  readonly id = "entity.player-controller";
  readonly order = SystemOrder.PlayerController;

  private controller: KinematicCharacterController | null = null;
  private grounded = false;
  private vaulting = false;
  private vaultT = 0;
  private readonly vaultStart = new THREE.Vector3();
  private readonly vaultEnd = new THREE.Vector3();

  constructor(
    private readonly world: World,
    private readonly body: RigidBody,
    private readonly collider: Collider,
  ) {}

  init(_ctx: GameContext): void {
    const c = this.world.createCharacterController(0.02);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.enableAutostep(0.5, 0.2, true);
    c.enableSnapToGround(0.5);
    c.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    c.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(40));
    c.setApplyImpulsesToDynamicBodies(true);
    this.controller = c;

    playerPhysics.body = this.body;
    playerPhysics.collider = this.collider;

    const t = this.body.translation();
    playerRuntime.position.set(t.x, t.y, t.z);
    playerRuntime.prevPosition.copy(playerRuntime.position);
    playerRuntime.velocity.set(0, 0, 0);
  }

  fixedUpdate(dt: number): void {
    const ctrl = this.controller;
    if (!ctrl) return;

    // Consume a pending teleport (respawn) - set the body ourselves so it isn't
    // overwritten by this step's movement.
    if (playerRuntime.teleport) {
      const t = playerRuntime.teleport;
      playerRuntime.teleport = null;
      this.body.setNextKinematicTranslation({ x: t.x, y: t.y, z: t.z });
      playerRuntime.position.copy(t);
      playerRuntime.prevPosition.copy(t);
      playerRuntime.velocity.set(0, 0, 0);
      this.grounded = false;
      this.vaulting = false; // a respawn mid-vault must not drag us back
      this.vaultT = 0;
      return;
    }

    // Window vault in progress — scripted translation across the opening,
    // bypassing normal movement/collision (rough but functional).
    if (this.vaulting) {
      this.vaultT += dt;
      const u = Math.min(1, this.vaultT / VAULT_DUR);
      tmpNext.lerpVectors(this.vaultStart, this.vaultEnd, u);
      tmpNext.y += VAULT_ARC * Math.sin(Math.PI * u);
      this.body.setNextKinematicTranslation({ x: tmpNext.x, y: tmpNext.y, z: tmpNext.z });
      playerRuntime.prevPosition.copy(playerRuntime.position);
      playerRuntime.position.copy(tmpNext);
      playerRuntime.velocity.set(0, 0, 0);
      playerRuntime.launch = 0; // don't let a jump-pad launch latch through the vault
      playerRuntime.grounded = false;
      if (u >= 1) {
        this.vaulting = false;
        this.grounded = false;
      }
      return;
    }

    const vel = playerRuntime.velocity;

    const crouch = input.crouch;
    const sprint = input.sprint && !crouch && input.moveZ > 0;

    // Smooth crouch → eye height.
    const targetEye = crouch ? CROUCH_EYE : STAND_EYE;
    playerRuntime.eyeHeight += (targetEye - playerRuntime.eyeHeight) * Math.min(1, EYE_LERP * dt);
    playerRuntime.crouching = crouch;

    const speed = crouch ? CROUCH_SPEED : sprint ? SPRINT_SPEED : WALK_SPEED;

    // Desired horizontal velocity from yaw-relative input.
    tmpFwd.set(0, 0, -1).applyAxisAngle(UP, playerRuntime.yaw);
    tmpRight.set(1, 0, 0).applyAxisAngle(UP, playerRuntime.yaw);
    tmpMove.set(0, 0, 0).addScaledVector(tmpFwd, input.moveZ).addScaledVector(tmpRight, input.moveX);
    if (tmpMove.lengthSq() > 1) tmpMove.normalize(); // no diagonal speed boost

    const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
    const k = Math.min(1, accel * dt);
    vel.x += (tmpMove.x * speed - vel.x) * k;
    vel.z += (tmpMove.z * speed - vel.z) * k;
    playerRuntime.sprinting = sprint && this.grounded && tmpMove.lengthSq() > 0.01;

    // Vertical: reset on ground, jump latch / jump pad, gravity.
    if (this.grounded && vel.y < 0) vel.y = 0;
    const wantJump = input.jumpQueued;
    input.jumpQueued = false;
    // Vault takes priority over jump when standing at a window you face.
    if (wantJump && this.tryStartVault()) return;
    if (this.grounded && wantJump) vel.y = JUMP_SPEED;
    const launch = playerRuntime.launch;
    playerRuntime.launch = 0;
    if (launch > 0 && this.grounded) vel.y = launch;
    vel.y += GRAVITY * dt;

    // Resolve against the world via the character controller.
    tmpDesired.set(vel.x * dt, vel.y * dt, vel.z * dt);
    ctrl.computeColliderMovement(this.collider, tmpDesired);
    this.grounded = ctrl.computedGrounded();
    const corr = ctrl.computedMovement();

    // Kill upward velocity if we clipped a ceiling.
    if (vel.y > 0 && corr.y < tmpDesired.y - 1e-4) vel.y = 0;

    const cur = this.body.translation();
    tmpNext.set(cur.x + corr.x, cur.y + corr.y, cur.z + corr.z);
    this.body.setNextKinematicTranslation(tmpNext);

    // Publish runtime (prev→curr for render interpolation).
    playerRuntime.prevPosition.copy(playerRuntime.position);
    playerRuntime.position.copy(tmpNext);
    playerRuntime.grounded = this.grounded;

    // Out of bounds (fell through the floor / left the arena) → die. Routes
    // through the normal death flow (GameOver in single, respawn beat in MP).
    if (
      tmpNext.y < KILL_Y ||
      Math.abs(tmpNext.x) > BOUND_XZ ||
      Math.abs(tmpNext.z) > BOUND_XZ
    ) {
      usePlayerStore.getState().damage(9999);
    }

    // Discrete HUD state - setters no-op when unchanged (no needless re-render).
    const store = usePlayerStore.getState();
    store.setStance(crouch ? Stance.Crouch : Stance.Stand);
    store.setSprinting(playerRuntime.sprinting);
    store.setGrounded(this.grounded);
  }

  update(): void {
    // No variable-rate work - motion is fully fixed-step.
  }

  /** If the player is at a window they're facing, begin a vault across it.
   *  Works both ways (outside→in and inside→out) — it just moves to the far
   *  side of the opening's plane. Shatters intact glass first. */
  private tryStartVault(): boolean {
    if (this.vaulting) return false;
    const target = findVaultTarget(playerRuntime.position, tmpFwd);
    if (!target) return false;
    const o = target.opening;

    // Exit direction = the far side of the wall plane.
    const ex = -target.side * o.normal.x;
    const ey = -target.side * o.normal.y;
    const ez = -target.side * o.normal.z;

    // Abort if the far side is blocked (don't clip into a solid wall). Cast from
    // just past the opening centre along the exit dir, excluding the player.
    _vaultRay.origin.x = o.center.x + ex * 0.12;
    _vaultRay.origin.y = o.center.y + ey * 0.12;
    _vaultRay.origin.z = o.center.z + ez * 0.12;
    _vaultRay.dir.x = ex;
    _vaultRay.dir.y = ey;
    _vaultRay.dir.z = ez;
    const blocked = this.world.castRay(
      _vaultRay,
      VAULT_EXIT + 0.4,
      true,
      undefined,
      undefined,
      undefined,
      playerPhysics.body ?? undefined,
    );
    if (blocked) return false;

    if (!o.isBroken()) o.shatter();
    this.vaultStart.copy(playerRuntime.position);
    this.vaultEnd.set(
      o.center.x + ex * VAULT_EXIT,
      playerRuntime.position.y, // keep height; arc clears the sill, gravity settles
      o.center.z + ez * VAULT_EXIT,
    );
    this.vaulting = true;
    this.vaultT = 0;
    playerRuntime.velocity.set(0, 0, 0);
    return true;
  }

  dispose(): void {
    if (this.controller) {
      this.world.removeCharacterController(this.controller);
      this.controller = null;
    }
    playerPhysics.body = null;
    playerPhysics.collider = null;
  }
}
