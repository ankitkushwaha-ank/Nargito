import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { desc, sql } from "drizzle-orm";
import { useDb, schema, rowsOf } from "../db";
import { UPLOAD_ROOT, getStorageConfig, testStorage } from "../storage";
import { mailConfigStatus } from "../mail";
import { paymentsStatus } from "./pro";
import { providerCredentials } from "../auth/oauth";

export type Check = { key: string; label: string; status: "ok" | "warn" | "fail" | "unavailable"; detail: string };

/** Only things that are actually measured are reported; anything else is "unavailable". */
export async function runHealthChecks(): Promise<{ checks: Check[]; recentErrors: (typeof schema.systemLogs.$inferSelect)[]; failedJobs: (typeof schema.scheduledJobs.$inferSelect)[]; info: Record<string, string> }> {
  const checks: Check[] = [];
  const db = await useDb();
  let t0 = Date.now();
  try { await db.execute(sql`select 1`); checks.push({ key: "db", label: "Database connectivity", status: "ok", detail: `Query round-trip ${Date.now() - t0} ms` }); }
  catch { checks.push({ key: "db", label: "Database connectivity", status: "fail", detail: "The database did not respond." }); }

  try {
    const journal = JSON.parse(await fs.readFile(path.resolve("drizzle", "meta", "_journal.json"), "utf8")) as { entries: unknown[] };
    const applied = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`))[0]?.n ?? 0;
    checks.push({ key: "migrations", label: "Migration status", status: applied >= journal.entries.length ? "ok" : "warn", detail: `${applied} applied of ${journal.entries.length} available${applied < journal.entries.length ? ". Run npm run db:migrate." : ""}` });
  } catch { checks.push({ key: "migrations", label: "Migration status", status: "unavailable", detail: "Migration journal or table could not be read." }); }

  try {
    const sc = await getStorageConfig();
    t0 = Date.now();
    const tr = await testStorage(sc);
    checks.push({ key: "storage", label: sc.provider === "r2" ? "Media storage (Cloudflare R2)" : "Media storage (local disk)", status: tr.ok ? "ok" : "fail", detail: tr.ok ? `Write/read/delete succeeded in ${Date.now() - t0} ms` : tr.message });
  } catch { checks.push({ key: "storage", label: "Media storage", status: "fail", detail: "Storage check failed." }); }
  try {
    const st = await fs.statfs(UPLOAD_ROOT);
    const free = Number(st.bavail) * Number(st.bsize);
    checks.push({ key: "disk", label: "Free disk space", status: free < 500 * 1024 * 1024 ? "warn" : "ok", detail: `${(free / 1024 ** 3).toFixed(1)} GB free on the upload volume` });
  } catch { checks.push({ key: "disk", label: "Free disk space", status: "unavailable", detail: "Not supported on this platform." }); }

  const m = mailConfigStatus();
  checks.push({ key: "email", label: "Email provider", status: m.smtp || m.resend ? "ok" : "warn", detail: m.smtp ? "SMTP credentials present" : m.resend ? "Resend key present" : "Not configured. Emails are logged as skipped." });
  checks.push({ key: "sms", label: "SMS provider", status: m.twilio ? "ok" : "warn", detail: m.twilio ? "Twilio credentials present (not live-tested)" : "Not configured." });
  checks.push({ key: "payments", label: "Payment provider", status: paymentsStatus().stripe ? "ok" : "warn", detail: paymentsStatus().stripe ? "Stripe keys present (not live-tested)" : "Not configured. Paid plans are unavailable." });
  const g = providerCredentials("google"), f = providerCredentials("facebook");
  checks.push({ key: "oauth", label: "Social login credentials", status: g.id && g.secret || f.id && f.secret ? "ok" : "warn", detail: `Google ${g.id && g.secret ? "set" : "missing"}, Facebook ${f.id && f.secret ? "set" : "missing"}` });
  if (process.env.NODE_ENV === "production" && process.env.NARGITO_DEV_OUTBOX === "1") checks.push({ key: "devbox", label: "Dev outbox", status: "fail", detail: "NARGITO_DEV_OUTBOX=1 shows verification codes on screen. Remove it on any public site." });
  checks.push({ key: "cron_secret", label: "Cron endpoint secret", status: (process.env.CRON_SECRET?.length ?? 0) >= 16 ? "ok" : "warn", detail: (process.env.CRON_SECRET?.length ?? 0) >= 16 ? "CRON_SECRET is set" : "CRON_SECRET missing or shorter than 16 characters; /api/cron is disabled." });

  const rt = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int n from messages where created_at > now() - interval '1 hour'`))[0]?.n ?? 0;
  checks.push({ key: "realtime", label: "Realtime (polling transport)", status: "ok", detail: `${rt} messages delivered in the last hour. No separate realtime service is required.` });

  const jobs = await db.select().from(schema.scheduledJobs);
  const overdue = jobs.filter((j) => j.enabled && j.nextRunAt && j.nextRunAt.getTime() < Date.now() - Math.max(15, j.intervalMinutes) * 2 * 60_000);
  const lastRun = jobs.reduce<Date | null>((a, j) => (j.lastRunAt && (!a || j.lastRunAt > a) ? j.lastRunAt : a), null);
  checks.push({ key: "scheduler", label: "Scheduler / worker", status: overdue.length ? "warn" : lastRun ? "ok" : "unavailable", detail: overdue.length ? `${overdue.length} job(s) overdue. Is the worker (npm run worker) or an external cron calling /api/cron/due running?` : lastRun ? `Last job run ${lastRun.toISOString()}` : "No job has run yet." });
  const failed = jobs.filter((j) => j.lastStatus === "failed");
  checks.push({ key: "jobs", label: "Failed jobs", status: failed.length ? "fail" : "ok", detail: failed.length ? `${failed.length} job(s) failed on their last run` : "None" });

  const lat = rowsOf<{ avg: number | null; n: number }>(await db.execute(sql`select avg(duration_ms)::float as avg, count(*)::int as n from system_logs where category = 'api' and duration_ms is not null and created_at > now() - interval '1 hour'`))[0];
  checks.push({ key: "latency", label: "API latency (sampled)", status: lat?.n ? ((lat.avg ?? 0) > 1500 ? "warn" : "ok") : "unavailable", detail: lat?.n ? `Average ${Math.round(lat.avg ?? 0)} ms over ${lat.n} sampled requests in the last hour` : "No sampled requests in the last hour." });
  const mem = process.memoryUsage();
  checks.push({ key: "memory", label: "Process memory", status: "ok", detail: `${(mem.rss / 1048576).toFixed(0)} MB resident, ${(mem.heapUsed / 1048576).toFixed(0)} MB heap` });

  const recentErrors = await db.select().from(schema.systemLogs).where(sql`${schema.systemLogs.level} = 'error'`).orderBy(desc(schema.systemLogs.createdAt)).limit(10);
  const info = {
    version: process.env.npm_package_version ?? "1.0.0", environment: process.env.NODE_ENV ?? "development", node: process.version, platform: `${process.platform}/${process.arch}`,
    database: process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL) ? "PostgreSQL" : "Embedded PostgreSQL (PGlite)", uptime: `${Math.round(process.uptime() / 60)} min`,
  };
  return { checks, recentErrors, failedJobs: failed, info };
}
