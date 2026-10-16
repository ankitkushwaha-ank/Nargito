/**
 * Builds database/nargito-full.sql (PostgreSQL): schema from drizzle/*.sql plus INSERTs for every row
 * in a scratch PGlite database that was migrated and seeded. Usage: see database/README.md
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const dir = process.argv[2] ?? ".data/export-tmp";
  const db = new PGlite(dir);
  await db.waitReady;

  const schemaSql = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()
    .map((f) => `-- ${f}\n` + readFileSync(path.join("drizzle", f), "utf8").replace(/--> statement-breakpoint/g, "")).join("\n");

  const tables = (await db.query<{ t: string }>(`select table_name t from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not like '\\_\\_%'`)).rows.map((r) => r.t);
  const fks = (await db.query<{ a: string; b: string }>(`select c.conrelid::regclass::text a, c.confrelid::regclass::text b from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace`)).rows
    .map((r) => ({ a: r.a.replace(/"/g, ""), b: r.b.replace(/"/g, "") })).filter((r) => r.a !== r.b);
  const done = new Set<string>(); const order: string[] = [];
  while (order.length < tables.length) {
    const next = tables.filter((t) => !done.has(t) && fks.filter((f) => f.a === t).every((f) => done.has(f.b) || !tables.includes(f.b)));
    if (!next.length) { for (const t of tables) if (!done.has(t)) { order.push(t); done.add(t); } break; }
    for (const t of next) { order.push(t); done.add(t); }
  }

  const out: string[] = [
    "-- NARGITO full database: schema + demo data (PostgreSQL). Run on an EMPTY database.",
    "-- psql -U nargito -d nargito -f nargito-full.sql",
    "BEGIN;", "SET client_encoding = 'UTF8';", "",
    "-- ===== SCHEMA =====", schemaSql, "", "-- ===== DATA =====",
  ];
  let rows = 0;
  for (const t of order) {
    const cols = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position`, [t])).rows.map((r) => r.column_name);
    if (!cols.length) continue;
    const expr = cols.map((c) => `quote_nullable("${c}"::text)`).join(` || ',' || `);
    const res = await db.query<{ v: string }>(`select ${expr} v from "${t}"`);
    if (!res.rows.length) continue;
    const head = `INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES`;
    for (let i = 0; i < res.rows.length; i += 200) {
      out.push(head + "\n" + res.rows.slice(i, i + 200).map((r) => `(${r.v})`).join(",\n") + ";");
    }
    rows += res.rows.length;
  }
  out.push("", "COMMIT;", "");
  mkdirSync("database", { recursive: true });
  writeFileSync("database/nargito-full.sql", out.join("\n"));
  console.log(`tables: ${order.length}, rows: ${rows}`);
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
