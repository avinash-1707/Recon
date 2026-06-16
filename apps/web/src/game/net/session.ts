import type {
  CreateRoomResponse,
  JoinAck,
  PlayerMeta,
  RoomState,
} from "@recon/protocol";
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

interface LobbyHandlers {
  roomState: (state: RoomState) => void;
  playerJoined: (player: PlayerMeta) => void;
  playerLeft: (id: string) => void;
  scoreUpdate: (players: PlayerMeta[]) => void;
  disconnect: () => void;
}

// Stored so we can remove them again on leave. The socket is a singleton reused
// across sessions, so listeners MUST be torn down or they leak / double-fire.
let lobbyHandlers: LobbyHandlers | null = null;

function wireLobbyEvents(socket: GameSocket): void {
  if (lobbyHandlers) return;
  const store = useNetStore.getState;
  const handlers: LobbyHandlers = {
    roomState: (state) => store().setPlayers(state.players),
    playerJoined: (player) => store().upsertPlayer(player),
    playerLeft: (id) => {
      store().removePlayer(id);
      removePeer(id);
    },
    scoreUpdate: (players) => store().setPlayers(players),
    disconnect: () => {
      // Only reached for unintended drops — leaveRoom unwires first.
      clearPeers();
      if (store().phase !== "idle") store().setError("disconnected from server");
      store().setPhase("idle");
    },
  };
  socket.on("roomState", handlers.roomState);
  socket.on("playerJoined", handlers.playerJoined);
  socket.on("playerLeft", handlers.playerLeft);
  socket.on("scoreUpdate", handlers.scoreUpdate);
  socket.on("disconnect", handlers.disconnect);
  lobbyHandlers = handlers;
}

function unwireLobbyEvents(socket: GameSocket): void {
  if (!lobbyHandlers) return;
  socket.off("roomState", lobbyHandlers.roomState);
  socket.off("playerJoined", lobbyHandlers.playerJoined);
  socket.off("playerLeft", lobbyHandlers.playerLeft);
  socket.off("scoreUpdate", lobbyHandlers.scoreUpdate);
  socket.off("disconnect", lobbyHandlers.disconnect);
  lobbyHandlers = null;
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
  // Remove listeners BEFORE disconnecting so the disconnect handler doesn't
  // fire its "disconnected from server" error on an intentional leave.
  unwireLobbyEvents(socket);
  if (socket.connected) socket.emit("leaveRoom");
  disconnectSocket();
  clearPeers();
  useNetStore.getState().reset();
}
