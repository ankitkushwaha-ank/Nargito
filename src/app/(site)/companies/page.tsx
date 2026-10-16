import Link from "next/link";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader, EmptyState, Pager } from "@/components/ui/kit";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { FilterBar } from "@/components/ui/filter-bar";
import { listCompanies } from "@/server/services/business";
import { categoryNames } from "@/server/services/listings";

export const metadata = { title: "Companies", description: "Discover companies on Nargito." };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, hasMore }, cats] = await Promise.all([listCompanies({ q: sp.q?.slice(0, 100), industry: sp.industry, page }), categoryNames("company")]);
  return (
    <FeatureGate feature="companies">
      <Container width="max-w-6xl">
        <PageHeader title="Companies" actions={<Link href="/my/businesses/company/new" className="btn-primary">Create a company page</Link>} />
        <FilterBar action="/companies" q={sp.q} fields={[{ name: "industry", label: "Industry", value: sp.industry, options: cats.map((c) => ({ value: c, label: c })) }]} />
        {items.length === 0 ? <EmptyState title="No companies found" /> : <CardGrid>{items.map((c) => <ListingCard key={c.id} href={`/companies/${c.slug}`} title={c.name} subtitle={c.tagline ?? c.description?.slice(0, 100)} image={c.logoUrl ?? c.coverUrl} badge={c.industry} verified={c.verified} meta={c.locationLabel} ratio="aspect-[16/9]" />)}</CardGrid>}
        <Pager page={page} hasMore={hasMore} basePath="/companies" params={{ q: sp.q, industry: sp.industry }} />
      </Container>
    </FeatureGate>
  );
}
