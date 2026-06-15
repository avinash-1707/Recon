import * as THREE from "three";
import type { World } from "@dimforge/rapier3d-compat";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { input } from "@/game/systems/input";
import { playerRuntime, weaponRuntime } from "@/game/state/runtime";
import { WeaponType, WEAPON_SLOTS, type WeaponDef } from "@/game/weapons/types";
import { WEAPONS } from "@/game/weapons/defs";
import { WeaponFSM } from "@/game/weapons/fsm";
import { useWeaponStore } from "@/game/state/weaponStore";
import { castShot, type ShotHit } from "@/game/physics/raycast";
import type { FxSystem } from "@/game/systems/effects";
import type { AudioSystem } from "@/game/systems/audio";
import { reportHit } from "@/game/systems/combat";

const MAX_PITCH = THREE.MathUtils.degToRad(88);
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Drives firing: reads input, runs the weapon FSM (fire/reload/ADS/switch),
 * performs hitscan, applies recoil to look, spawns pooled FX, and syncs ammo +
 * camera FOV. Logic only — the viewmodel reads `weaponRuntime` for visuals.
 */
export class WeaponSystem implements GameModule {
  readonly id = "system.weapons";
  readonly order = SystemOrder.Weapons;

  private cam: THREE.PerspectiveCamera | null = null;
  private world: World | null = null;
  private current: WeaponType = WeaponType.Pistol;
  private readonly fsm = new WeaponFSM(WEAPONS[WeaponType.Pistol]);
  private prevFire = false;
  private readonly hit: ShotHit = {
    hit: false,
    point: new THREE.Vector3(),
    collider: null,
    distance: 0,
  };

  constructor(
    private readonly fx: FxSystem,
    private readonly audio: AudioSystem,
  ) {}

  /** Begin a reload (if possible) and fire its audio. */
  private beginReload(def: WeaponDef): void {
    if (this.fsm.startReload()) {
      useWeaponStore.getState().setReloading(true);
      this.audio.playReload(def.reloadMs);
    }
  }

  init(ctx: GameContext): void {
    this.cam = ctx.camera;
    this.world = ctx.world;
    this.current = useWeaponStore.getState().current;
    this.fsm.setDef(WEAPONS[this.current]);
    this.fsm.switchT = 1; // start raised
  }

  update(dt: number): void {
    const cam = this.cam;
    const world = this.world;
    if (!cam || !world) return;
    const store = useWeaponStore.getState();

    // weapon switch (locked during reload)
    if (input.weaponSlot !== 0) {
      const t = WEAPON_SLOTS[input.weaponSlot];
      if (t !== undefined && t !== this.current && !this.fsm.isReloading) {
        this.current = t;
        store.setCurrent(t);
        this.fsm.setDef(WEAPONS[t]);
        this.audio.playSwitch();
      }
    }
    const def = WEAPONS[this.current];

    // aim-down-sights
    this.fsm.setAdsTarget(input.aim);
    store.setAds(input.aim && !this.fsm.isReloading);

    // manual reload (R)
    const ammo = store.ammo[this.current];
    if (input.reloadPressed && ammo.mag < def.magSize && ammo.reserve > 0) {
      this.beginReload(def);
    }

    // fire (auto = held, semi = rising edge)
    const fireEdge = input.fire && !this.prevFire;
    const wantFire = def.automatic ? input.fire : fireEdge;
    this.prevFire = input.fire;

    if (wantFire && !this.fsm.isReloading) {
      if (ammo.mag > 0 && this.fsm.canFire && this.fsm.fire()) {
        store.consumeRound();
        this.audio.playShot(def.type);
        this.shoot(cam, world, def);
        // auto-reload the instant the mag runs dry
        const after = useWeaponStore.getState().ammo[this.current];
        if (after.mag === 0 && after.reserve > 0) this.beginReload(def);
      } else if (ammo.mag === 0) {
        if (ammo.reserve > 0) this.beginReload(def);
        else if (fireEdge) this.audio.playDryFire();
      }
    }

    // advance FSM; complete reload
    if (this.fsm.update(dt)) {
      store.applyReload();
      store.setReloading(false);
    }

    // publish animation outputs for the viewmodel
    weaponRuntime.recoil = this.fsm.recoil;
    weaponRuntime.slide = this.fsm.slide;
    weaponRuntime.reload = this.fsm.reload;
    weaponRuntime.ads = this.fsm.ads;
    weaponRuntime.switchT = this.fsm.switchT;

    // FOV blend for ADS
    const fov = THREE.MathUtils.lerp(def.hipFov, def.adsFov, this.fsm.ads);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  private shoot(cam: THREE.PerspectiveCamera, world: World, def: WeaponDef): void {
    cam.getWorldPosition(_origin);
    cam.getWorldDirection(_dir); // unit, -Z forward

    // recoil → look kick (player compensates with the mouse)
    playerRuntime.pitch = Math.min(playerRuntime.pitch + def.recoilPitch, MAX_PITCH);
    playerRuntime.yaw += (Math.random() * 2 - 1) * def.recoilYaw;

    castShot(world, _origin, _dir, def.range, this.hit);

    // tracer originates at the muzzle (published by the viewmodel)
    const from = weaponRuntime.muzzlePos.lengthSq() > 0 ? weaponRuntime.muzzlePos : _origin;
    this.fx.spawnTracer(from, this.hit.point, def.tracerColor);
    this.fx.spawnMuzzleFlash(from, def.tracerColor);

    // damage resolution (enemies register their colliders; Step 7)
    if (this.hit.hit && this.hit.collider) {
      reportHit(this.hit.collider.handle, def.damage, this.hit.point);
    }
  }

  dispose(): void {
    this.cam = null;
    this.world = null;
  }
}
