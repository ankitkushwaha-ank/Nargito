import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  // Only used for `drizzle-kit` introspection commands; generation does not need a live DB.
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/nargito" },
});
