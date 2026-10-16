import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { decideApproval } from "@/server/approvals";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Approvals" };

async function decide(fd: FormData) {
  "use server";
  const u = await adminUser("approvals.decide");
  await decideApproval(u.id, String(fd.get("id")), fd.get("op") === "approve");
  revalidatePath("/admin/approvals");
}

export default async function Approvals() {
  const me = await adminPage("approvals.decide");
  const db = await useDb();
  const rows = await db.select({ a: schema.adminApprovals, who: schema.users.username }).from(schema.adminApprovals).leftJoin(schema.users, eq(schema.users.id, schema.adminApprovals.requestedBy)).orderBy(desc(schema.adminApprovals.createdAt)).limit(60);
  return (
    <>
      <AdminTitle title="Approvals" description="Critical operations (emergency pauses, refunds) need a second administrator. You cannot approve a request you made yourself. Approval is single-use." />
      <Table head={["Requested", "Action", "Requested by", "Status", ""]} empty={rows.length ? undefined : "No approval requests."}>
        {rows.map(({ a, who }) => (
          <tr key={a.id}><Td className="text-xs">{formatDate(a.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td><Td><code className="text-xs">{a.action}</code></Td><Td>@{who ?? "?"}</Td><Td><Badge tone={a.status === "pending" ? "warn" : a.status === "rejected" ? "danger" : "success"}>{a.status}</Badge></Td>
            <Td>{a.status === "pending" && (a.requestedBy === me.id ? <span className="text-xs text-muted">Waiting for another admin</span> : <form action={decide} className="flex gap-1"><input type="hidden" name="id" value={a.id} /><button name="op" value="approve" className="btn-primary !min-h-[30px]">Approve</button><button name="op" value="reject" className="btn-secondary !min-h-[30px]">Reject</button></form>)}</Td></tr>
        ))}
      </Table>
    </>
  );
}
