import Link from "next/link";
import { desc, gte, and, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { getSetting } from "@/server/settings";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Notice } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Online users" };

export default async function OnlineUsers() {
  await adminPage("users.read");
  const on = await getSetting<boolean>("chat.presenceEnabled");
  if (!on) return <><AdminTitle title="Online users" /><Notice tone="warn">Presence is turned off (Messaging settings), so online status is not measured.</Notice></>;
  const db = await useDb();
  const rows = await db.select().from(schema.users).where(and(gte(schema.users.lastSeenAt, new Date(Date.now() - 5 * 60_000)), eq(schema.users.status, "active"))).orderBy(desc(schema.users.lastSeenAt)).limit(100);
  return (
    <>
      <AdminTitle title="Online users" description="Accounts with activity in the last 5 minutes. Presence is a heartbeat updated at most once a minute, so counts are approximate." />
      <Table head={["User", "Last activity"]} empty={rows.length ? undefined : "Nobody is online right now."}>{rows.map((u) => <tr key={u.id}><Td><Link className="hover:underline" href={`/admin/users/${u.id}`}>{u.displayName} <span className="text-muted">@{u.username}</span></Link></Td><Td>{formatDate(u.lastSeenAt, "en", { timeStyle: "medium", dateStyle: "short" })}</Td></tr>)}</Table>
    </>
  );
}
