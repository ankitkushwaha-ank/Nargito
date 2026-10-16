import "./env";
import { runDueJobs, syncJobRegistry } from "../src/server/jobs/runner";

/**
 * Background worker: runs due scheduled jobs once a minute.
 * NOTE: with the embedded PGlite database only ONE process can open the data directory. Use PostgreSQL
 * (DATABASE_URL=postgres://...) when running the web server and the worker together, or trigger jobs through
 * POST /api/cron/due from an external scheduler.
 */
async function tick() {
  try {
    const r = await runDueJobs();
    if (r.length) console.log(new Date().toISOString(), "ran", r.map((x) => `${x.key}:${x.ok ? "ok" : "fail"}`).join(", "));
  } catch (e) {
    console.error("worker tick failed", e instanceof Error ? e.message : e);
  }
}

async function main() {
  await syncJobRegistry();
  console.log("Nargito worker started");
  await tick();
  setInterval(tick, 60_000);
}
main().catch((e) => { console.error(e); process.exit(1); });
