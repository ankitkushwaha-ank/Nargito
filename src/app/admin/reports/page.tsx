import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Pager } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Reports & moderation" };
const PAGE = 25;
const sevTone = (s: string) => (s === "critical" || s === "high" ? "danger" : s === "medium" ? "warn" : "muted") as "danger" | "warn" | "muted";

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("reports.manage");
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await useDb();
  const conds = [];
  if (status !== "all") conds.push(status === "open" ? sql`${schema.reports.status} in ('open','reviewing','appealed')` : eq(schema.reports.status, status));
  if (sp.type) conds.push(eq(schema.reports.entityType, sp.type));
  if (sp.severity) conds.push(eq(schema.reports.severity, sp.severity));
  const rows = await db.select({ r: schema.reports, reporter: schema.users.username }).from(schema.reports).leftJoin(schema.users, eq(schema.users.id, schema.reports.reporterId)).where(and(...conds)).orderBy(sql`case ${schema.reports.severity} when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`, desc(schema.reports.createdAt)).limit(PAGE + 1).offset((page - 1) * PAGE);
  return (
    <>
      <AdminTitle title="Reports & moderation" description="Highest severity first. Open a report to review the item, record notes and take action. Every action is audited." />
      <nav className="mb-3 flex flex-wrap gap-1" aria-label="Status">{[["open", "Open"], ["resolved", "Resolved"], ["dismissed", "Dismissed"], ["all", "All"]].map(([s, l]) => <Link key={s} href={`/admin/reports?status=${s}`} className={cn("rounded-full border border-line px-3 py-1 text-sm", status === s ? "bg-primary text-white" : "bg-surface text-muted")}>{l}</Link>)}</nav>
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3"><input type="hidden" name="status" value={status} />
        <div><label className="label" htmlFor="rt">Type</label><select id="rt" name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Any</option>{["user", "post", "comment", "product", "service", "trip", "company", "shop", "group", "message", "promotion"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label" htmlFor="rsv">Severity</label><select id="rsv" name="severity" defaultValue={sp.severity ?? ""} className="input"><option value="">Any</option>{["critical", "high", "medium", "low"].map((t) => <option key={t}>{t}</option>)}</select></div>
        <button className="btn-primary">Filter</button></form>
      <Table head={["Reported", "Type", "Reason", "Severity", "Status", "Reporter", "Opened"]} empty={rows.length ? undefined : "No reports match."}>
        {rows.slice(0, PAGE).map(({ r, reporter }) => (
          <tr key={r.id}><Td><Link className="link font-medium" href={`/admin/reports/${r.id}`}>Review</Link></Td><Td className="capitalize">{r.entityType}</Td><Td>{r.reason}</Td><Td><Badge tone={sevTone(r.severity)}>{r.severity}</Badge></Td><Td><Badge tone={r.status === "open" ? "warn" : r.status === "resolved" ? "success" : "muted"}>{r.status}</Badge></Td><Td>{reporter ? `@${reporter}` : "-"}</Td><Td>{formatDate(r.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td></tr>
        ))}
      </Table>
      <Pager page={page} hasMore={rows.length > PAGE} basePath="/admin/reports" params={{ status, type: sp.type, severity: sp.severity }} />
    </>
  );
}
