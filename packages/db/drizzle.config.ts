import { defineConfig } from "drizzle-kit";

// Bun auto-loads this package's .env when running the db:* scripts.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: "snake_case",
});
