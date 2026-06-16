import { io, type Socket } from "socket.io-client";
import {
  GAME_NAMESPACE,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@recon/protocol";

/** Typed client socket: it listens for ServerToClient events and emits
 *  ClientToServer events. */
export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:8787";

let socket: GameSocket | null = null;

/** Lazily create the singleton socket (does not auto-connect). */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(`${SERVER_URL}${GAME_NAMESPACE}`, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export { SERVER_URL };
