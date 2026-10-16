import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { cancelMembershipAction, grantMembershipAction } from "../actions";
import { formatDate } from "@/lib/format";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Pro members" };

export default async function ProMembers() {
  await adminPage("pro.manage");
  const db = await useDb();
  const [rows, plans] = await Promise.all([
    db.select({ s: schema.subscriptions, u: schema.users, p: schema.subscriptionPlans }).from(schema.subscriptions).innerJoin(schema.users, eq(schema.users.id, schema.subscriptions.userId)).innerJoin(schema.subscriptionPlans, eq(schema.subscriptionPlans.id, schema.subscriptions.planId)).orderBy(desc(schema.subscriptions.startedAt)).limit(100),
    db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.active, true)),
  ]);
  return (
    <FeatureGate feature="pro">
      <AdminTitle title="Pro members" description="Subscription history. Complimentary grants carry no payment record and do not count as revenue." />
      <Table head={["Member", "Plan", "Status", "Source", "Started", "Expires", ""]} empty={rows.length ? undefined : "No memberships yet."}>
        {rows.map(({ s, u, p }) => (
          <tr key={s.id}><Td><Link className="link" href={`/admin/users/${u.id}`}>{u.displayName}</Link></Td><Td>{p.name}</Td><Td><Badge tone={s.status === "active" ? "success" : s.status === "past_due" ? "warn" : "muted"}>{s.status}</Badge></Td><Td>{s.provider === "admin" ? "Complimentary" : s.provider ?? "-"}</Td><Td>{formatDate(s.startedAt, "en")}</Td><Td>{s.expiresAt ? formatDate(s.expiresAt, "en") : "-"}</Td>
            <Td>{s.status === "active" && <form action={cancelMembershipAction}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !min-h-[28px] text-danger">Cancel</button></form>}</Td></tr>
        ))}
      </Table>
      <ActionForm action={grantMembershipAction} className="card mt-5 grid gap-3 p-5 sm:grid-cols-4 sm:items-end" resetOnSuccess>
        <Field label="Username" name="username" required placeholder="@username" /><Field label="Plan" name="planId" as="select" options={plans.map((p) => ({ value: p.id, label: p.name }))} /><Field label="Days" name="days" type="number" min={1} max={365} defaultValue={30} /><SubmitButton variant="secondary">Grant complimentary membership</SubmitButton>
      </ActionForm>
    </FeatureGate>
  );
}
