// import { defineConfig } from "drizzle-kit";

// export default defineConfig({
//   dialect: "postgresql",
//   schema: "./src/server/db/schema.ts",
//   out: "./drizzle",
//   // Only used for `drizzle-kit` introspection commands; generation does not need a live DB.
//   dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/nargito" },
// });


import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // <-- Crucial for Aiven / self-signed certs
  },
});

export const db = drizzle(pool);
