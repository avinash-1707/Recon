import { user, session, account, verification } from "./schema";

export { getDb, isDbConfigured, closeDb, schema, type DB } from "./client";
export * from "./schema";

/** The Better Auth core tables, grouped for the drizzle adapter. */
export const authSchema = { user, session, account, verification };
