import { z } from "zod";
import { handleSchema, gameModeSchema } from "./schemas";
import type { GameMode } from "./constants";

export const createRoomSchema = z.object({
  handle: handleSchema,
  mode: gameModeSchema.default("ffa"),
});
export type CreateRoomBody = z.infer<typeof createRoomSchema>;

export interface CreateRoomResponse {
  roomId: string;
  hostHandle: string;
  mode: GameMode;
}

export interface RoomInfoResponse {
  roomId: string;
  players: number;
  maxPlayers: number;
  status: "open" | "full" | "closed";
  mode: GameMode;
}

export interface PlayerStatsResponse {
  handle: string;
  kills: number;
  deaths: number;
  matchesPlayed: number;
}

export interface ApiError {
  error: string;
}
