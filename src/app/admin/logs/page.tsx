import Link from "next/link";
import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Pager } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { likeEscape } from "@/server/util";

export const metadata = { title: "System logs" };
const PAGE = 50;

export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("logs.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await useDb();
  const conds = [];
  if (sp.level && ["debug", "info", "warn", "error"].includes(sp.level)) conds.push(eq(schema.systemLogs.level, sp.level));
  if (sp.category) conds.push(eq(schema.systemLogs.category, sp.category));
  if (sp.q) conds.push(ilike(schema.systemLogs.message, `%${likeEscape(sp.q.slice(0, 100))}%`));
  if (sp.component) conds.push(ilike(schema.systemLogs.component, `%${likeEscape(sp.component.slice(0, 80))}%`));
  if (sp.cid) conds.push(eq(schema.systemLogs.correlationId, sp.cid.slice(0, 64)));
  if (sp.from && !Number.isNaN(Date.parse(sp.from))) conds.push(gte(schema.systemLogs.createdAt, new Date(sp.from)));
  if (sp.to && !Number.isNaN(Date.parse(sp.to))) conds.push(lte(schema.systemLogs.createdAt, new Date(sp.to + "T23:59:59")));
  const rows = await db.select().from(schema.systemLogs).where(and(...conds)).orderBy(desc(schema.systemLogs.createdAt)).limit(PAGE + 1).offset((page - 1) * PAGE);
  const tone = (l: string) => (l === "error" ? "danger" : l === "warn" ? "warn" : "muted") as "danger" | "warn" | "muted";
  return (
    <>
      <AdminTitle title="System logs" description="Application and diagnostic events. Passwords, tokens, OTP codes, message contents and precise location are never written here. Retention: 30 days." actions={<><Link className="btn-secondary" href="/admin/audit">Audit logs</Link><Link className="btn-secondary" href="/admin/security-events">Security events</Link></>} />
      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2"><label className="label" htmlFor="lq">Message contains</label><input id="lq" name="q" defaultValue={sp.q} className="input" /></div>
        <div><label className="label" htmlFor="ll">Level</label><select id="ll" name="level" defaultValue={sp.level ?? ""} className="input"><option value="">Any</option>{["error", "warn", "info", "debug"].map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="lc">Category</label><select id="lc" name="category" defaultValue={sp.category ?? ""} className="input"><option value="">Any</option>{["app", "api", "job", "mail", "storage"].map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="lco">Component</label><input id="lco" name="component" defaultValue={sp.component} className="input" /></div>
        <div><label className="label" htmlFor="lci">Correlation ID</label><input id="lci" name="cid" defaultValue={sp.cid} className="input" /></div>
        <div><label className="label" htmlFor="lf">From</label><input id="lf" type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label className="label" htmlFor="lt">To</label><input id="lt" type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div className="flex items-end"><button className="btn-primary">Search</button></div>
      </form>
      <Table head={["Time", "Level", "Category", "Component", "Message", "Status", "Request ID"]} empty={rows.length ? undefined : "No log entries match."}>
        {rows.slice(0, PAGE).map((l) => (
          <tr key={l.id}><Td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, "en", { dateStyle: "short", timeStyle: "medium" })}</Td><Td><Badge tone={tone(l.level)}>{l.level}</Badge></Td><Td>{l.category}</Td><Td className="max-w-[10rem] truncate">{l.component}</Td><Td className="max-w-xl break-words text-xs">{l.message}</Td><Td>{l.status ?? ""}</Td><Td className="text-xs text-muted">{l.correlationId?.slice(0, 8)}</Td></tr>
        ))}
      </Table>
      <Pager page={page} hasMore={rows.length > PAGE} basePath="/admin/logs" params={{ q: sp.q, level: sp.level, category: sp.category, component: sp.component, cid: sp.cid, from: sp.from, to: sp.to }} />
    </>
  );
}
