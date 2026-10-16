import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { getShop } from "@/server/services/business";
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
  const [s] = await db.select().from(schema.shops).where(and(eq(schema.shops.slug, slug), eq(schema.shops.status, "active")));
  if (!s) return { title: "Shop", robots: { index: false, follow: false } };
  return { title: s.name, description: (s.description ?? s.name).slice(0, 160), alternates: { canonical: `/shops/${s.slug}` }, openGraph: { title: s.name, images: [s.coverUrl ?? s.logoUrl ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [s.coverUrl ?? s.logoUrl ?? "/api/brand/og"] } };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getSessionUser();
  const r = await getShop(slug, viewer?.id ?? null);
  if (!r) notFound();
  const db = await useDb();
  const [products, feed, saved] = await Promise.all([
    db.select().from(schema.products).where(and(eq(schema.products.shopId, r.s.id), eq(schema.products.status, "active"))).orderBy(desc(schema.products.createdAt)).limit(24),
    getFeed(viewer?.id ?? null, { shopId: r.s.id, limit: 5 }),
    viewer ? db.select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "shop"), eq(schema.savedItems.entityId, r.s.id))) : Promise.resolve([]),
  ]);
  const jsonLd = { "@context": "https://schema.org", "@type": "Store", name: r.s.name, description: r.s.description ?? undefined, image: r.s.logoUrl ?? undefined, openingHours: r.s.hours ?? undefined };
  return (
    <FeatureGate feature="shops">
      <Container width="max-w-6xl">
        {r.s.status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        <BusinessView kind="shop" entity={r.s} role={r.role} followers={r.followers} following={r.following} team={r.team} viewerId={viewer?.id ?? null} products={products} services={[]} locale={await getLocale()} saved={saved.length > 0} editHref={`/my/businesses/shop/${r.s.id}`} />
        {feed.items.length > 0 && <section className="mt-6" aria-labelledby="upd-h"><h2 id="upd-h" className="mb-3 text-lg">Updates</h2><FeedList initialItems={feed.items} initialCursor={feed.nextCursor} query={`shop=${r.s.id}`} sponsoredEvery={0} /></section>}
      </Container>
    </FeatureGate>
  );
}
