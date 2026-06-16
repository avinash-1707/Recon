import type {
  ClientSnapshot,
  DeathEvent,
  DeathInput,
  HitEvent,
  HitInput,
  JoinAck,
  JoinRoomPayload,
  PeerSnapshot,
  PlayerMeta,
  RoomState,
  ShotEvent,
  ShotInput,
} from "./schemas";

/** Events the server emits to clients. Wire these as the socket.io-client
 *  ListenEvents and the server Server EmitEvents. */
export interface ServerToClientEvents {
  roomState: (state: RoomState) => void;
  playerJoined: (player: PlayerMeta) => void;
  playerLeft: (id: string) => void;
  peerState: (snapshot: PeerSnapshot) => void;
  peerShot: (event: ShotEvent) => void;
  /** delivered to the hit target so it applies damage locally */
  peerHit: (event: HitEvent) => void;
  /** broadcast to the room so everyone updates the scoreboard / despawns */
  peerDeath: (event: DeathEvent) => void;
  scoreUpdate: (players: PlayerMeta[]) => void;
}

/** Events clients emit to the server. */
export interface ClientToServerEvents {
  joinRoom: (payload: JoinRoomPayload, ack: (res: JoinAck) => void) => void;
  leaveRoom: () => void;
  state: (snapshot: ClientSnapshot) => void;
  shot: (input: ShotInput) => void;
  hit: (input: HitInput) => void;
  death: (input: DeathInput) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

/** Per-socket server-side context. Populated on connect/join. */
export interface SocketData {
  handle: string;
  roomId: string | null;
  /** set when the handshake carried an authenticated session (CP6) */
  userId: string | null;
}
