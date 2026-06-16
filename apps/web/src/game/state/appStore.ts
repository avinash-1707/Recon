import { create } from "zustand";

/** Top-level app screen. "menu" shows the main menu; the others mount the game
 *  canvas in the matching mode. */
export type AppMode = "menu" | "single" | "multiplayer";

/** The two in-game modes (everything that isn't the menu). */
export type GameMode = Exclude<AppMode, "menu">;

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: "menu",
  setMode: (mode) => set({ mode }),
}));
