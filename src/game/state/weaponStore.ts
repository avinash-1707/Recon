import { create } from "zustand";
import { WeaponType } from "@/game/weapons/types";
import { WEAPONS, DEFAULT_WEAPON } from "@/game/weapons/defs";

interface AmmoState {
  mag: number;
  reserve: number;
}

/** HUD-facing weapon state. Updated on discrete events (switch/shot/reload), not per frame. */
export interface WeaponStoreState {
  current: WeaponType;
  ammo: Record<WeaponType, AmmoState>;
  reloading: boolean;
  ads: boolean;

  setCurrent: (t: WeaponType) => void;
  consumeRound: () => void;
  applyReload: () => void;
  setReloading: (v: boolean) => void;
  setAds: (v: boolean) => void;
  reset: () => void;
}

function initialAmmo(): Record<WeaponType, AmmoState> {
  return {
    [WeaponType.Pistol]: { mag: WEAPONS.pistol.magSize, reserve: WEAPONS.pistol.reserveAmmo },
    [WeaponType.AR]: { mag: WEAPONS.ar.magSize, reserve: WEAPONS.ar.reserveAmmo },
    [WeaponType.Sniper]: { mag: WEAPONS.sniper.magSize, reserve: WEAPONS.sniper.reserveAmmo },
  };
}

export const useWeaponStore = create<WeaponStoreState>((set) => ({
  current: DEFAULT_WEAPON,
  ammo: initialAmmo(),
  reloading: false,
  ads: false,

  setCurrent: (t) => set((s) => (s.current === t ? s : { current: t, ads: false })),

  consumeRound: () =>
    set((s) => {
      const a = s.ammo[s.current];
      if (a.mag <= 0) return s;
      return { ammo: { ...s.ammo, [s.current]: { ...a, mag: a.mag - 1 } } };
    }),

  applyReload: () =>
    set((s) => {
      const def = WEAPONS[s.current];
      const a = s.ammo[s.current];
      const need = def.magSize - a.mag;
      const take = Math.min(need, a.reserve);
      if (take <= 0) return s;
      return {
        ammo: { ...s.ammo, [s.current]: { mag: a.mag + take, reserve: a.reserve - take } },
      };
    }),

  setReloading: (v) => set((s) => (s.reloading === v ? s : { reloading: v })),
  setAds: (v) => set((s) => (s.ads === v ? s : { ads: v })),
  reset: () =>
    set({ current: DEFAULT_WEAPON, ammo: initialAmmo(), reloading: false, ads: false }),
}));
