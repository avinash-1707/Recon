import type { CreateRoomResponse, JoinAck } from "@recon/protocol";
import { useNetStore } from "@/game/state/netStore";
import { disconnectSocket, getSocket, SERVER_URL, type GameSocket } from "./socket";
import { clearPeers, removePeer } from "./remotePeers";

/**
 * Lobby/session orchestration: REST room creation + socket join, and wiring of
 * lobby-level socket events into the (reactive) net store. The per-frame relay
 * is owned by NetworkSystem; this module is what the menu UI calls.
 *
 * createRoom/joinRoom resolve on success and throw an Error (with a
 * user-facing message) on failure — the caller shows it.
 */

let wired = false;

function wireLobbyEvents(socket: GameSocket): void {
  if (wired) return;
  wired = true;
  const store = useNetStore.getState;
  socket.on("roomState", (state) => store().setPlayers(state.players));
  socket.on("playerJoined", (p) => store().upsertPlayer(p));
  socket.on("playerLeft", (id) => {
    store().removePlayer(id);
    removePeer(id);
  });
  socket.on("scoreUpdate", (players) => store().setPlayers(players));
  socket.on("disconnect", () => {
    clearPeers();
    if (store().phase !== "idle") store().setError("disconnected from server");
    store().setPhase("idle");
  });
}

function waitForConnect(socket: GameSocket, timeoutMs = 6000): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(new Error(`cannot reach server: ${err.message}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("connection timed out"));
    }, timeoutMs);
    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

function emitJoin(
  socket: GameSocket,
  roomId: string,
  handle: string,
  timeoutMs = 6000,
): Promise<JoinAck> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("join timed out")), timeoutMs);
    socket.emit("joinRoom", { roomId, handle }, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

async function connectAndJoin(roomId: string, handle: string): Promise<void> {
  const socket = getSocket();
  wireLobbyEvents(socket);
  useNetStore.getState().setPhase("connecting");
  try {
    await waitForConnect(socket);
    const ack = await emitJoin(socket, roomId, handle);
    if (!ack.ok) throw new Error(ack.error);
    useNetStore.getState().enterLobby(roomId, ack.self.id, ack.state.players);
  } catch (err) {
    useNetStore.getState().setPhase("idle");
    throw err;
  }
}

/** Create a fresh room over REST, then join it. */
export async function createRoom(handle: string): Promise<void> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ handle }),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error("could not create room");
  const data = (await res.json()) as CreateRoomResponse;
  await connectAndJoin(data.roomId, handle);
}

/** Join an existing room by code. */
export async function joinRoom(roomId: string, handle: string): Promise<void> {
  await connectAndJoin(roomId.trim().toUpperCase(), handle);
}

/** Transition the lobby into the live match. */
export function startMatch(): void {
  useNetStore.getState().setPhase("playing");
}

/** Leave the room and tear the session down. */
export function leaveRoom(): void {
  const socket = getSocket();
  if (socket.connected) socket.emit("leaveRoom");
  disconnectSocket();
  clearPeers();
  useNetStore.getState().reset();
}
