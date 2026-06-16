import { create } from "zustand";

/**
 * Global world/sim flags. Read these *reactively* only for React-level config
 * (e.g. the <Physics> `paused`/`debug` props). Inside the game loop, read via
 * `useWorldStore.subscribe(...)` transient subscriptions - never a hook that
 * re-renders per frame.
 */
export interface WorldState {
  /** Freeze the simulation (physics + engine logic) but keep rendering. */
  paused: boolean;
  /** Draw Rapier collider wireframes. */
  debugPhysics: boolean;

  setPaused: (v: boolean) => void;
  togglePaused: () => void;
  toggleDebugPhysics: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  paused: false,
  debugPhysics: false,

  setPaused: (v) => set({ paused: v }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  toggleDebugPhysics: () => set((s) => ({ debugPhysics: !s.debugPhysics })),
}));
