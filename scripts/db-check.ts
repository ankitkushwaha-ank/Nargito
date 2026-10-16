// Usage: npx tsx scripts/db-check.ts   (reads .env, tests the same connection the website uses)
import { readFileSync, existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
async function main() {
  const { getDb, rowsOf } = await import("../src/server/db");
  const { sql } = await import("drizzle-orm");
  const url = process.env.DATABASE_URL ?? "(not set)";
  console.log("DATABASE_URL host:", url.replace(/^[a-z]+:\/\/[^@]*@/i, "").split("/")[0]);
  const db = await getDb();
  console.log("server:", rowsOf<{ v: string }>(await db.execute(sql`select version() v`))[0]?.v);
  for (const t of ["users", "posts", "media", "site_settings"]) {
    try { console.log(t, rowsOf<{ c: number }>(await db.execute(sql.raw(`select count(*)::int c from "${t}"`)))[0]?.c); }
    catch (e) { console.log(t, "ERROR:", e instanceof Error ? e.message : e); }
  }
  process.exit(0);
}
main().catch((e) => { console.error("CONNECTION FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
