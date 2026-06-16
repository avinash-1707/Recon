import { create } from "zustand";
import type { PlayerMeta } from "@recon/protocol";

export type NetPhase = "idle" | "connecting" | "lobby" | "playing";

/**
 * Multiplayer session state (lobby roster, connection phase). Reactive — the
 * menu/lobby UI subscribes to it. Per-frame peer transforms do NOT live here
 * (those are in the non-reactive peer registry, src/game/net/remotePeers.ts).
 */
export interface NetState {
  phase: NetPhase;
  roomId: string | null;
  selfId: string | null;
  handle: string;
  players: PlayerMeta[];
  error: string | null;

  setPhase: (phase: NetPhase) => void;
  setHandle: (handle: string) => void;
  setError: (error: string | null) => void;
  enterLobby: (roomId: string, selfId: string, players: PlayerMeta[]) => void;
  setPlayers: (players: PlayerMeta[]) => void;
  upsertPlayer: (player: PlayerMeta) => void;
  removePlayer: (id: string) => void;
  reset: () => void;
}

const INITIAL = {
  phase: "idle" as NetPhase,
  roomId: null,
  selfId: null,
  handle: "",
  players: [] as PlayerMeta[],
  error: null,
};

export const useNetStore = create<NetState>((set) => ({
  ...INITIAL,

  setPhase: (phase) => set({ phase }),
  setHandle: (handle) => set({ handle }),
  setError: (error) => set({ error }),
  enterLobby: (roomId, selfId, players) =>
    set({ roomId, selfId, players, phase: "lobby", error: null }),
  setPlayers: (players) => set({ players }),
  upsertPlayer: (player) =>
    set((s) => {
      const i = s.players.findIndex((p) => p.id === player.id);
      if (i === -1) return { players: [...s.players, player] };
      const players = s.players.slice();
      players[i] = player;
      return { players };
    }),
  removePlayer: (id) =>
    set((s) => ({ players: s.players.filter((p) => p.id !== id) })),
  // Preserve the chosen handle across resets so a player needn't retype it.
  reset: () => set((s) => ({ ...INITIAL, handle: s.handle })),
}));
