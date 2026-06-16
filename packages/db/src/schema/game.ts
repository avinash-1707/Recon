import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Live + historical rooms. The in-memory room manager is the source of truth
 *  during play; this row lets rooms be looked up and survive a restart. */
export const rooms = pgTable("rooms", {
  id: text().primaryKey(), // short room code
  hostHandle: text().notNull(),
  mode: text().notNull().default("ffa"),
  status: text().notNull().default("open"), // open | full | closed
  maxPlayers: integer().notNull().default(8),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** One finished (or in-progress) match. */
export const matches = pgTable("matches", {
  id: uuid().primaryKey().defaultRandom(),
  roomId: text().notNull(),
  mode: text().notNull().default("ffa"),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp({ withTimezone: true }),
  winnerHandle: text(),
});

/** Per-player result within a match. `userId` is null for guests; set for
 *  authenticated players (FK to the auth `user` table, added in CP6). */
export const matchPlayers = pgTable("match_players", {
  id: serial().primaryKey(),
  matchId: uuid()
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  handle: text().notNull(),
  userId: text().references(() => user.id, { onDelete: "set null" }),
  kills: integer().notNull().default(0),
  deaths: integer().notNull().default(0),
});

/** Lifetime stats, keyed by authenticated user. Guests never get a row.
 *  `userId` becomes a FK to the auth `user` table in CP6. */
export const playerStats = pgTable("player_stats", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  kills: integer().notNull().default(0),
  deaths: integer().notNull().default(0),
  matchesPlayed: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
