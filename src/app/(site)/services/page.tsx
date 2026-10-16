import Link from "next/link";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader, EmptyState, Pager } from "@/components/ui/kit";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { listServices, categoryNames } from "@/server/services/listings";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Services", description: "Find service providers on Nargito." };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, hasMore }, cats] = await Promise.all([listServices({ q: sp.q?.slice(0, 100), category: sp.category, sort: sp.sort === "price_asc" ? "price_asc" : "new", page }), categoryNames("service")]);
  return (
    <FeatureGate feature="services">
      <Container width="max-w-6xl">
        <PageHeader title="Services" description="Photographers, tutors, guides and more." actions={<Link href="/my/listings/service/new" className="btn-primary">Offer a service</Link>} />
        <FilterBar action="/services" q={sp.q} fields={[{ name: "category", label: "Category", value: sp.category, options: cats.map((c) => ({ value: c, label: c })) }, { name: "sort", label: "Sort", value: sp.sort, options: [{ value: "new", label: "Newest" }, { value: "price_asc", label: "Lowest starting price" }] }]} />
        {items.length === 0 ? <EmptyState title="No services found" /> : (
          <CardGrid>{items.map((s) => <ListingCard key={s.id} href={`/services/${s.id}`} title={s.title} subtitle={s.serviceArea ?? s.category} image={s.images[0]} badge={s.category} meta={s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}${s.pricingModel === "hourly" ? "/hr" : ""}` : "Quote on request"} />)}</CardGrid>
        )}
        <Pager page={page} hasMore={hasMore} basePath="/services" params={{ q: sp.q, category: sp.category, sort: sp.sort }} />
      </Container>
    </FeatureGate>
  );
}
