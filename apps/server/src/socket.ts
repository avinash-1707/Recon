import type { Namespace } from "socket.io";
import {
  clientSnapshotSchema,
  deathInputSchema,
  hitInputSchema,
  joinRoomSchema,
  shotInputSchema,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@recon/protocol";
import type { RoomManager } from "./rooms";

type GameNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Wire the client-authoritative relay onto the /game namespace. The server
 *  never simulates — it validates each payload, stamps the authoritative
 *  sender id, and fans events out to the socket.io room. */
export function attachSockets(
  game: GameNamespace,
  rooms: RoomManager,
  resolveUserId?: (cookie: string) => Promise<string | null>,
): void {
  // Auth handshake (only when auth is enabled): resolve the session cookie to a
  // user id so stats persist for authenticated players. No session = guest.
  if (resolveUserId) {
    game.use((socket, next) => {
      resolveUserId(socket.handshake.headers.cookie ?? "")
        .then((userId) => {
          socket.data.userId = userId;
          next();
        })
        .catch(() => {
          socket.data.userId = null;
          next();
        });
    });
  }

  game.on("connection", (socket) => {
    // Fresh connection: reset per-match fields. `userId` uses ??= so the CP6
    // auth-handshake middleware (which runs before this handler) can pre-set
    // it; handle/roomId are always reset here.
    socket.data.handle = "";
    socket.data.roomId = null;
    socket.data.userId ??= null;

    socket.on("joinRoom", (payload, ack) => {
      // One room per socket. Without this, a re-join leaks the old membership
      // (the socket lingers in the old room's player map → it never empties).
      if (socket.data.roomId) {
        ack({ ok: false, error: "already in a room" });
        return;
      }
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack({ ok: false, error: "invalid join payload" });
        return;
      }
      const { roomId, handle } = parsed.data;
      const result = rooms.join(roomId, socket.id, handle, socket.data.userId);
      if (!result.ok) {
        ack({ ok: false, error: result.error });
        return;
      }

      socket.data.handle = handle;
      socket.data.roomId = roomId;
      void socket.join(roomId);

      const meta = rooms
        .scoreboard(result.room)
        .find((p) => p.id === socket.id);
      if (meta) socket.to(roomId).emit("playerJoined", meta);

      ack({
        ok: true,
        self: { id: socket.id },
        state: rooms.toState(result.room),
      });
    });

    socket.on("state", (snapshot) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const parsed = clientSnapshotSchema.safeParse(snapshot);
      if (!parsed.success) return;
      socket.to(roomId).emit("peerState", { ...parsed.data, id: socket.id });
    });

    socket.on("shot", (input) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const parsed = shotInputSchema.safeParse(input);
      if (!parsed.success) return;
      socket.to(roomId).emit("peerShot", { ...parsed.data, shooterId: socket.id });
    });

    socket.on("hit", (input) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const parsed = hitInputSchema.safeParse(input);
      if (!parsed.success) return;
      // Confine to the sender's room: the target must be a co-member. Otherwise
      // a client could inject damage into an unrelated match with any socket id.
      const room = rooms.get(roomId);
      if (!room || !room.players.has(parsed.data.targetId)) return;
      // Deliver only to the target, who applies the damage to its local player.
      game.to(parsed.data.targetId).emit("peerHit", {
        ...parsed.data,
        shooterId: socket.id,
      });
    });

    socket.on("death", (input) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const parsed = deathInputSchema.safeParse(input);
      if (!parsed.success) return;
      const room = rooms.recordDeath(roomId, socket.id, parsed.data.killerId);
      game.to(roomId).emit("peerDeath", {
        victimId: socket.id,
        killerId: parsed.data.killerId,
      });
      if (room) game.to(roomId).emit("scoreUpdate", rooms.scoreboard(room));
    });

    socket.on("leaveRoom", () => handleLeave(socket.id));
    socket.on("disconnect", () => handleLeave(socket.id));

    function handleLeave(socketId: string): void {
      const affected = rooms.leave(socketId);
      for (const { room, emptied } of affected) {
        if (emptied) continue;
        game.to(room.id).emit("playerLeft", socketId);
        game.to(room.id).emit("scoreUpdate", rooms.scoreboard(room));
      }
      socket.data.roomId = null;
    }
  });
}
