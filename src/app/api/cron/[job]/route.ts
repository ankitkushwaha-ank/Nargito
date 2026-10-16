import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueJobs, runJob } from "@/server/jobs/runner";
import { HANDLERS } from "@/server/jobs/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given); const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/cron/<job-key> or /api/cron/due with `Authorization: Bearer $CRON_SECRET` (for external schedulers). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { job } = await ctx.params;
  if (job === "due") return NextResponse.json({ ok: true, results: await runDueJobs() });
  if (!(job in HANDLERS)) return NextResponse.json({ ok: false, error: "Unknown job" }, { status: 404 });
  const r = await runJob(job);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
