import Link from "next/link";
import { and, desc, asc, eq, sql, or, ilike } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td, ViewToggle } from "@/components/admin/admin-ui";
import { Badge, Pager, Avatar } from "@/components/ui/kit";
import { BulkUsersForm } from "./bulk-form";
import { likeEscape } from "@/server/util";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/server/auth/guard";

export const metadata = { title: "Users" };
const PAGE = 25;

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await adminPage("users.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await useDb();
  const conds = [sql`${schema.users.deletedAt} is null`];
  if (sp.q) { const l = `%${likeEscape(sp.q.slice(0, 80))}%`; conds.push(or(ilike(schema.users.email, l), ilike(schema.users.username, l), ilike(schema.users.displayName, l))!); }
  if (sp.status && ["active", "restricted", "suspended", "banned"].includes(sp.status)) conds.push(eq(schema.users.status, sp.status));
  if (sp.verified === "1") conds.push(eq(schema.users.verified, true));
  const sort = sp.sort === "name" ? asc(schema.users.displayName) : sp.sort === "seen" ? desc(schema.users.lastSeenAt) : desc(schema.users.createdAt);
  const rows = await db.select().from(schema.users).where(and(...conds)).orderBy(sort).limit(PAGE + 1).offset((page - 1) * PAGE);
  const canAct = await hasPermission(admin, "users.suspend");
  const view = sp.view === "grid" ? "grid" : "list";
  const tone = (s: string) => (s === "active" ? "success" : s === "banned" ? "danger" : "warn") as "success" | "danger" | "warn";
  return (
    <>
      <AdminTitle title="Users" description="Search, filter and moderate accounts. Email addresses are visible to administrators with user access; private content is not." actions={<ViewToggle basePath="/admin/users" params={{ q: sp.q, status: sp.status, sort: sp.sort, verified: sp.verified }} view={view} />} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" role="search"><input type="hidden" name="view" value={view} />
        <div className="min-w-[220px] flex-1"><label className="label" htmlFor="uq">Search name, username or email</label><input id="uq" name="q" defaultValue={sp.q} className="input" /></div>
        <div><label className="label" htmlFor="us">Status</label><select id="us" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Any</option><option>active</option><option>restricted</option><option>suspended</option><option>banned</option></select></div>
        <div><label className="label" htmlFor="uso">Sort</label><select id="uso" name="sort" defaultValue={sp.sort ?? ""} className="input"><option value="">Newest</option><option value="seen">Last seen</option><option value="name">Name</option></select></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="verified" value="1" defaultChecked={sp.verified === "1"} className="accent-primary" />Verified only</label>
        <button className="btn-primary">Filter</button>
      </form>
      {view === "grid" ? (
        rows.length === 0 ? <p className="card p-8 text-center text-sm text-muted">No users match.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, PAGE).map((u) => (
              <li key={u.id} className="card p-4">
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3"><Avatar name={u.displayName} src={u.avatarUrl} size={48} /><span className="min-w-0"><span className="block truncate font-bold hover:text-primary">{u.displayName}</span><span className="block truncate text-sm text-muted">@{u.username}</span></span></Link>
                <p className="mt-3 truncate text-sm">{u.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge tone={tone(u.status)}>{u.status}</Badge>{u.verified && <Badge>verified</Badge>}{!u.emailVerifiedAt && <Badge tone="warn">unverified email</Badge>}</div>
                <p className="mt-3 text-xs text-muted">Joined {formatDate(u.createdAt, "en")} · Last seen {u.lastSeenAt ? formatDate(u.lastSeenAt, "en", { dateStyle: "short" }) : "never"}</p>
                <Link href={`/admin/users/${u.id}`} className="btn-secondary btn-sm mt-3 w-full">Open</Link>
              </li>
            ))}
          </ul>
        )
      ) : (      <BulkUsersForm canAct={canAct}>
        <Table head={canAct ? ["", "User", "Email", "Status", "Joined", "Last seen"] : ["User", "Email", "Status", "Joined", "Last seen"]} empty={rows.length ? undefined : "No users match."}>
          {rows.slice(0, PAGE).map((u) => (
            <tr key={u.id}>
              {canAct && <Td><input type="checkbox" name="ids" value={u.id} aria-label={`Select ${u.displayName}`} className="accent-primary" /></Td>}
              <Td><Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 hover:underline"><Avatar name={u.displayName} src={u.avatarUrl} size={28} /><span><span className="block font-medium">{u.displayName}</span><span className="text-xs text-muted">@{u.username}</span></span></Link></Td>
              <Td>{u.email}{!u.emailVerifiedAt && <Badge tone="warn">unverified</Badge>}</Td>
              <Td><Badge tone={tone(u.status)}>{u.status}</Badge> {u.verified && <Badge>verified</Badge>}</Td>
              <Td>{formatDate(u.createdAt, "en")}</Td><Td>{u.lastSeenAt ? formatDate(u.lastSeenAt, "en", { dateStyle: "short", timeStyle: "short" }) : "never"}</Td>
            </tr>
          ))}
        </Table>
      </BulkUsersForm>
      )}
      <Pager page={page} hasMore={rows.length > PAGE} basePath="/admin/users" params={{ q: sp.q, status: sp.status, sort: sp.sort, verified: sp.verified, view }} />
    </>
  );
}
