import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see packages/db/.env.example");
}

// node-postgres Pool works with Neon's pooled connection string and any
// standard Postgres, so dev (local PG) and prod (Neon) share one code path.
export const pool = new Pool({ connectionString });

export const db = drizzle({ client: pool, schema, casing: "snake_case" });

export type DB = typeof db;
export { schema };
