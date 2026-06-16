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

// Auth is optional and DB-backed: mount the Better Auth handler + derive a
// session→userId resolver only when a database is configured. Without it, the
// relay runs guest-only.
let resolveUserId: ((cookie: string) => Promise<string | null>) | undefined;
let authEnabled = false;
if (isDbConfigured()) {
  try {
    const { getAuth, userIdFromCookie } = await import("@recon/auth");
    getAuth(); // builds now → throws (disabling auth) if prod secret is missing
    app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));
    resolveUserId = userIdFromCookie;
    authEnabled = true;
  } catch (err) {
    console.error(
      "[server] auth disabled:",
      err instanceof Error ? err.message : err,
    );
  }
}

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

attachSockets(io.of(GAME_NAMESPACE), rooms, resolveUserId);

// Reap rooms left empty for 10 min (chiefly created-but-never-joined ones).
const reaper = setInterval(() => {
  const dropped = rooms.sweepIdle(10 * 60 * 1000);
  if (dropped > 0) console.log(`[server] reaped ${dropped} idle room(s)`);
}, 60 * 1000);
reaper.unref();

console.log(`[server] socket.io namespace ${GAME_NAMESPACE} ready`);
console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
console.log(
  `[server] persistence: ${isDbConfigured() ? "on (DATABASE_URL set)" : "off (in-memory only)"}`,
);
console.log(`[server] auth: ${authEnabled ? "enabled (credentials)" : "off"}`);

async function shutdown(): Promise<void> {
  console.log("\n[server] shutting down…");
  clearInterval(reaper);
  io.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
