import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { useDb, schema } from "../db";
import { JOB_DEFS } from "./defs";
import { HANDLERS } from "./handlers";
import { audit, logSystem, redact } from "../log";

export async function syncJobRegistry() {
  const db = await useDb();
  for (const j of JOB_DEFS) {
    await db.insert(schema.scheduledJobs).values({ key: j.key, name: j.name, description: j.description, intervalMinutes: j.intervalMinutes, safeManual: j.safeManual, nextRunAt: new Date(Date.now() + j.intervalMinutes * 60_000) }).onConflictDoNothing();
  }
}

const running = new Set<string>();

/** Runs a job with retries; records status, duration and a redacted error. Never throws. */
export async function runJob(key: string, opts: { manual?: boolean; actorId?: string } = {}) {
  const handler = HANDLERS[key];
  const db = await useDb();
  const [job] = await db.select().from(schema.scheduledJobs).where(eq(schema.scheduledJobs.key, key));
  if (!handler || !job) return { ok: false as const, error: "Unknown job." };
  if (opts.manual && !job.safeManual) return { ok: false as const, error: "This job cannot be run manually." };
  if (running.has(key)) return { ok: false as const, error: "Job is already running." };
  running.add(key);
  const started = Date.now();
  let lastError: string | null = null;
  let summary = "";
  try {
    for (let attempt = 0; attempt <= job.retries; attempt++) {
      try { summary = (await handler()).summary; lastError = null; break; }
      catch (e) { lastError = (e instanceof Error ? e.message : String(e)).replace(/(postgres(ql)?:\/\/)[^\s]+/gi, "$1[redacted]").slice(0, 300); }
    }
  } finally { running.delete(key); }
  const duration = Date.now() - started;
  await db.update(schema.scheduledJobs).set({
    lastRunAt: new Date(), lastStatus: lastError ? "failed" : "success", lastDurationMs: duration, lastError,
    nextRunAt: new Date(Date.now() + job.intervalMinutes * 60_000),
  }).where(eq(schema.scheduledJobs.key, key));
  await logSystem(lastError ? "error" : "info", "job", key, lastError ? `Job failed: ${lastError}` : summary, redact({ manual: !!opts.manual }) as Record<string, unknown>, { durationMs: duration });
  if (opts.manual) await audit(opts.actorId ?? null, "job.run_manual", "job", key, { status: lastError ? "failed" : "success" });
  return lastError ? { ok: false as const, error: lastError } : { ok: true as const, summary, durationMs: duration };
}

export async function runDueJobs() {
  const db = await useDb();
  const due = await db.select().from(schema.scheduledJobs).where(and(eq(schema.scheduledJobs.enabled, true), lte(schema.scheduledJobs.nextRunAt, new Date())));
  const results: { key: string; ok: boolean }[] = [];
  for (const j of due) results.push({ key: j.key, ok: (await runJob(j.key)).ok });
  return results;
}
