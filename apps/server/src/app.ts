import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  createRoomSchema,
  handleSchema,
  type CreateRoomResponse,
  type RoomInfoResponse,
} from "@recon/protocol";
import { env } from "./env";
import { getPlayerStats } from "./persistence";
import type { RoomManager } from "./rooms";

/** REST surface: room creation/lookup + stats. Realtime lives on socket.io. */
export function createApp(rooms: RoomManager): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/api/rooms", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid request body" }, 400);
    }
    let room;
    try {
      room = rooms.create(parsed.data.handle, parsed.data.mode);
    } catch {
      return c.json({ error: "server at capacity, try again later" }, 503);
    }
    const res: CreateRoomResponse = {
      roomId: room.id,
      hostHandle: room.hostHandle,
      mode: room.mode,
    };
    return c.json(res, 201);
  });

  app.get("/api/rooms/:id", (c) => {
    const room = rooms.get(c.req.param("id").toUpperCase());
    if (!room) return c.json({ error: "room not found" }, 404);
    const res: RoomInfoResponse = {
      roomId: room.id,
      players: room.players.size,
      maxPlayers: room.maxPlayers,
      status: rooms.statusOf(room),
      mode: room.mode,
    };
    return c.json(res);
  });

  app.get("/api/players/:handle/stats", async (c) => {
    const handle = handleSchema.safeParse(c.req.param("handle"));
    if (!handle.success) return c.json({ error: "invalid handle" }, 400);
    const stats = await getPlayerStats(handle.data);
    if (!stats) return c.json({ error: "no stats for this handle" }, 404);
    return c.json(stats);
  });

  return app;
}
