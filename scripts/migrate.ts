import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// minimal .env loader (no extra dependency)
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  const folder = path.resolve("drizzle");
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: folder });
    await pool.end();
  } else {
    const dir = url?.startsWith("pglite:") ? url.slice(7) : ".data/pglite";
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    (await import("node:fs")).mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
    const client = new PGlite(dir);
    await client.waitReady;
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.close();
  }
  console.log("migrations applied");
}
main().catch((e) => { console.error(e); process.exit(1); });
