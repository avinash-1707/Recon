import { WeaponType, type WeaponDef } from "@/game/weapons/types";

const HIP_FOV = 70;

export const WEAPONS: Readonly<Record<WeaponType, WeaponDef>> = {
  [WeaponType.Pistol]: {
    type: WeaponType.Pistol,
    name: "M9 Pistol",
    damage: 26,
    rpm: 360,
    automatic: false,
    magSize: 15,
    reserveAmmo: 60,
    reloadMs: 1100,
    recoilPitch: 0.018,
    recoilYaw: 0.01,
    hipFov: HIP_FOV,
    adsFov: 52,
    range: 80,
    tracerColor: 0xffd27f,
    scope: false,
  },
  [WeaponType.AR]: {
    type: WeaponType.AR,
    name: "AR-15",
    damage: 22,
    rpm: 720,
    automatic: true,
    magSize: 30,
    reserveAmmo: 120,
    reloadMs: 1700,
    recoilPitch: 0.012,
    recoilYaw: 0.012,
    hipFov: HIP_FOV,
    adsFov: 45,
    range: 150,
    tracerColor: 0xffb24c,
    scope: false,
  },
  [WeaponType.Sniper]: {
    type: WeaponType.Sniper,
    name: "Bolt Sniper",
    damage: 120,
    rpm: 50,
    automatic: false,
    magSize: 5,
    reserveAmmo: 25,
    reloadMs: 2600,
    recoilPitch: 0.05,
    recoilYaw: 0.006,
    hipFov: HIP_FOV,
    adsFov: 18,
    range: 300,
    tracerColor: 0xbfe9ff,
    scope: true,
  },
};

export const DEFAULT_WEAPON = WeaponType.Pistol;
