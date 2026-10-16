import Link from "next/link";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { PageBanner } from "@/components/ui/page-banner";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { listShops } from "@/server/services/business";
import { categoryNames } from "@/server/services/listings";

export const metadata = { title: "Shops", description: "Browse shops on Nargito." };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, hasMore }, cats] = await Promise.all([listShops({ q: sp.q?.slice(0, 100), category: sp.category, page }), categoryNames("shop")]);
  return (
    <FeatureGate feature="shops">
      <PageBanner kind="banner-shops" eyebrow="Shops" title="Local" accent="Shops" description="Discover and support businesses in your community." actions={<Link href="/my/businesses/shop/new" className="btn-primary">Open a shop</Link>} />
      <Container width="max-w-6xl">

        <FilterBar action="/shops" q={sp.q} fields={[{ name: "category", label: "Category", value: sp.category, options: cats.map((c) => ({ value: c, label: c })) }]} />
        {items.length === 0 ? <EmptyState title="No shops found" /> : <CardGrid>{items.map((s) => <ListingCard key={s.id} href={`/shops/${s.slug}`} title={s.name} subtitle={s.description?.slice(0, 100)} image={s.logoUrl ?? s.coverUrl} badge={s.category} verified={s.verified} meta={s.locationLabel} ratio="aspect-[16/9]" />)}</CardGrid>}
        <Pager page={page} hasMore={hasMore} basePath="/shops" params={{ q: sp.q, category: sp.category }} />
      </Container>
    </FeatureGate>
  );
}
