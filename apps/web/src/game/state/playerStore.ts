import { create } from "zustand";

export enum Stance {
  Stand = "stand",
  Crouch = "crouch",
}

/**
 * Discrete, HUD-facing player state. Updated only on real transitions (not per
 * frame) so reactive subscribers re-render rarely. Per-frame motion lives in
 * `playerRuntime` instead.
 */
export interface PlayerStoreState {
  health: number;
  maxHealth: number;
  stance: Stance;
  sprinting: boolean;
  grounded: boolean;

  setStance: (s: Stance) => void;
  setSprinting: (v: boolean) => void;
  setGrounded: (v: boolean) => void;
  damage: (amount: number) => void;
  heal: (amount: number) => void;
  revive: () => void;
  reset: () => void;
}

const INITIAL = {
  health: 100,
  maxHealth: 100,
  stance: Stance.Stand,
  sprinting: false,
  grounded: false,
};

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  ...INITIAL,

  setStance: (stance) => set((s) => (s.stance === stance ? s : { stance })),
  setSprinting: (sprinting) => set((s) => (s.sprinting === sprinting ? s : { sprinting })),
  setGrounded: (grounded) => set((s) => (s.grounded === grounded ? s : { grounded })),
  damage: (amount) => set((s) => ({ health: Math.max(0, s.health - amount) })),
  heal: (amount) => set((s) => ({ health: Math.min(s.maxHealth, s.health + amount) })),
  revive: () => set((s) => ({ health: s.maxHealth })),
  reset: () => set(INITIAL),
}));
