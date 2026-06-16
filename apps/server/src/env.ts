/** Process configuration. Bun auto-loads apps/server/.env in dev. */
export const env = {
  PORT: Number(process.env.PORT ?? 8787),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL ?? null,
} as const;
