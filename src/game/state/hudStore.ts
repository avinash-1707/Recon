import { create } from "zustand";

export enum AlertLevel {
  Calm = "calm",
  Suspicious = "suspicious",
  Alerted = "alerted",
}

/**
 * HUD-facing world awareness. `detection` (0..1) is the strongest enemy's
 * awareness of the player; it's written from the AI loop but throttled (only on
 * meaningful change) so subscribers don't re-render every frame.
 */
export type HitKind = "body" | "head";

export interface HudStoreState {
  detection: number;
  alert: AlertLevel;
  enemiesAlive: number;
  enemiesTotal: number;
  /** Increments on every confirmed hit - lets the crosshair retrigger its marker. */
  hitTick: number;
  hitKind: HitKind;
  hitKill: boolean;

  setDetection: (v: number, alert: AlertLevel) => void;
  setEnemyCounts: (alive: number, total: number) => void;
  registerHit: (headshot: boolean, killed: boolean) => void;
  reset: () => void;
}

export const useHudStore = create<HudStoreState>((set) => ({
  detection: 0,
  alert: AlertLevel.Calm,
  enemiesAlive: 0,
  enemiesTotal: 0,
  hitTick: 0,
  hitKind: "body",
  hitKill: false,

  setDetection: (v, alert) =>
    set((s) =>
      Math.abs(s.detection - v) < 0.02 && s.alert === alert ? s : { detection: v, alert },
    ),
  setEnemyCounts: (alive, total) =>
    set((s) => (s.enemiesAlive === alive && s.enemiesTotal === total ? s : { enemiesAlive: alive, enemiesTotal: total })),
  registerHit: (headshot, killed) =>
    set((s) => ({ hitTick: s.hitTick + 1, hitKind: headshot ? "head" : "body", hitKill: killed })),
  reset: () =>
    set({ detection: 0, alert: AlertLevel.Calm, enemiesAlive: 0, enemiesTotal: 0, hitTick: 0 }),
}));
