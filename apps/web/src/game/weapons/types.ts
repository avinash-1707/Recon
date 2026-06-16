/** Weapon identities. Also used as Zustand ammo keys and slot targets. */
export enum WeaponType {
  Pistol = "pistol",
  AR = "ar",
  Sniper = "sniper",
  Knife = "knife",
}

/** Primary action state of the weapon FSM (ADS is a separate continuous axis). */
export enum WeaponAction {
  Idle = "idle",
  Firing = "firing",
  Reloading = "reloading",
}

/**
 * Fully-typed weapon configuration. Adding a weapon = adding one of these - the
 * FSM, viewmodel, hitscan, FX, and HUD all read from it. No magic numbers.
 */
export interface WeaponDef {
  readonly type: WeaponType;
  readonly name: string;
  readonly damage: number;
  /** Rounds per minute - fire interval = 60 / rpm. */
  readonly rpm: number;
  /** True = hold-to-fire, false = one shot per click. */
  readonly automatic: boolean;
  readonly magSize: number;
  readonly reserveAmmo: number;
  readonly reloadMs: number;
  /** Upward kick per shot (radians) applied to look pitch. */
  readonly recoilPitch: number;
  /** Horizontal random spread per shot (radians). */
  readonly recoilYaw: number;
  readonly hipFov: number;
  readonly adsFov: number;
  /** Hitscan max distance (m). */
  readonly range: number;
  readonly tracerColor: number;
  /** Show the sniper scope overlay when aiming. */
  readonly scope: boolean;
  /** Melee weapon: no ammo/reload/ADS, short-range swing instead of hitscan FX. */
  readonly melee: boolean;
}

/** Slot key (1/2/3/4) → weapon. */
export const WEAPON_SLOTS: Readonly<Record<number, WeaponType>> = {
  1: WeaponType.Pistol,
  2: WeaponType.AR,
  3: WeaponType.Sniper,
  4: WeaponType.Knife,
};
