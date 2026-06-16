import { randomInt } from "node:crypto";
import {
  MAX_PLAYERS_PER_ROOM,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type GameMode,
  type PlayerMeta,
  type RoomState,
} from "@recon/protocol";
import { finalizeMatch, mirrorRoom } from "./persistence";

/** Hard cap on simultaneously live rooms — a backstop against creation spam
 *  exhausting memory (paired with the idle sweep in index.ts). */
const MAX_LIVE_ROOMS = 5000;

export interface RoomPlayer {
  id: string; // socket id
  handle: string;
  userId: string | null;
  kills: number;
  deaths: number;
}

export interface Room {
  id: string;
  hostHandle: string;
  mode: GameMode;
  maxPlayers: number;
  /** currently connected players */
  players: Map<string, RoomPlayer>;
  /** everyone who joined for this match (kept after they leave, for the record) */
  participants: Map<string, RoomPlayer>;
  startedAt: number;
}

function playerMeta(p: RoomPlayer): PlayerMeta {
  return {
    id: p.id,
    handle: p.handle,
    kills: p.kills,
    deaths: p.deaths,
    authed: p.userId !== null,
  };
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  private generateCode(): string {
    for (let attempt = 0; attempt < 16; attempt++) {
      let code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("could not allocate a unique room code");
  }

  create(hostHandle: string, mode: GameMode): Room {
    if (this.rooms.size >= MAX_LIVE_ROOMS) {
      throw new Error("server at room capacity");
    }
    const room: Room = {
      id: this.generateCode(),
      hostHandle,
      mode,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      players: new Map(),
      participants: new Map(),
      startedAt: Date.now(),
    };
    this.rooms.set(room.id, room);
    void mirrorRoom(room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  statusOf(room: Room): "open" | "full" | "closed" {
    if (room.players.size >= room.maxPlayers) return "full";
    return "open";
  }

  /** Add a connected player. Returns the room state, or an error string. */
  join(
    roomId: string,
    socketId: string,
    handle: string,
    userId: string | null,
  ): { ok: true; room: Room } | { ok: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, error: "room not found" };
    if (room.players.size >= room.maxPlayers) {
      return { ok: false, error: "room is full" };
    }
    const player: RoomPlayer = {
      id: socketId,
      handle,
      userId,
      kills: 0,
      deaths: 0,
    };
    room.players.set(socketId, player);
    room.participants.set(socketId, player);
    return { ok: true, room };
  }

  /** Credit a kill/death. Returns the affected room (for re-broadcast). */
  recordDeath(
    roomId: string,
    victimId: string,
    killerId: string | null,
  ): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const victim = room.players.get(victimId);
    if (victim) victim.deaths += 1;
    if (killerId && killerId !== victimId) {
      const killer = room.players.get(killerId);
      if (killer) killer.kills += 1;
    }
    return room;
  }

  /** Remove a player from whatever room(s) it's in (normally one). Finalizes +
   *  deletes any room that empties. Returns every affected room so the caller
   *  can broadcast. Scanning all rooms makes a stray double-membership
   *  self-heal rather than leak. */
  leave(socketId: string): { room: Room; emptied: boolean }[] {
    const affected: { room: Room; emptied: boolean }[] = [];
    for (const room of this.rooms.values()) {
      if (!room.players.has(socketId)) continue;
      room.players.delete(socketId);
      affected.push({ room, emptied: room.players.size === 0 });
    }
    for (const entry of affected) {
      if (entry.emptied) {
        this.rooms.delete(entry.room.id);
        void finalizeMatch(entry.room);
      }
    }
    return affected;
  }

  /** Drop rooms empty past the TTL — chiefly rooms created over REST but never
   *  joined, which never reach the leave() path. */
  sweepIdle(maxIdleMs: number, now = Date.now()): number {
    const stale: Room[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.size === 0 && now - room.startedAt > maxIdleMs) {
        stale.push(room);
      }
    }
    for (const room of stale) this.rooms.delete(room.id);
    return stale.length;
  }

  toState(room: Room): RoomState {
    return {
      roomId: room.id,
      mode: room.mode,
      players: [...room.players.values()].map(playerMeta),
    };
  }

  scoreboard(room: Room): PlayerMeta[] {
    return [...room.players.values()].map(playerMeta);
  }
}

export { playerMeta };
