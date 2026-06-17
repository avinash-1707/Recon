import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Sensitivity multipliers are applied on top of the base look constants in
 *  input.ts, so 1.0 = the tuned default. Clamp range lives in the UI. */
export const SENS_MIN = 0.25;
export const SENS_MAX = 3;
/** Aim-down-sights multipliers can go lower (scopes want slow look). */
export const ADS_SENS_MIN = 0.1;
export const ADS_SENS_MAX = 2;
/** Render distance (metres). Buildings beyond this are hidden to cut draw calls.
 *  Default sits just past the fog end (70m) so culling is invisible behind fog. */
export const RENDER_DIST_MIN = 40;
export const RENDER_DIST_MAX = 160;
const DEFAULTS = {
  mouseSensitivity: 1,
  touchSensitivity: 1,
  adsRedDotSensitivity: 1,
  adsScopeSensitivity: 1,
  invertY: false,
  renderDistance: 75,
} as const;

export interface SettingsState {
  /** Mouse look multiplier (1.0 = default). */
  mouseSensitivity: number;
  /** Touch look multiplier (1.0 = default). */
  touchSensitivity: number;
  /** ADS look multiplier for non-scoped weapons (red dot / iron sights). */
  adsRedDotSensitivity: number;
  /** ADS look multiplier for scoped weapons (sniper). */
  adsScopeSensitivity: number;
  /** Invert vertical look. */
  invertY: boolean;
  /** Building render distance in metres (draw-call budget vs. view depth). */
  renderDistance: number;

  setMouseSensitivity: (v: number) => void;
  setTouchSensitivity: (v: number) => void;
  setAdsRedDotSensitivity: (v: number) => void;
  setAdsScopeSensitivity: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setRenderDistance: (v: number) => void;
  reset: () => void;
}

const clamp = (v: number) => Math.min(SENS_MAX, Math.max(SENS_MIN, v));
const clampAds = (v: number) => Math.min(ADS_SENS_MAX, Math.max(ADS_SENS_MIN, v));
const clampDist = (v: number) =>
  Math.round(Math.min(RENDER_DIST_MAX, Math.max(RENDER_DIST_MIN, v)));

/**
 * Persisted player settings (localStorage). Read transiently in the game loop
 * via `useSettingsStore.getState()` - never with a per-frame hook.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMouseSensitivity: (v) => set({ mouseSensitivity: clamp(v) }),
      setTouchSensitivity: (v) => set({ touchSensitivity: clamp(v) }),
      setAdsRedDotSensitivity: (v) => set({ adsRedDotSensitivity: clampAds(v) }),
      setAdsScopeSensitivity: (v) => set({ adsScopeSensitivity: clampAds(v) }),
      setInvertY: (v) => set({ invertY: v }),
      setRenderDistance: (v) => set({ renderDistance: clampDist(v) }),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "recon-settings" },
  ),
);
