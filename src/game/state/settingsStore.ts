import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Sensitivity multipliers are applied on top of the base look constants in
 *  input.ts, so 1.0 = the tuned default. Clamp range lives in the UI. */
export const SENS_MIN = 0.25;
export const SENS_MAX = 3;
const DEFAULTS = {
  mouseSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
} as const;

export interface SettingsState {
  /** Mouse look multiplier (1.0 = default). */
  mouseSensitivity: number;
  /** Touch look multiplier (1.0 = default). */
  touchSensitivity: number;
  /** Invert vertical look. */
  invertY: boolean;

  setMouseSensitivity: (v: number) => void;
  setTouchSensitivity: (v: number) => void;
  setInvertY: (v: boolean) => void;
  reset: () => void;
}

const clamp = (v: number) => Math.min(SENS_MAX, Math.max(SENS_MIN, v));

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
      setInvertY: (v) => set({ invertY: v }),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "recon-settings" },
  ),
);
