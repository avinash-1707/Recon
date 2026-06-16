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
export function attachSockets(game: GameNamespace, rooms: RoomManager): void {
  game.on("connection", (socket) => {
    socket.data.handle = "";
    socket.data.roomId = null;
    // userId is populated by the auth handshake middleware in CP6.
    socket.data.userId ??= null;

    socket.on("joinRoom", (payload, ack) => {
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
      const left = rooms.leave(socketId);
      if (!left) return;
      if (!left.emptied) {
        game.to(left.room.id).emit("playerLeft", socketId);
        game.to(left.room.id).emit("scoreUpdate", rooms.scoreboard(left.room));
      }
    }
  });
}
