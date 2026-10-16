import "./env";
import { rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** Wipes the LOCAL embedded database + uploaded files and rebuilds them with fresh demo data. Refuses to touch PostgreSQL. */
if (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL)) {
  console.error("db:reset only works with the embedded development database. Refusing to reset a PostgreSQL server.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") { console.error("Refusing to reset in production."); process.exit(1); }
for (const p of [".data/pglite", ".data/uploads"]) rmSync(path.resolve(p), { recursive: true, force: true });
const run = (args: string[]) => { const r = spawnSync("npx", args, { stdio: "inherit", shell: true }); if (r.status) process.exit(r.status); };
run(["tsx", "scripts/migrate.ts"]);
run(["tsx", "--conditions=react-server", "scripts/seed.ts"]);
