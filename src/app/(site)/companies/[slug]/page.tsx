import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { getCompany } from "@/server/services/business";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { BusinessView } from "@/components/business/business-view";
import { FeedList } from "@/components/social/feed-list";
import { getFeed } from "@/server/services/posts";
import { useDb, schema } from "@/server/db";
import { getLocale } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = await useDb();
  const [c] = await db.select().from(schema.companies).where(and(eq(schema.companies.slug, slug), eq(schema.companies.status, "active")));
  if (!c) return { title: "Company", robots: { index: false, follow: false } };
  return { title: c.name, description: (c.tagline ?? c.description ?? c.name).slice(0, 160), alternates: { canonical: `/companies/${c.slug}` }, openGraph: { title: c.name, images: [c.coverUrl ?? c.logoUrl ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [c.coverUrl ?? c.logoUrl ?? "/api/brand/og"] } };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getSessionUser();
  const r = await getCompany(slug, viewer?.id ?? null);
  if (!r) notFound();
  const db = await useDb();
  const [products, services, feed, saved] = await Promise.all([
    db.select().from(schema.products).where(and(eq(schema.products.companyId, r.c.id), eq(schema.products.status, "active"))).orderBy(desc(schema.products.createdAt)).limit(6),
    db.select().from(schema.services).where(and(eq(schema.services.companyId, r.c.id), eq(schema.services.status, "active"))).orderBy(desc(schema.services.createdAt)).limit(6),
    getFeed(viewer?.id ?? null, { companyId: r.c.id, limit: 5 }),
    viewer ? db.select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "company"), eq(schema.savedItems.entityId, r.c.id))) : Promise.resolve([]),
  ]);
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: r.c.name, url: r.c.website ?? undefined, description: r.c.description ?? undefined, logo: r.c.logoUrl ?? undefined };
  return (
    <FeatureGate feature="companies">
      <Container width="max-w-6xl">
        {r.c.status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        <BusinessView kind="company" entity={r.c} role={r.role} followers={r.followers} following={r.following} team={r.team} viewerId={viewer?.id ?? null} products={products} services={services} locale={await getLocale()} saved={saved.length > 0} editHref={`/my/businesses/company/${r.c.id}`} />
        {feed.items.length > 0 && <section className="mt-6" aria-labelledby="upd-h"><h2 id="upd-h" className="mb-3 text-lg">Updates</h2><FeedList initialItems={feed.items} initialCursor={feed.nextCursor} query={`company=${r.c.id}`} sponsoredEvery={0} /></section>}
      </Container>
    </FeatureGate>
  );
}
