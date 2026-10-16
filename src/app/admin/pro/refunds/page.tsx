import { desc, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { decideRefundAction } from "../actions";
import { formatDate, formatMoney } from "@/lib/format";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Pro refunds" };

export default async function ProRefunds({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("pro.manage");
  const sp = await searchParams;
  const db = await useDb();
  const rows = await db.select({ r: schema.refunds, p: schema.payments }).from(schema.refunds).innerJoin(schema.payments, eq(schema.payments.id, schema.refunds.paymentId)).orderBy(desc(schema.refunds.createdAt)).limit(100);
  return (
    <FeatureGate feature="pro">
      <AdminTitle title="Pro refunds" description="Workflow: request, second-person approval, then processing through the payment provider. A refund is marked processed only after the provider confirms it." />
      {sp.notice === "awaiting-approval" && <div className="mb-4"><Notice tone="warn">Approval requested. Another administrator must approve it in Security &gt; Approvals; then click Approve again here.</Notice></div>}
      {sp.error && <div className="mb-4"><Notice tone="danger">{sp.error.slice(0, 200)}</Notice></div>}
      <Table head={["Requested", "Amount", "Payment", "Reason", "Status", "Actions"]} empty={rows.length ? undefined : "No refunds."}>
        {rows.map(({ r, p }) => (
          <tr key={r.id}><Td>{formatDate(r.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{formatMoney(r.amountCents / 100, p.currency, "en")}</Td><Td><code className="text-xs">{p.providerRef.slice(0, 14)}…</code></Td><Td>{r.reason}</Td><Td><Badge tone={r.status === "processed" ? "success" : r.status === "rejected" ? "danger" : "warn"}>{r.status}</Badge></Td>
            <Td><form action={decideRefundAction} className="flex gap-1"><input type="hidden" name="id" value={r.id} />
              {r.status === "requested" && <><button name="op" value="approve" className="btn-primary !min-h-[30px]">Approve</button><button name="op" value="reject" className="btn-secondary !min-h-[30px]">Reject</button></>}
              {r.status === "approved" && <button name="op" value="process" className="btn-primary !min-h-[30px]">Process with provider</button>}</form></Td></tr>
        ))}
      </Table>
    </FeatureGate>
  );
}
