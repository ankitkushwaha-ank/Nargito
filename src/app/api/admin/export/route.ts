import { NextResponse, type NextRequest } from "next/server";
import { adminUser } from "@/server/admin";
import { hasRecentStepUp } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { getDashboard, toCsv } from "@/server/services/metrics";
import { audit } from "@/server/log";
import { AppError } from "@/server/util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const u = await adminUser("analytics.export");
    const sp = req.nextUrl.searchParams;
    const days = [7, 30, 90].includes(Number(sp.get("days"))) ? Number(sp.get("days")) : 30;
    const metric = sp.get("metric");
    if (metric === "users") {
      // Personal data export: separate permission + recent re-authentication.
      const admin = await adminUser("tools.run");
      if (!hasRecentStepUp(admin)) return NextResponse.redirect(new URL("/admin/step-up?next=/admin/tools", req.url));
      const db = await useDb();
      const rows = (await db.select({ email: schema.users.email, username: schema.users.username, name: schema.users.displayName, status: schema.users.status, verified: schema.users.verified, created_at: schema.users.createdAt }).from(schema.users).limit(20000)).map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
      await audit(admin.id, "export.users_csv", "users", undefined, { rows: rows.length });
      return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="nargito-users.csv"', "Cache-Control": "no-store" } });
    }
    const d = await getDashboard(days);
    const rows = metric === "growth" ? d.growth.map((g) => ({ day: g.day, new_users: g.n })) : d.metrics.map((m) => ({ metric: m.label, value: m.value ?? "", previous_period: m.previous ?? "", status: m.kind }));
    await audit(u.id, "analytics.export", "analytics", metric ?? "summary", { days });
    return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nargito-${metric ?? "summary"}-${days}d.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: "Export failed" }, { status: 500 });
  }
}
