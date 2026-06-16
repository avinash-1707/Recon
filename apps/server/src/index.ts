import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import {
  GAME_NAMESPACE,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@recon/protocol";
import { isDbConfigured, closeDb } from "@recon/db";
import { createApp } from "./app";
import { env } from "./env";
import { RoomManager } from "./rooms";
import { attachSockets } from "./socket";

const rooms = new RoomManager();
const app = createApp(rooms);

const httpServer = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[server] HTTP ready on http://localhost:${info.port}`);
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer as HttpServer, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true },
});

attachSockets(io.of(GAME_NAMESPACE), rooms);

console.log(`[server] socket.io namespace ${GAME_NAMESPACE} ready`);
console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
console.log(
  `[server] persistence: ${isDbConfigured() ? "on (DATABASE_URL set)" : "off (in-memory only)"}`,
);

async function shutdown(): Promise<void> {
  console.log("\n[server] shutting down…");
  io.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
