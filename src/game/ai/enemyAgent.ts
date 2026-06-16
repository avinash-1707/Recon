import * as THREE from "three";
import type { World, RigidBody, Collider } from "@dimforge/rapier3d-compat";
import type { RapierAPI } from "@/game/core/types";
import { AI, EnemyState } from "@/game/ai/fsm";
import { checkVision, type VisionResult } from "@/game/ai/vision";
import { playerRuntime } from "@/game/state/runtime";
import { usePlayerStore } from "@/game/state/playerStore";
import { registerHittable, unregisterHittable, type HitInfo } from "@/game/systems/combat";
import { spawnBloodStain } from "@/game/utils/decals";

const RADIUS = 0.34;
const HALF = 0.6; // capsule cylinder half-height → ~1.8m
const CENTER_Y = 0.94; // capsule center above ground
const HEAD_Y = 1.45; // hits above this (world) count as headshots
const HEADSHOT_MULT = 2.6;
const FACE_OFFSET = Math.PI; // Soldier.glb faces -Z; rotate to align with motion
const FOV_COS = Math.cos(THREE.MathUtils.degToRad(AI.visionFovDeg / 2));

const _target = new THREE.Vector3();
const _lerp = new THREE.Vector3();

function pickAction(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  keyword: string,
  fallbackIndex: number,
): THREE.AnimationAction | null {
  const byName = clips.find((c) => c.name.toLowerCase().includes(keyword));
  const clip = byName ?? clips[fallbackIndex] ?? null;
  return clip ? mixer.clipAction(clip) : null;
}

/**
 * One enemy: a kinematic capsule + a skinned Soldier model, a patrol/alert/
 * search/combat/dead FSM driven by a vision cone, and idle/walk/run animation
 * blended by speed. Driven by AISystem.
 */
export class EnemyAgent {
  state: EnemyState = EnemyState.Patrol;
  detection = 0;
  health = AI.health;
  readonly collider: Collider;

  private readonly body: RigidBody;
  private readonly world: World;
  private readonly root: THREE.Object3D;
  private readonly scene: THREE.Scene;
  private readonly mixer: THREE.AnimationMixer;
  private readonly idle: THREE.AnimationAction | null;
  private readonly walk: THREE.AnimationAction | null;
  private readonly run: THREE.AnimationAction | null;
  private active: THREE.AnimationAction | null;

  private readonly route: THREE.Vector3[];
  private wp: number;
  private readonly pos = new THREE.Vector3();
  private readonly prevPos = new THREE.Vector3();
  private yaw = 0;
  private targetYaw = 0;
  private speed = 0;
  private readonly lastKnown = new THREE.Vector3();
  private searchTimer = 0;
  private fireTimer = 0;
  private scanTimer = 0;
  private dead = false;
  private readonly vis: VisionResult = { visible: false, distance: 0 };
  private readonly eye = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();

