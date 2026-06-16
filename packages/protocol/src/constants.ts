/** Shared tunables for the multiplayer relay. Changing these is a wire-format
 *  decision — both client and server import from here so they never drift. */

/** Room codes: short, human-typable, no visually ambiguous chars (0/O, 1/I). */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MAX_PLAYERS_PER_ROOM = 8;

/** Local-player snapshot broadcast rate. Receivers interpolate between frames,
 *  so this is well below the 60 Hz simulation step to keep bandwidth sane. */
export const SNAPSHOT_HZ = 20;
export const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_HZ;

export const HANDLE_MIN = 1;
export const HANDLE_MAX = 24;

export const GAME_MODES = ["ffa"] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** socket.io namespace the game realtime traffic lives on. */
export const GAME_NAMESPACE = "/game";
