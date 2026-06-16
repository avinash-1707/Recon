import { WeaponAction, type WeaponDef } from "@/game/weapons/types";

// Animation timings (seconds).
const RECOIL_DECAY = 0.09;
const SLIDE_TIME = 0.07;
const FIRING_TIME = 0.06;
const ADS_TIME = 0.16;
const SWITCH_TIME = 0.28;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Weapon state machine: action (Idle → Firing → Reloading) plus continuous ADS
 * and switch blends. Owns all timers and produces normalized 0..1 animation
 * outputs (recoil/slide/reload/ads/switchT) that the viewmodel crossfades into
 * pose offsets. Reload locks firing until it completes.
 */
export class WeaponFSM {
  action: WeaponAction = WeaponAction.Idle;

  // Animation outputs (0..1), read by the viewmodel.
  recoil = 0;
  slide = 0;
  reload = 0;
  ads = 0;
  switchT = 1;

  private def: WeaponDef;
  private cooldown = 0;
  private firingTimer = 0;
  private reloadTimer = 0;
  private reloadDur = 0;
  private adsTarget = false;

  constructor(def: WeaponDef) {
    this.def = def;
  }

  get fireInterval(): number {
    return 60 / this.def.rpm;
  }
  get isReloading(): boolean {
    return this.action === WeaponAction.Reloading;
  }
  get canFire(): boolean {
    return this.action !== WeaponAction.Reloading && this.cooldown <= 0;
  }

  /** Swap to a new weapon - resets state and plays the raise. */
  setDef(def: WeaponDef): void {
    this.def = def;
    this.action = WeaponAction.Idle;
    this.cooldown = 0;
    this.firingTimer = 0;
    this.reloadTimer = 0;
    this.recoil = 0;
    this.slide = 0;
    this.reload = 0;
    this.switchT = 0; // raise from lowered
  }

  /** Fire if allowed. Returns true if a shot actually went off. */
  fire(): boolean {
    if (!this.canFire) return false;
    this.cooldown = this.fireInterval;
    this.firingTimer = FIRING_TIME;
    this.action = WeaponAction.Firing;
    this.recoil = 1;
    this.slide = 1;
    return true;
  }

  /** Begin reload. Returns true if it started. */
  startReload(): boolean {
    if (this.action === WeaponAction.Reloading) return false;
    this.action = WeaponAction.Reloading;
    this.reloadDur = this.def.reloadMs / 1000;
    this.reloadTimer = this.reloadDur;
    return true;
  }

  setAdsTarget(v: boolean): void {
    this.adsTarget = v && !this.isReloading;
  }

  /** Advance timers/blends. Returns true on the frame a reload completes. */
  update(dt: number): boolean {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt / RECOIL_DECAY);
    if (this.slide > 0) this.slide = Math.max(0, this.slide - dt / SLIDE_TIME);

    if (this.firingTimer > 0) {
      this.firingTimer -= dt;
      if (this.firingTimer <= 0 && this.action === WeaponAction.Firing) {
        this.action = WeaponAction.Idle;
      }
    }

    let reloadDone = false;
    if (this.action === WeaponAction.Reloading) {
      this.reloadTimer -= dt;
      this.reload = clamp01(1 - this.reloadTimer / this.reloadDur);
      if (this.reloadTimer <= 0) {
        reloadDone = true;
        this.action = WeaponAction.Idle;
        this.reload = 0;
      }
    } else {
      this.reload = 0;
    }

    this.ads += ((this.adsTarget ? 1 : 0) - this.ads) * Math.min(1, dt / ADS_TIME);
    if (this.switchT < 1) this.switchT = Math.min(1, this.switchT + dt / SWITCH_TIME);

    return reloadDone;
  }
}
