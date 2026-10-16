import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { useDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness + shallow DB readiness. Reveals nothing about configuration. */
export async function GET() {
  const started = Date.now();
  try {
    const db = await useDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "up", latencyMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
