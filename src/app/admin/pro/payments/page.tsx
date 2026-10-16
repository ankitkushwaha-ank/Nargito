import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { requestRefundAction } from "../actions";
import { formatDate, formatMoney } from "@/lib/format";
import { FeatureGate } from "@/components/ui/feature-gate";
import { paymentsStatus } from "@/server/services/pro";

export const metadata = { title: "Pro payments" };

export default async function ProPayments() {
  await adminPage("pro.manage");
  const db = await useDb();
  const rows = await db.select({ p: schema.payments, u: schema.users.displayName, uid: schema.users.id }).from(schema.payments).leftJoin(schema.users, eq(schema.users.id, schema.payments.userId)).orderBy(desc(schema.payments.createdAt)).limit(100);
  return (
    <FeatureGate feature="pro">
      <AdminTitle title="Pro payments" description="Payment records are created only by verified payment-provider webhooks. They cannot be added or edited here." />
      {!paymentsStatus().stripe && rows.length === 0 && <div className="mb-4"><Notice tone="warn">No payment provider is configured, so there are no payment records.</Notice></div>}
      <Table head={["Date", "Member", "Amount", "Status", "Provider ref", "Refund"]} empty={rows.length ? undefined : "No payments recorded."}>
        {rows.map(({ p, u, uid }) => (
          <tr key={p.id}><Td>{formatDate(p.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{uid ? <Link className="link" href={`/admin/users/${uid}`}>{u}</Link> : "-"}</Td><Td>{formatMoney(p.amountCents / 100, p.currency, "en")}</Td><Td><Badge tone={p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : "warn"}>{p.status.replace("_", " ")}</Badge></Td><Td><code className="text-xs">{p.provider}:{p.providerRef.slice(0, 14)}…</code></Td>
            <Td>{(p.status === "succeeded" || p.status === "partially_refunded") && (
              <ActionForm action={requestRefundAction} className="flex items-center gap-1"><input type="hidden" name="paymentId" value={p.id} /><label className="sr-only" htmlFor={`ra-${p.id}`}>Refund amount</label><input id={`ra-${p.id}`} name="amount" type="number" step="0.01" min="0.01" max={p.amountCents / 100} defaultValue={p.amountCents / 100} className="input !w-24 !py-1" /><input name="reason" placeholder="Reason" aria-label="Reason" className="input !w-32 !py-1" /><SubmitButton variant="secondary" className="!min-h-[30px]">Request</SubmitButton></ActionForm>
            )}</Td></tr>
        ))}
      </Table>
    </FeatureGate>
  );
}
