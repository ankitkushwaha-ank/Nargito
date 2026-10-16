import Link from "next/link";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { moderatePromotion, promotionStats, adminAdsSummary } from "@/server/services/promotions";
import { AdminTitle, MetricCard, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Promotions" };

async function decide(fd: FormData) {
  "use server";
  const admin = await adminUser("ads.manage");
  const d = String(fd.get("decision"));
  if (!["approve", "reject", "suspend"].includes(d)) return;
  await moderatePromotion(admin.id, String(fd.get("id")), d as "approve", String(fd.get("reason") ?? ""));
  revalidatePath("/admin/promotions");
}

export default async function PromotionsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("ads.manage");
  const sp = await searchParams;
  const status = ["pending", "active", "paused", "ended", "rejected", "suspended"].includes(sp.status ?? "") ? sp.status! : "pending";
  const db = await useDb();
  const [rows, summary] = await Promise.all([
    db.select({ p: schema.promotions, owner: schema.users.username }).from(schema.promotions).innerJoin(schema.users, eq(schema.users.id, schema.promotions.ownerId)).where(eq(schema.promotions.status, status)).orderBy(desc(schema.promotions.createdAt)).limit(50),
    adminAdsSummary(),
  ]);
  const stats = await promotionStats(rows.map(({ p }) => p.id));
  return (
    <FeatureGate feature="promotions">
      <AdminTitle title="Promotions" description="Review sponsored content before it goes live. All figures come from recorded events; none are estimated." actions={<Link href="/admin/settings/ads" className="btn-secondary">Advertising policy</Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <MetricCard m={{ key: "a", label: "Active", value: summary.active, kind: "actual" }} /><MetricCard m={{ key: "p", label: "Pending review", value: summary.pending, kind: "actual" }} /><MetricCard m={{ key: "i", label: "Impressions (all time)", value: summary.impressions, kind: "actual" }} /><MetricCard m={{ key: "c", label: "Clicks (all time)", value: summary.clicks, kind: "actual" }} />
      </div>
      <nav className="mb-3 flex flex-wrap gap-1" aria-label="Status">{["pending", "active", "paused", "ended", "rejected", "suspended"].map((s) => <Link key={s} href={`/admin/promotions?status=${s}`} className={cn("rounded-full border border-line px-3 py-1 text-sm capitalize", status === s ? "bg-primary text-white" : "bg-surface text-muted")}>{s}</Link>)}</nav>
      <Table head={["Promotion", "Advertiser", "Placement", "Window", "Impr. / clicks", "Decision"]} empty={rows.length ? undefined : `No ${status} promotions.`}>
        {rows.map(({ p, owner }) => { const st = stats.get(p.id); return (
          <tr key={p.id}><Td><p className="font-medium">{p.title}</p><Badge>{p.entityType}</Badge></Td><Td>@{owner}</Td><Td>{p.placement}</Td><Td className="text-xs">{p.startsAt ? formatDate(p.startsAt, "en") : "-"} → {p.endsAt ? formatDate(p.endsAt, "en") : "-"}</Td><Td>{st?.impressions ?? 0} / {st?.clicks ?? 0}</Td>
            <Td><form action={decide} className="flex flex-wrap items-center gap-1"><input type="hidden" name="id" value={p.id} /><label className="sr-only" htmlFor={`pr-${p.id}`}>Reason</label><input id={`pr-${p.id}`} name="reason" placeholder="Reason (for reject / suspend)" className="input !w-44 !py-1" maxLength={300} />
              {(p.status === "pending" || p.status === "suspended" || p.status === "rejected") && <button name="decision" value="approve" className="btn-primary !min-h-[30px]">Approve</button>}
              {p.status === "pending" && <button name="decision" value="reject" className="btn-secondary !min-h-[30px]">Reject</button>}
              {(p.status === "active" || p.status === "paused") && <button name="decision" value="suspend" className="btn-danger !min-h-[30px]">Suspend</button>}</form></Td></tr>
        ); })}
      </Table>
    </FeatureGate>
  );
}
