import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, PageHeader, Badge } from "@/components/ui/kit";
import { myGroups } from "@/server/services/business";

export const metadata = { title: "My groups" };

export default async function MyGroups() {
  const user = await requireUserPage("/my/groups");
  const rows = await myGroups(user.id);
  return (
    <FeatureGate feature="groups">
      <ThreeColumn user={user} right={false}>
        <PageHeader title="My groups" actions={<Link href="/groups/new" className="btn-primary">Create a group</Link>} />
        {rows.length === 0 ? <EmptyState title="You haven't joined any groups" action={<Link href="/groups" className="btn-primary">Browse groups</Link>} /> : (
          <ul className="space-y-3">{rows.map(({ g, role, status }) => <li key={g.id} className="card flex items-center justify-between p-4"><div><Link href={`/groups/${g.slug}`} className="font-medium hover:underline">{g.name}</Link><p className="text-sm text-muted">{g.category}</p></div><div className="flex gap-2"><Badge>{role}</Badge>{status === "pending" && <Badge tone="warn">pending</Badge>}</div></li>)}</ul>
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
