import Link from "next/link";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { PageBanner } from "@/components/ui/page-banner";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { listGroups } from "@/server/services/business";
import { categoryNames } from "@/server/services/listings";

export const metadata = { title: "Groups", description: "Join communities on Nargito." };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, hasMore }, cats] = await Promise.all([listGroups({ q: sp.q?.slice(0, 100), category: sp.category, page }), categoryNames("group")]);
  return (
    <FeatureGate feature="groups">
      <PageBanner kind="banner-groups" eyebrow="Communities" title="Find Your" accent="Community" description="Join interest-based groups, local communities and events." actions={<Link href="/groups/new" className="btn-primary">Create a group</Link>} />
      <Container width="max-w-6xl">

        <FilterBar action="/groups" q={sp.q} fields={[{ name: "category", label: "Category", value: sp.category, options: cats.map((c) => ({ value: c, label: c })) }]} />
        {items.length === 0 ? <EmptyState title="No groups found" /> : <CardGrid>{items.map(({ g, members }) => <ListingCard key={g.id} href={`/groups/${g.slug}`} title={g.name} subtitle={g.description?.slice(0, 100)} image={g.coverUrl} badge={g.category} meta={`${members} member${members === 1 ? "" : "s"}`} ratio="aspect-[16/9]" />)}</CardGrid>}
        <Pager page={page} hasMore={hasMore} basePath="/groups" params={{ q: sp.q, category: sp.category }} />
      </Container>
    </FeatureGate>
  );
}
