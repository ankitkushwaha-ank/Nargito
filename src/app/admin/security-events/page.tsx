import { and, desc, eq, ilike } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Pager, Badge } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { likeEscape } from "@/server/util";

export const metadata = { title: "Security events" };
const PAGE = 50;
const risky = (t: string) => /failed|bad_|refused|duplicate|revoked|disabled/.test(t);

export default async function SecurityEvents({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("security.manage");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await useDb();
  const conds = sp.type ? [ilike(schema.securityEvents.type, `%${likeEscape(sp.type.slice(0, 40))}%`)] : [];
  const rows = await db.select({ e: schema.securityEvents, who: schema.users.username }).from(schema.securityEvents).leftJoin(schema.users, eq(schema.users.id, schema.securityEvents.userId)).where(and(...conds)).orderBy(desc(schema.securityEvents.createdAt)).limit(PAGE + 1).offset((page - 1) * PAGE);
  return (
    <>
      <AdminTitle title="Security events" description="Sign-ins, failed attempts, password and 2FA changes, OAuth link refusals and session revocations. Retention: 180 days." />
      <form className="card mb-4 flex items-end gap-3 p-3" role="search"><div><label className="label" htmlFor="st">Event type contains</label><input id="st" name="type" defaultValue={sp.type} className="input" placeholder="login.failed" /></div><button className="btn-primary">Filter</button></form>
      <Table head={["Time", "Event", "Account", "IP", "Device"]} empty={rows.length ? undefined : "No events."}>
        {rows.slice(0, PAGE).map(({ e, who }) => <tr key={e.id}><Td className="whitespace-nowrap text-xs">{formatDate(e.createdAt, "en", { dateStyle: "short", timeStyle: "medium" })}</Td><Td><Badge tone={risky(e.type) ? "warn" : "muted"}>{e.type}</Badge></Td><Td>{who ? `@${who}` : "-"}</Td><Td className="text-xs">{e.ip}</Td><Td className="max-w-xs truncate text-xs text-muted">{e.userAgent}</Td></tr>)}
      </Table>
      <Pager page={page} hasMore={rows.length > PAGE} basePath="/admin/security-events" params={{ type: sp.type }} />
    </>
  );
}
