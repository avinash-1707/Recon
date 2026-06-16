import {
  getDb,
  isDbConfigured,
  matchPlayers,
  matches,
  playerStats,
  rooms as roomsTable,
} from "@recon/db";
import { eq, sql } from "drizzle-orm";
import type { PlayerStatsResponse } from "@recon/protocol";
import type { Room, RoomPlayer } from "./rooms";

/** Write the room row when it's created (so it's look-up-able / survives restart). */
export async function mirrorRoom(room: Room): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await getDb()
      .insert(roomsTable)
      .values({
        id: room.id,
        hostHandle: room.hostHandle,
        mode: room.mode,
        maxPlayers: room.maxPlayers,
        status: "open",
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[persistence] mirrorRoom failed:", err);
  }
}

function winnerOf(participants: RoomPlayer[]): string | null {
  let best: RoomPlayer | null = null;
  for (const p of participants) {
    if (!best || p.kills > best.kills) best = p;
  }
  return best && best.kills > 0 ? best.handle : null;
}

/** Persist the finished match and bump lifetime stats for authed players. */
export async function finalizeMatch(room: Room): Promise<void> {
  if (!isDbConfigured()) return;
  const participants = [...room.participants.values()];
  if (participants.length === 0) return;

  try {
    const db = getDb();
    const [match] = await db
      .insert(matches)
      .values({
        roomId: room.id,
        mode: room.mode,
        endedAt: new Date(),
        winnerHandle: winnerOf(participants),
      })
      .returning({ id: matches.id });

    if (!match) return;

    await db.insert(matchPlayers).values(
      participants.map((p) => ({
        matchId: match.id,
        handle: p.handle,
        userId: p.userId,
        kills: p.kills,
        deaths: p.deaths,
      })),
    );

    // Lifetime stats persist for authenticated players only (CP6 wires userId).
    for (const p of participants) {
      if (!p.userId) continue;
      await db
        .insert(playerStats)
        .values({
          userId: p.userId,
          kills: p.kills,
          deaths: p.deaths,
          matchesPlayed: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: playerStats.userId,
          set: {
            kills: sql`${playerStats.kills} + ${p.kills}`,
            deaths: sql`${playerStats.deaths} + ${p.deaths}`,
            matchesPlayed: sql`${playerStats.matchesPlayed} + 1`,
            updatedAt: new Date(),
          },
        });
    }

    await db
      .update(roomsTable)
      .set({ status: "closed" })
      .where(eq(roomsTable.id, room.id));
  } catch (err) {
    console.error("[persistence] finalizeMatch failed:", err);
  }
}

/** Aggregate a handle's results across matches. Authenticated users also have a
 *  denormalized player_stats row, but aggregating match_players works for any
 *  handle (guests included). */
export async function getPlayerStats(
  handle: string,
): Promise<PlayerStatsResponse | null> {
  if (!isDbConfigured()) return null;
  try {
    const rows = await getDb()
      .select({
        kills: sql<number>`coalesce(sum(${matchPlayers.kills}), 0)`,
        deaths: sql<number>`coalesce(sum(${matchPlayers.deaths}), 0)`,
        matchesPlayed: sql<number>`count(*)`,
      })
      .from(matchPlayers)
      .where(eq(matchPlayers.handle, handle));
    const row = rows[0];
    if (!row || Number(row.matchesPlayed) === 0) return null;
    return {
      handle,
      kills: Number(row.kills),
      deaths: Number(row.deaths),
      matchesPlayed: Number(row.matchesPlayed),
    };
  } catch (err) {
    console.error("[persistence] getPlayerStats failed:", err);
    return null;
  }
}
