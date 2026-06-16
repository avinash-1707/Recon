import { z } from "zod";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  ROOM_CODE_LENGTH,
  GAME_MODES,
  type GameMode,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof vec3Schema>;

export const handleSchema = z.string().trim().min(HANDLE_MIN).max(HANDLE_MAX);

// Normalize to uppercase at the boundary so REST lookup and socket join agree
// on the canonical code regardless of how the user typed it.
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(/^[A-Z0-9]+$/, "room code must be alphanumeric");

export const stanceSchema = z.enum(["stand", "crouch"]);
export type Stance = z.infer<typeof stanceSchema>;

export const gameModeSchema = z.enum(GAME_MODES);

// ---------------------------------------------------------------------------
// Snapshots — the per-tick player state relayed between peers.
// Clients send the "self" snapshot (no id); the server stamps the socket id
// before broadcasting, so a client can never spoof another player's id.
// ---------------------------------------------------------------------------

export const clientSnapshotSchema = z.object({
  pos: vec3Schema,
  yaw: z.number(),
  pitch: z.number(),
  vel: vec3Schema,
  stance: stanceSchema,
  weapon: z.string().max(32),
  health: z.number().min(0).max(1000),
  /** client send time (ms, performance.now-based) used for receiver interpolation */
  t: z.number().nonnegative(),
});
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>;

export const peerSnapshotSchema = clientSnapshotSchema.extend({
  id: z.string(),
});
export type PeerSnapshot = z.infer<typeof peerSnapshotSchema>;

// ---------------------------------------------------------------------------
// Combat events. Client sends the input form; server stamps the authoritative
// shooter/victim id (= the emitting socket) before relaying.
// ---------------------------------------------------------------------------

export const shotInputSchema = z.object({
  origin: vec3Schema,
  dir: vec3Schema,
  weapon: z.string().max(32),
  tracerColor: z.string().max(16).optional(),
});
export type ShotInput = z.infer<typeof shotInputSchema>;
export type ShotEvent = ShotInput & { shooterId: string };

export const hitInputSchema = z.object({
  targetId: z.string(),
  damage: z.number().min(0).max(1000),
  headshot: z.boolean(),
});
export type HitInput = z.infer<typeof hitInputSchema>;
export type HitEvent = HitInput & { shooterId: string };

export const deathInputSchema = z.object({
  killerId: z.string().nullable(),
});
export type DeathInput = z.infer<typeof deathInputSchema>;
export type DeathEvent = { victimId: string; killerId: string | null };

// ---------------------------------------------------------------------------
// Room / lobby
// ---------------------------------------------------------------------------

export const joinRoomSchema = z.object({
  roomId: roomCodeSchema,
  handle: handleSchema,
});
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export interface PlayerMeta {
  /** socket id — the stable per-connection identity for a match */
  id: string;
  handle: string;
  kills: number;
  deaths: number;
  /** true when backed by an authenticated user (stats persist) */
  authed: boolean;
}

export interface RoomState {
  roomId: string;
  mode: GameMode;
  players: PlayerMeta[];
}

export type JoinAck =
  | { ok: true; self: { id: string }; state: RoomState }
  | { ok: false; error: string };