  constructor(
    world: World,
    rapier: RapierAPI,
    scene: THREE.Scene,
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    route: THREE.Vector3[],
    startWaypoint: number,
  ) {
    this.world = world;
    this.scene = scene;
    this.root = root;
    this.route = route;
    this.wp = startWaypoint % route.length;

    const spawn = route[this.wp];
    this.pos.set(spawn.x, CENTER_Y, spawn.z);
    this.prevPos.copy(this.pos);

    const desc = rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, CENTER_Y, spawn.z);
    this.body = world.createRigidBody(desc);
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(HALF, RADIUS), this.body);
    registerHittable(this.collider.handle, (dmg, point) => this.takeDamage(dmg, point));

    scene.add(root);
    root.traverse((o) => {
      o.castShadow = true;
    });

    this.mixer = new THREE.AnimationMixer(root);
    this.idle = pickAction(this.mixer, clips, "idle", 0);
    this.walk = pickAction(this.mixer, clips, "walk", 1);
    this.run = pickAction(this.mixer, clips, "run", 2);
    this.active = this.idle;
    this.active?.play();
  }

  /** Logic step (fixed dt). */
  fixedUpdate(dt: number): void {
    if (this.dead) return;
    this.prevPos.copy(this.pos);

    // perceive
    this.eye.set(this.pos.x, AI.eyeHeight, this.pos.z);
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    _target.set(playerRuntime.position.x, playerRuntime.position.y + 0.2, playerRuntime.position.z);
    checkVision(this.world, this.eye, this.forward, _target, FOV_COS, AI.visionRange, this.body, this.vis);

    if (this.vis.visible) {
      const closeness = 1 - Math.min(1, this.vis.distance / AI.visionRange);
      this.detection = Math.min(1.2, this.detection + AI.detectionGain * (0.4 + 0.6 * closeness) * dt);
      this.lastKnown.copy(playerRuntime.position);
    } else {
      this.detection = Math.max(0, this.detection - AI.detectionDecay * dt);
    }

    switch (this.state) {
      case EnemyState.Patrol:
        this.patrol(dt);
        if (this.detection > 0.25) this.state = EnemyState.Alert;
        break;
      case EnemyState.Alert:
        this.faceToward(this.lastKnown, dt);
        if (this.detection >= AI.combatThreshold) this.state = EnemyState.Combat;
        else if (this.detection <= AI.calmThreshold) this.state = EnemyState.Patrol;
        break;
      case EnemyState.Combat:
        this.combat(dt);
        if (!this.vis.visible && this.detection < AI.combatThreshold * 0.6) {
          this.state = EnemyState.Search;
          this.searchTimer = AI.searchTime;
        }
        break;
      case EnemyState.Search:
        this.search(dt);
        if (this.detection >= AI.combatThreshold) this.state = EnemyState.Combat;
        else if ((this.searchTimer -= dt) <= 0) this.state = EnemyState.Patrol;
        break;
      case EnemyState.Dead:
        break;
    }

    this.speed = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / dt;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: CENTER_Y, z: this.pos.z });
  }

  /** Render step (variable dt) — advance + blend animation, interpolate model. */
  update(dt: number, alpha: number): void {
    this.mixer.update(dt);
    if (!this.dead) {
      const next = this.speed < 0.4 ? this.idle : this.speed < 3.0 ? this.walk : this.run;
      this.setAction(next);
    }
    _lerp.lerpVectors(this.prevPos, this.pos, alpha);
    this.root.position.set(_lerp.x, 0, _lerp.z);
    this.root.rotation.y = this.yaw + FACE_OFFSET;
  }

  takeDamage(dmg: number, point: THREE.Vector3): HitInfo {
    if (this.dead) return { headshot: false, killed: false };
    const headshot = point.y >= HEAD_Y;
    this.health -= dmg * (headshot ? HEADSHOT_MULT : 1);
    this.detection = 1.2;
    this.lastKnown.copy(playerRuntime.position);
    if (this.state === EnemyState.Patrol || this.state === EnemyState.Alert) {
      this.state = EnemyState.Combat;
    }
    const killed = this.health <= 0;
    if (killed) this.die();
    return { headshot, killed };
  }

  get isDead(): boolean {
    return this.dead;
  }

  /** Live capsule-center position (read-only ref). */
  get position(): THREE.Vector3 {
    return this.pos;
  }

  dispose(): void {
    unregisterHittable(this.collider.handle);
    this.mixer.stopAllAction();
    this.scene.remove(this.root);
    if (!this.dead) this.world.removeRigidBody(this.body);
  }

  // ---- behaviours ----

  private patrol(dt: number): void {
    const wp = this.route[this.wp];
    this.moveToward(wp.x, wp.z, AI.walkSpeed, dt);
    if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < AI.waypointRadius) {
      this.wp = (this.wp + 1) % this.route.length;
    }
  }

  private combat(dt: number): void {
    const px = playerRuntime.position.x;
    const pz = playerRuntime.position.z;
    this.targetYaw = Math.atan2(px - this.pos.x, pz - this.pos.z);
    this.smoothYaw(dt);
    const d = Math.hypot(px - this.pos.x, pz - this.pos.z);
    if (d > 12) this.moveToward(px, pz, AI.runSpeed, dt);
    else this.speed = 0;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && this.vis.visible) {
      this.fireTimer = AI.fireInterval;
      this.fireAtPlayer();
    }
  }

  private search(dt: number): void {
    const d = Math.hypot(this.lastKnown.x - this.pos.x, this.lastKnown.z - this.pos.z);
    if (d > AI.waypointRadius) {
      this.moveToward(this.lastKnown.x, this.lastKnown.z, AI.walkSpeed, dt);
    } else {
      // arrived — scan around
      this.scanTimer += dt;
      this.targetYaw = Math.sin(this.scanTimer * 1.5) * Math.PI;
      this.smoothYaw(dt);
    }
  }

  private faceToward(p: THREE.Vector3, dt: number): void {
    this.targetYaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.smoothYaw(dt);
  }

  private moveToward(x: number, z: number, speed: number, dt: number): void {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    this.pos.x += (dx / d) * speed * dt;
    this.pos.z += (dz / d) * speed * dt;
    this.targetYaw = Math.atan2(dx, dz);
    this.smoothYaw(dt);
  }

  private smoothYaw(dt: number): void {
    let diff = this.targetYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
    this.yaw += diff * Math.min(1, 8 * dt);
  }

  private fireAtPlayer(): void {
    const chance = THREE.MathUtils.clamp(1 - this.vis.distance / AI.maxHitRange, 0.15, 0.85);
    if (Math.random() < chance) usePlayerStore.getState().damage(AI.fireDamage);
  }

  private setAction(next: THREE.AnimationAction | null): void {
    if (!next || next === this.active) return;
    const prev = this.active;
    this.active = next;
    next.reset().fadeIn(0.2).play();
    prev?.fadeOut(0.2);
  }

  private die(): void {
    this.dead = true;
    this.state = EnemyState.Dead;
    unregisterHittable(this.collider.handle);
    this.idle?.stop();
    this.walk?.stop();
    this.run?.stop();
    this.world.removeRigidBody(this.body); // corpse no longer collides
    this.root.visible = false; // body disappears
    spawnBloodStain(this.scene, this.pos.x, this.pos.z); // leave a stain
  }
}
