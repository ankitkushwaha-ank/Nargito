import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { PageBanner } from "@/components/ui/page-banner";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { listProducts, categoryNames } from "@/server/services/listings";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import Link from "next/link";

export const metadata = { title: "Products", description: "Browse products listed by Nargito members and shops." };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const page = Math.max(1, Number(sp.page) || 1);
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const sort = (["new", "price_asc", "price_desc"] as const).find((s) => s === sp.sort);
  const [{ items, hasMore }, cats] = await Promise.all([listProducts({ q: sp.q?.slice(0, 100), category: sp.category, min: num(sp.min), max: num(sp.max), sort, page }), categoryNames("product")]);
  return (
    <FeatureGate feature="products">
      <Container width="max-w-6xl">
        <PageBanner kind="banner-marketplace" eyebrow="Marketplace" title="Buy Local," accent="Support Real People." description="Discover unique products, handmade items, local shops and services from people around you." actions={<Link href="/my/listings/product/new" className="btn-primary">List a product</Link>} />
        <FilterBar action="/products" q={sp.q} fields={[
          { name: "category", label: "Category", value: sp.category, options: cats.map((c) => ({ value: c, label: c })) },
          { name: "min", label: "Min price", value: sp.min, type: "number" }, { name: "max", label: "Max price", value: sp.max, type: "number" },
          { name: "sort", label: "Sort", value: sp.sort, options: [{ value: "new", label: "Newest" }, { value: "price_asc", label: "Price: low to high" }, { value: "price_desc", label: "Price: high to low" }] },
        ]} />
        {items.length === 0 ? <EmptyState title="No products found" description="Try different filters, or list your own product." /> : (
          <CardGrid>{items.map((p) => <ListingCard key={p.id} href={`/products/${p.id}`} title={p.title} subtitle={p.locationLabel ?? p.category} image={p.images[0]} meta={p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"} badge={p.condition ? p.condition.replace("_", " ") : undefined} />)}</CardGrid>
        )}
        <Pager page={page} hasMore={hasMore} basePath="/products" params={{ q: sp.q, category: sp.category, min: sp.min, max: sp.max, sort: sp.sort }} />
      </Container>
    </FeatureGate>
  );
}
