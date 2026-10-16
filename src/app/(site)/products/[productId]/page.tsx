import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Pencil } from "lucide-react";
import { getProduct } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Avatar, Badge, CoverImage, Notice, VerifiedBadge } from "@/components/ui/kit";
import { EnquireButton } from "@/components/messaging/enquire-button";
import { SaveButton } from "@/components/social/save-button";
import { ReportButton } from "@/components/social/report-button";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { RichText } from "@/components/social/rich-text";
import { useDb, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { ShareButton } from "@/components/social/share-button";

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  const db = await useDb();
  const ok = /^[0-9a-f-]{36}$/i.test(productId);
  const [p] = ok ? await db.select().from(schema.products).where(and(eq(schema.products.id, productId), eq(schema.products.status, "active"))) : [];
  if (!p) return { title: "Product", robots: { index: false, follow: false } };
  return { title: p.title, description: (p.description ?? p.title).slice(0, 160), alternates: { canonical: `/products/${p.id}` }, openGraph: { title: p.title, description: (p.description ?? "").slice(0, 160), images: [p.images[0] ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [p.images[0] ?? "/api/brand/og"] } };
}

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const viewer = await getSessionUser();
  const r = await getProduct(productId, viewer?.id ?? null);
  if (!r) notFound();
  const { p, seller, shop, company, manage } = r;
  const locale = await getLocale();
  const saved = viewer ? !!(await (await useDb()).select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "product"), eq(schema.savedItems.entityId, p.id))))[0] : false;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.description ?? undefined, image: p.images, offers: p.price ? { "@type": "Offer", price: p.price, priceCurrency: p.currency, availability: p.availability === "out_of_stock" || p.status === "sold" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } : undefined };
  return (
    <FeatureGate feature="products">
      <Container width="max-w-5xl">
        {p.status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        {p.status !== "active" && <div className="mb-4"><Notice tone="warn">This listing is {p.status}{manage ? " and only visible to you and your team" : ""}.</Notice></div>}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <CoverImage src={p.images[0]} alt={p.title} ratio="aspect-[4/3]" zoom zoomGroup="gallery" />
            {p.images.length > 1 && <ul className="grid grid-cols-4 gap-2">{p.images.slice(1).map((i) => <li key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i} data-zoom={i} data-zoom-group="gallery" alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" /></li>)}</ul>}
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-2">{p.category && <Badge>{p.category}</Badge>}{p.condition && <Badge tone="muted">{p.condition.replace("_", " ")}</Badge>}<Badge tone={p.availability === "out_of_stock" ? "danger" : p.availability === "limited" ? "warn" : "success"}>{p.availability.replace("_", " ")}</Badge></div>
              <h1 className="mt-2 text-2xl">{p.title}</h1>
              <p className="mt-1 text-2xl font-semibold text-primary">{p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"}</p>
              {p.locationLabel && <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin size={14} aria-hidden />{p.locationLabel}</p>}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {manage ? <Link href={`/my/listings/product/${p.id}`} className="btn-primary"><Pencil size={16} aria-hidden />Edit listing</Link> : p.status === "active" ? <EnquireButton listingType="product" listingId={p.id} title={p.title} signedIn={!!viewer} /> : null}
              {viewer && <SaveButton entityType="product" entityId={p.id} initial={saved} />}
              <ShareButton path={`/products/${p.id}`} title={p.title} />
              {viewer && !manage && <ReportButton entityType="product" entityId={p.id} />}
            </div>
            <div className="card flex items-center gap-3 p-3">
              <Avatar name={shop?.name ?? seller.displayName} src={shop?.logoUrl ?? seller.avatarUrl} size={44} />
              <div className="min-w-0"><p className="text-xs text-muted">Sold by</p>
                {shop ? <Link href={`/shops/${shop.slug}`} className="flex items-center gap-1 font-medium hover:underline">{shop.name}{shop.verified && <VerifiedBadge />}</Link> : company ? <Link href={`/companies/${company.slug}`} className="font-medium hover:underline">{company.name}</Link> : <Link href={`/profile/${seller.username}`} className="flex items-center gap-1 font-medium hover:underline">{seller.displayName}{seller.verified && <VerifiedBadge />}</Link>}
              </div>
            </div>
            {p.description && <section><h2 className="text-lg">Description</h2><div className="mt-1 text-sm"><RichText text={p.description} /></div></section>}
            <p className="text-xs text-muted">Nargito connects buyers and sellers. Payment and delivery are agreed directly between you.</p>
          </div>
        </div>
      </Container>
    </FeatureGate>
  );
}
