/**
 * End-to-end relay smoke test. Boots nothing itself — point it at a running
 * server: `PORT=8799 bun scripts/smoke.ts` (defaults to 8787).
 *
 * Exercises: REST room creation → two clients join → snapshot relay → hit
 * delivery to the target only → death tally + scoreUpdate. Exits non-zero on
 * any failed assertion.
 */
import { io, type Socket } from "socket.io-client";
import {
  GAME_NAMESPACE,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type ServerToClientEvents,
} from "@recon/protocol";

const PORT = Number(process.env.PORT ?? 8787);
const BASE = `http://localhost:${PORT}`;

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`✓ ${msg}`);
}

function waitFor<E extends keyof ServerToClientEvents>(
  socket: GameSocket,
  event: E,
  label: string,
  timeoutMs = 2000,
): Promise<Parameters<ServerToClientEvents[E]>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for "${label}"`)),
      timeoutMs,
    );
    const once = socket.once.bind(socket) as (
      e: string,
      cb: (...a: unknown[]) => void,
    ) => void;
    once(event as string, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args as Parameters<ServerToClientEvents[E]>);
    });
  });
}

function connect(): GameSocket {
  return io(`${BASE}${GAME_NAMESPACE}`, {
    transports: ["websocket"],
    forceNew: true,
  });
}

function joinRoom(socket: GameSocket, roomId: string, handle: string) {
  return new Promise<{ id: string }>((resolve, reject) => {
    socket.emit("joinRoom", { roomId, handle }, (res) => {
      if (res.ok) resolve(res.self);
      else reject(new Error(res.error));
    });
  });
}

async function main(): Promise<void> {
  // 1. Create a room over REST.
  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle: "host" }),
  });
  if (createRes.status !== 201) fail(`POST /api/rooms -> ${createRes.status}`);
  const { roomId } = (await createRes.json()) as CreateRoomResponse;
  ok(`created room ${roomId}`);

  // 2. Two clients connect + join.
  const a = connect();
  const b = connect();
  await Promise.all([
    new Promise<void>((r) => a.on("connect", () => r())),
    new Promise<void>((r) => b.on("connect", () => r())),
  ]);

  // B should be told when A joins (A joins after B is in the room).
  const selfB = await joinRoom(b, roomId, "bravo");
  const joinedSeen = waitFor(a, "playerJoined", "playerJoined").catch(() => null);
  const selfA = await joinRoom(a, roomId, "alpha");
  ok(`both joined (A=${selfA.id.slice(0, 6)}, B=${selfB.id.slice(0, 6)})`);

  // 3. Snapshot relay: A -> B.
  const peerStateP = waitFor(b, "peerState", "peerState");
  a.emit("state", {
    pos: [1, 2, 3],
    yaw: 0.5,
    pitch: 0,
    vel: [0, 0, 0],
    stance: "stand",
    weapon: "pistol",
    health: 100,
    t: 0,
  });
  const [snap] = await peerStateP;
  if (snap.id !== selfA.id) fail(`peerState id ${snap.id} != A ${selfA.id}`);
  if (snap.pos[0] !== 1) fail("peerState pos not relayed");
  ok("snapshot relayed A -> B with stamped id");

  // 4. Hit is delivered ONLY to the target (B), stamped with shooterId.
  const peerHitP = waitFor(b, "peerHit", "peerHit");
  let aGotHit = false;
  a.once("peerHit", () => (aGotHit = true));
  a.emit("hit", { targetId: selfB.id, damage: 40, headshot: true });
  const [hit] = await peerHitP;
  if (hit.shooterId !== selfA.id) fail("peerHit shooterId not stamped");
  if (hit.damage !== 40 || !hit.headshot) fail("peerHit payload wrong");
  await new Promise((r) => setTimeout(r, 150));
  if (aGotHit) fail("shooter wrongly received its own hit");
  ok("hit delivered to target only, shooterId stamped");

  // 5. Death tally + scoreUpdate broadcast.
  const peerDeathP = waitFor(a, "peerDeath", "peerDeath");
  const scoreP = waitFor(a, "scoreUpdate", "scoreUpdate");
  b.emit("death", { killerId: selfA.id });
  const [death] = await peerDeathP;
  if (death.victimId !== selfB.id || death.killerId !== selfA.id) {
    fail("peerDeath ids wrong");
  }
  const [score] = await scoreP;
  const alpha = score.find((p) => p.id === selfA.id);
  const bravo = score.find((p) => p.id === selfB.id);
  if (alpha?.kills !== 1) fail(`A kills ${alpha?.kills} != 1`);
  if (bravo?.deaths !== 1) fail(`B deaths ${bravo?.deaths} != 1`);
  ok("death tallied: A.kills=1, B.deaths=1");

  await joinedSeen; // best-effort; ignore result
  a.close();
  b.close();
  console.log("\nALL RELAY CHECKS PASSED");
  process.exit(0);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
