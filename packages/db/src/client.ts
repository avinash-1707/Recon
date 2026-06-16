import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type DB = NodePgDatabase<Schema>;

let pool: Pool | null = null;
let instance: DB | null = null;

/** Whether a database is configured. The relay runs fine without one — it just
 *  skips persistence (rooms/matches live only in memory). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Lazily open the pool on first use so importing this package never connects
 *  (and never throws) until the server actually needs the DB. */
export function getDb(): DB {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see packages/db/.env.example");
  }
  // node-postgres Pool works with Neon's pooled connection string and any
  // standard Postgres, so dev (local PG) and prod (Neon) share one code path.
  pool = new Pool({ connectionString });
  instance = drizzle(pool, { schema, casing: "snake_case" });
  return instance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    instance = null;
  }
}

export { schema };
