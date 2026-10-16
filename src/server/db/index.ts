import * as schema from "./schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Database access.
 *  - DATABASE_URL=postgres://...  -> node-postgres pool (production / docker-compose)
 *  - DATABASE_URL unset or "pglite:<dir>" -> embedded PostgreSQL (PGlite) stored on disk. Real Postgres
 *    semantics, intended for local development and CI where no server is available.
 * The connection is created lazily so `next build` never opens it.
 */
const g = globalThis as unknown as { __nargitoDb?: Promise<Db>; __nargitoDbSync?: Db };

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    // node-postgres lets ssl settings inside the URL (sslmode=...) override the `ssl` option, which breaks
    // self-signed hosts such as Aiven. So strip them from the URL and decide SSL here.
    const wantsSsl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL !== "false" : /[?&]ssl(mode)?=(require|verify-ca|verify-full|true|prefer)/i.test(url) || !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);
    const cleanUrl = url.replace(/([?&])(sslmode|ssl|sslrootcert|rejectUnauthorized)=[^&]*&?/gi, "$1").replace(/[?&]$/, "");
    const ca = process.env.DATABASE_SSL_CA;
    // Vercel serverless: each function instance is isolated; a pool of 10 per instance
    // exhausts free-tier databases instantly. Use max=2 on serverless, or the env override.
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
    const maxConns = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : isServerless ? 2 : 10;
    const pool = new Pool({
      connectionString: cleanUrl,
      max: maxConns,
      // Serverless: release connections quickly so the limit isn't held across cold starts
      idleTimeoutMillis: isServerless ? 5_000 : 300_000,
      allowExitOnIdle: isServerless,
      keepAlive: !isServerless,
      keepAliveInitialDelayMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: wantsSsl ? (ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }) : false,
    });
    return drizzle(pool, { schema }) as Db;
  }
  if (process.env.VERCEL && !url?.startsWith("pglite:")) {
    throw new Error("DATABASE_URL is missing or invalid. Set it to a postgres:// connection string in the Vercel project's Environment Variables, then redeploy.");
  }
  const dir = url?.startsWith("pglite:") ? url.slice(7) : ".data/pglite";
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const fs = await import("node:fs");
  const nodePath = await import("node:path");
  fs.mkdirSync(nodePath.dirname(nodePath.resolve(dir)), { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  return drizzle(client, { schema }) as unknown as Db;
}

/** Normalise `db.execute()` results across node-postgres and PGlite. */
export function rowsOf<T = Record<string, unknown>>(res: unknown): T[] {
  const r = res as { rows?: T[] };
  return Array.isArray(r) ? (r as T[]) : (r.rows ?? []);
}

export function getDb(): Promise<Db> {
  if (!g.__nargitoDb) g.__nargitoDb = create();
  return g.__nargitoDb;
}

/** Awaitable accessor used everywhere: `const db = await useDb()` */
export const useDb = getDb;

export { schema };
