import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { hasPermission, getPermissionsFor } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Avatar, Badge } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { addNoteAction, moderateUserAction, setUserRoleAction, revokeUserSessionsAction, manualVerifyAction } from "../actions";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/server/util";

export const metadata = { title: "User" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await adminPage("users.read");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!u) notFound();
  const [canSuspend, canManage, canRoles, canVerify, perms] = await Promise.all([hasPermission(admin, "users.suspend"), hasPermission(admin, "users.manage"), hasPermission(admin, "roles.manage"), hasPermission(admin, "verification.manage"), getPermissionsFor(u.id)]);
  const [roles, allRoles, notes, reports, audits, counts, requests] = await Promise.all([
    db.select({ r: schema.roles }).from(schema.userRoles).innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId)).where(eq(schema.userRoles.userId, id)),
    db.select().from(schema.roles).orderBy(schema.roles.name),
    canManage ? db.select({ n: schema.adminNotes, a: schema.users.displayName }).from(schema.adminNotes).leftJoin(schema.users, eq(schema.users.id, schema.adminNotes.adminId)).where(eq(schema.adminNotes.userId, id)).orderBy(desc(schema.adminNotes.createdAt)).limit(20) : Promise.resolve([]),
    db.select().from(schema.reports).where(sql`${schema.reports.entityType} = 'user' and ${schema.reports.entityId} = ${id}`).orderBy(desc(schema.reports.createdAt)).limit(10),
    db.select().from(schema.auditLogs).where(sql`${schema.auditLogs.entityId} = ${id} or ${schema.auditLogs.actorId} = ${id}`).orderBy(desc(schema.auditLogs.createdAt)).limit(15),
    db.execute(sql`select (select count(*)::int from posts where author_id = ${id}) posts, (select count(*)::int from comments where author_id = ${id}) comments, (select count(*)::int from messages where sender_id = ${id}) messages, (select count(*)::int from products where seller_id = ${id}) products, (select count(*)::int from trips where owner_id = ${id}) trips`),
    db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, id)).orderBy(desc(schema.dataRequests.createdAt)).limit(5),
  ]);
  const c = ((counts as unknown as { rows?: Record<string, number>[] }).rows ?? (counts as unknown as Record<string, number>[]))[0] ?? {};
  const held = new Set(roles.map((r) => r.r.id));
  const tone = u.status === "active" ? "success" : u.status === "banned" ? "danger" : "warn";
  return (
    <>
      <AdminTitle title={u.displayName} description={<>@{u.username} · {u.email}</>} actions={<Link href="/admin/users" className="btn-secondary">All users</Link>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="card flex items-start gap-4 p-5"><Avatar name={u.displayName} src={u.avatarUrl} size={64} />
            <div className="space-y-1 text-sm"><p><Badge tone={tone}>{u.status}</Badge> {u.verified && <Badge>verified</Badge>} {u.emailVerifiedAt ? <Badge tone="success">email verified</Badge> : <Badge tone="warn">email unverified</Badge>} {u.mfaEnabled && <Badge tone="success">2FA</Badge>}</p>
              {u.statusReason && <p className="text-muted">Reason: {u.statusReason}</p>}{u.restrictedUntil && <p className="text-muted">Restricted until {formatDate(u.restrictedUntil, "en", { dateStyle: "medium", timeStyle: "short" })}</p>}
              <p className="text-muted">Joined {formatDate(u.createdAt, "en")} · last seen {u.lastSeenAt ? formatDate(u.lastSeenAt, "en", { dateStyle: "medium", timeStyle: "short" }) : "never"}</p>
              <p className="text-muted">{c.posts} posts · {c.comments} comments · {c.messages} messages sent · {c.products} products · {c.trips} trips</p>
              <p className="text-xs text-muted">Message contents and precise location are not accessible from this screen.</p>
              <Link href={`/profile/${u.username}`} className="link">View public profile</Link></div>
          </section>
          {canSuspend && (
            <ActionForm action={moderateUserAction} className="card space-y-3 p-5"><h2 className="text-lg">Account actions</h2>
              <input type="hidden" name="userId" value={u.id} />
              <div className="grid gap-3 sm:grid-cols-3"><Field label="Action" name="action" as="select" options={[{ value: "warn", label: "Send warning" }, { value: "restrict", label: "Temporarily restrict" }, { value: "suspend", label: "Suspend" }, { value: "ban", label: "Ban (confirm identity)" }, { value: "reinstate", label: "Reinstate" }]} /><Field label="Restriction days" name="days" type="number" min={1} max={90} defaultValue={7} /><Field className="sm:col-span-3" label="Reason (shown to the user)" name="reason" maxLength={300} /></div>
              <SubmitButton variant="danger">Apply action</SubmitButton>
              {perms.has("roles.manage") && <p className="text-xs text-warn">This administrator is protected from suspension; remove their role first.</p>}
            </ActionForm>
          )}
          <section className="card space-y-2 p-5"><h2 className="text-lg">Reports against this user</h2>
            {reports.length === 0 ? <p className="text-sm text-muted">None.</p> : <ul className="space-y-1 text-sm">{reports.map((r) => <li key={r.id}><Link className="link" href={`/admin/reports/${r.id}`}>{r.reason}</Link> <Badge tone={r.status === "open" ? "warn" : "muted"}>{r.status}</Badge> <span className="text-muted">{formatDate(r.createdAt, "en")}</span></li>)}</ul>}
          </section>
          <section className="space-y-2"><h2 className="text-lg">Recent activity</h2>
            <Table head={["When", "Action", "Entity"]} empty={audits.length ? undefined : "No audit entries."}>{audits.map((a) => <tr key={a.id}><Td>{formatDate(a.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{a.action}</Td><Td className="text-xs text-muted">{a.entityType}</Td></tr>)}</Table></section>
        </div>
        <div className="space-y-5">
          <section className="card space-y-3 p-5"><h2 className="text-lg">Roles</h2>
            <ul className="space-y-1 text-sm">{roles.length ? roles.map(({ r }) => <li key={r.id} className="flex items-center justify-between"><Badge>{r.name}</Badge>{canRoles && <form action={setUserRoleAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="roleId" value={r.id} /><button name="op" value="revoke" className="btn-ghost !min-h-[28px] text-danger">Remove</button></form>}</li>) : <li className="text-muted">No admin roles.</li>}</ul>
            {canRoles && <form action={setUserRoleAction} className="flex gap-2"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="grant" /><label className="sr-only" htmlFor="role-add">Role</label><select id="role-add" name="roleId" className="input">{allRoles.filter((r) => !held.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="btn-secondary">Grant</button></form>}
            <p className="text-xs text-muted">Role changes require re-authentication and are audited.</p>
          </section>
          <section className="card space-y-2 p-5"><h2 className="text-lg">Verification & sessions</h2>
            <div className="flex flex-wrap gap-2">
              {canVerify && <form action={manualVerifyAction}><input type="hidden" name="userId" value={u.id} /><button name="verified" value={u.verified ? "false" : "true"} className="btn-secondary">{u.verified ? "Remove verified badge" : "Grant verified badge"}</button></form>}
              {canSuspend && <form action={revokeUserSessionsAction}><input type="hidden" name="userId" value={u.id} /><button className="btn-secondary">Sign out all sessions</button></form>}
            </div></section>
          {canManage && (
            <section className="card space-y-3 p-5"><h2 className="text-lg">Admin notes</h2>
              <ActionForm action={addNoteAction} className="space-y-2" resetOnSuccess><input type="hidden" name="userId" value={u.id} /><Field label="Add a private note" name="note" as="textarea" rows={2} maxLength={1000} /><SubmitButton variant="secondary">Add note</SubmitButton></ActionForm>
              <ul className="space-y-2 text-sm">{notes.map(({ n, a }) => <li key={n.id} className="rounded-lg bg-bg p-2"><p>{n.note}</p><p className="text-xs text-muted">{a ?? "admin"} · {formatDate(n.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</p></li>)}</ul>
            </section>
          )}
          {requests.length > 0 && <section className="card p-5"><h2 className="text-lg">Data requests</h2><ul className="mt-1 text-sm">{requests.map((r) => <li key={r.id}>{r.type} · {r.status} · {formatDate(r.createdAt, "en")}</li>)}</ul></section>}
        </div>
      </div>
    </>
  );
}
