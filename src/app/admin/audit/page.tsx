import { and, desc, eq, ilike } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Pager } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { likeEscape, isUuid } from "@/server/util";

export const metadata = { title: "Audit logs" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await useDb();
  const conds = [];
  if (sp.action) conds.push(ilike(schema.auditLogs.action, `%${likeEscape(sp.action.slice(0, 60))}%`));
  if (sp.actor && isUuid(sp.actor)) conds.push(eq(schema.auditLogs.actorId, sp.actor));
  const rows = await db.select({ a: schema.auditLogs, who: schema.users.username }).from(schema.auditLogs).leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId)).where(and(...conds)).orderBy(desc(schema.auditLogs.createdAt)).limit(PAGE + 1).offset((page - 1) * PAGE);
  return (
    <>
      <AdminTitle title="Audit logs" description="Immutable record of privileged and sensitive actions: who did what, when, from where. Retention: 2 years." />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" role="search"><div><label className="label" htmlFor="aa">Action contains</label><input id="aa" name="action" defaultValue={sp.action} className="input" placeholder="e.g. user.ban" /></div><div><label className="label" htmlFor="ac">Actor ID</label><input id="ac" name="actor" defaultValue={sp.actor} className="input" /></div><button className="btn-primary">Filter</button></form>
      <Table head={["Time", "Actor", "Action", "Entity", "Details", "IP"]} empty={rows.length ? undefined : "No entries."}>
        {rows.slice(0, PAGE).map(({ a, who }) => (
          <tr key={a.id}><Td className="whitespace-nowrap text-xs">{formatDate(a.createdAt, "en", { dateStyle: "short", timeStyle: "medium" })}</Td><Td>{who ? `@${who}` : "system"}</Td><Td><code className="text-xs">{a.action}</code></Td><Td className="text-xs">{a.entityType}{a.entityId ? `:${a.entityId.slice(0, 8)}` : ""}</Td><Td className="max-w-md break-words text-xs text-muted">{a.meta ? JSON.stringify(a.meta) : ""}</Td><Td className="text-xs">{a.ip}</Td></tr>
        ))}
      </Table>
      <Pager page={page} hasMore={rows.length > PAGE} basePath="/admin/audit" params={{ action: sp.action, actor: sp.actor }} />
    </>
  );
}
