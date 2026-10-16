import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { myBusinesses } from "@/server/services/business";
import { listingStats } from "@/server/services/listings";
import { EmptyState, PageHeader, Badge, Stat } from "@/components/ui/kit";
import { useDb, schema } from "@/server/db";
import { isFeatureEnabled } from "@/server/features";

export const metadata = { title: "My companies & shops" };

export default async function MyBusinesses() {
  const user = await requireUserPage("/my/businesses");
  const [{ companies, shops }, stats, cOn, sOn] = await Promise.all([myBusinesses(user.id), listingStats(user.id), isFeatureEnabled("companies"), isFeatureEnabled("shops")]);
  const db = await useDb();
  const [{ n: newEnq }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.enquiries).where(sql`${schema.enquiries.recipientId} = ${user.id} and ${schema.enquiries.status} = 'new'`);
  void eq;
  return (
    <ThreeColumn user={user} right={false}>
      <PageHeader title="Business workspace" description="Manage your companies, shops, catalogue, team and enquiries." actions={<>{cOn && <Link href="/my/businesses/company/new" className="btn-primary">New company</Link>}{sOn && <Link href="/my/businesses/shop/new" className="btn-secondary">New shop</Link>}</>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open enquiries" value={newEnq!} hint={<Link href="/my/businesses/inbox" className="link">Open inbox</Link>} />
        <Stat label="Total enquiries" value={stats.enquiries} /><Stat label="Listing views" value={stats.products.views + stats.services.views} /><Stat label="Saves" value={stats.saves} />
      </div>
      <div className="flex flex-wrap gap-2"><Link href="/my/listings" className="btn-secondary">Catalogue & services</Link><Link href="/my/businesses/inbox" className="btn-secondary">Business inbox</Link><Link href="/my/ads" className="btn-secondary">Promotions</Link></div>
      <section aria-labelledby="co-h"><h2 id="co-h" className="mb-2 text-lg">Companies</h2>
        {companies.length === 0 ? <EmptyState title="No companies yet" /> : <ul className="card divide-y divide-line">{companies.map(({ c, role }) => <li key={c.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><Link href={`/companies/${c.slug}`} className="font-medium hover:underline">{c.name}</Link><p className="text-sm text-muted">{c.industry}</p></div><Badge tone="muted">{role}</Badge>{c.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}{c.status !== "active" && <Badge tone="danger">{c.status}</Badge>}<Link href={`/my/businesses/company/${c.id}`} className="btn-secondary !min-h-[32px]">Manage</Link></li>)}</ul>}
      </section>
      <section aria-labelledby="sh-h"><h2 id="sh-h" className="mb-2 text-lg">Shops</h2>
        {shops.length === 0 ? <EmptyState title="No shops yet" /> : <ul className="card divide-y divide-line">{shops.map(({ s, role }) => <li key={s.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><Link href={`/shops/${s.slug}`} className="font-medium hover:underline">{s.name}</Link><p className="text-sm text-muted">{s.category}</p></div><Badge tone="muted">{role}</Badge>{s.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}{s.status !== "active" && <Badge tone="danger">{s.status}</Badge>}<Link href={`/my/businesses/shop/${s.id}`} className="btn-secondary !min-h-[32px]">Manage</Link></li>)}</ul>}
      </section>
    </ThreeColumn>
  );
}
