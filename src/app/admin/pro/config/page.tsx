import Link from "next/link";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle } from "@/components/admin/admin-ui";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { Badge, Notice } from "@/components/ui/kit";
import { savePlanAction } from "../actions";
import { PRO_FEATURES } from "@/lib/pro-features";
import { paymentsStatus } from "@/server/services/pro";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Pro configuration" };

function PlanForm({ plan }: { plan?: typeof schema.subscriptionPlans.$inferSelect }) {
  return (
    <ActionForm action={savePlanAction} className="card space-y-3 p-5">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <h2 className="text-lg">{plan ? plan.name : "New plan"} {plan && !plan.active && <Badge tone="muted">inactive</Badge>}</h2>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Name" name="name" required defaultValue={plan?.name} maxLength={60} /><Field label="Description" name="description" defaultValue={plan?.description} maxLength={300} />
        <Field label="Price" name="price" type="number" min={0} step="0.01" defaultValue={plan ? plan.priceCents / 100 : 0} /><Field label="Currency" name="currency" defaultValue={plan?.currency ?? "INR"} maxLength={3} />
        <Field label="Billing interval" name="interval" as="select" defaultValue={plan?.interval ?? "month"} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} /></div>
      <fieldset><legend className="label">Included features</legend><div className="grid gap-1 sm:grid-cols-2">{PRO_FEATURES.map((f) => (<label key={f.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name="features" value={f.key} defaultChecked={plan?.features.includes(f.key)} className="accent-primary" />{f.label}</label>))}</div></fieldset>
      <Checkbox name="active" label="Plan is available" defaultChecked={plan?.active ?? true} />
      <SubmitButton>{plan ? "Save plan" : "Create plan"}</SubmitButton>
    </ActionForm>
  );
}

export default async function ProConfig() {
  await adminPage("pro.manage");
  const db = await useDb();
  const plans = await db.select().from(schema.subscriptionPlans).orderBy(schema.subscriptionPlans.priceCents);
  const stripe = paymentsStatus().stripe;
  return (
    <FeatureGate feature="pro">
      <AdminTitle title="Pro configuration" description="Define plans and prices. Changing a price affects new purchases only. Saving requires re-authentication." actions={<Link href="/admin/settings/pro" className="btn-secondary">Payments & availability</Link>} />
      <div className="mb-4"><Notice tone={stripe ? "info" : "warn"}>{stripe ? "Stripe keys are present. Checkout and webhooks are active when the payment provider is set to Stripe." : "No payment provider is configured. Plans can be defined, but they cannot be purchased and no payments will be recorded."}</Notice></div>
      <div className="grid gap-5 lg:grid-cols-2">{plans.map((p) => <PlanForm key={p.id} plan={p} />)}<PlanForm /></div>
    </FeatureGate>
  );
}
