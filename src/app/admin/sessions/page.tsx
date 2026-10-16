import { revalidatePath } from "next/cache";
import { desc, eq, and, isNull, gt } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { getPermissionsFor } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { audit } from "@/server/log";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Admin sessions" };

async function revoke(fd: FormData) {
  "use server";
  const u = await adminUser("security.manage");
  const db = await useDb();
  const id = String(fd.get("id"));
  await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, id));
  await audit(u.id, "session.revoke_admin", "session", id);
  revalidatePath("/admin/sessions");
}

export default async function AdminSessions() {
  const me = await adminPage("security.manage");
  const db = await useDb();
  const rows = await db.select({ s: schema.sessions, u: schema.users }).from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId)).where(and(isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.lastUsedAt)).limit(300);
  const admins: typeof rows = [];
  for (const r of rows) if ((await getPermissionsFor(r.u.id)).has("admin.access")) admins.push(r);
  return (
    <>
      <AdminTitle title="Admin sessions" description="Active sessions of accounts that can open the admin panel. Revoke a session to force that device to sign in again." />
      <Table head={["Administrator", "Device", "IP", "Last active", "2FA", ""]} empty={admins.length ? undefined : "No active admin sessions."}>
        {admins.map(({ s, u }) => <tr key={s.id}><Td>{u.displayName} <span className="text-muted">@{u.username}</span>{s.id === me.sessionId && <> <Badge>this session</Badge></>}</Td><Td className="max-w-xs truncate text-xs">{s.userAgent}</Td><Td className="text-xs">{s.ip}</Td><Td className="text-xs">{s.lastUsedAt ? formatDate(s.lastUsedAt, "en", { dateStyle: "short", timeStyle: "short" }) : "-"}</Td><Td>{u.mfaEnabled ? <Badge tone="success">on</Badge> : <Badge tone="warn">off</Badge>}</Td><Td>{s.id !== me.sessionId && <form action={revoke}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !min-h-[28px] text-danger">Revoke</button></form>}</Td></tr>)}
      </Table>
    </>
  );
}
