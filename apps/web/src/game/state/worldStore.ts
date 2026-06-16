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
  /** Touch play engaged (mobile "tap to play") - drives the on-screen controls. */
  touchPlaying: boolean;

  setPaused: (v: boolean) => void;
  togglePaused: () => void;
  toggleDebugPhysics: () => void;
  setTouchPlaying: (v: boolean) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  paused: false,
  debugPhysics: false,
  touchPlaying: false,

  setPaused: (v) => set({ paused: v }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  toggleDebugPhysics: () => set((s) => ({ debugPhysics: !s.debugPhysics })),
  setTouchPlaying: (v) => set({ touchPlaying: v }),
}));
