import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { PRO_FEATURES } from "@/lib/pro-features";
import { FeatureGate } from "@/components/ui/feature-gate";
import Link from "next/link";

export const metadata = { title: "Pro features" };

export default async function ProFeatures() {
  await adminPage("pro.manage");
  const db = await useDb();
  const plans = await db.select().from(schema.subscriptionPlans).orderBy(schema.subscriptionPlans.priceCents);
  return (
    <FeatureGate feature="pro">
      <AdminTitle title="Pro features" description="Entitlements are enforced on the server (hasEntitlement). Assign them to plans in Pro configuration." actions={<Link href="/admin/pro/config" className="btn-secondary">Edit plans</Link>} />
      <Table head={["Entitlement", "Key", ...plans.map((p) => p.name)]}>
        {PRO_FEATURES.map((f) => (
          <tr key={f.key}><Td><b>{f.label}</b><p className="text-xs text-muted">{f.description}</p></Td><Td><code className="text-xs">{f.key}</code></Td>{plans.map((p) => <Td key={p.id}>{p.features.includes(f.key) ? <Badge tone="success">included</Badge> : <span className="text-muted">-</span>}</Td>)}</tr>
        ))}
      </Table>
    </FeatureGate>
  );
}
