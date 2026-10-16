import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Pencil } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getService } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Avatar, Badge, CoverImage, Notice, VerifiedBadge } from "@/components/ui/kit";
import { EnquireButton } from "@/components/messaging/enquire-button";
import { SaveButton } from "@/components/social/save-button";
import { ReportButton } from "@/components/social/report-button";
import { ShareButton } from "@/components/social/share-button";
import { RichText } from "@/components/social/rich-text";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { useDb, schema } from "@/server/db";

export async function generateMetadata({ params }: { params: Promise<{ serviceId: string }> }): Promise<Metadata> {
  const { serviceId } = await params;
  const db = await useDb();
  const [s] = /^[0-9a-f-]{36}$/i.test(serviceId) ? await db.select().from(schema.services).where(and(eq(schema.services.id, serviceId), eq(schema.services.status, "active"))) : [];
  if (!s) return { title: "Service", robots: { index: false, follow: false } };
  return { title: s.title, description: (s.description ?? s.title).slice(0, 160), alternates: { canonical: `/services/${s.id}` }, openGraph: { title: s.title, description: (s.description ?? "").slice(0, 160), images: [s.images[0] ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [s.images[0] ?? "/api/brand/og"] } };
}

export default async function ServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const viewer = await getSessionUser();
  const r = await getService(serviceId, viewer?.id ?? null);
  if (!r) notFound();
  const { s, provider, company, manage } = r;
  const locale = await getLocale();
  const saved = viewer ? !!(await (await useDb()).select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "service"), eq(schema.savedItems.entityId, s.id))))[0] : false;
  const jsonLd = { "@context": "https://schema.org", "@type": "Service", name: s.title, description: s.description ?? undefined, areaServed: s.serviceArea ?? undefined, provider: { "@type": "Person", name: provider.displayName } };
  return (
    <FeatureGate feature="services">
      <Container width="max-w-5xl">
        {s.status === "active" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        {s.status !== "active" && <div className="mb-4"><Notice tone="warn">This service is {s.status} and only visible to you and your team.</Notice></div>}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <CoverImage src={s.images[0]} alt={s.title} ratio="aspect-[4/3]" zoom zoomGroup="gallery" />
            {s.images.length > 1 && <ul className="grid grid-cols-4 gap-2" aria-label="Portfolio">{s.images.slice(1).map((i) => <li key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i} data-zoom={i} data-zoom-group="gallery" alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" /></li>)}</ul>}
          </div>
          <div className="space-y-4">
            <div>
              {s.category && <Badge>{s.category}</Badge>}
              <h1 className="mt-2 text-2xl">{s.title}</h1>
              <p className="mt-1 text-xl font-semibold text-primary">{s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}${s.pricingModel === "hourly" ? " / hour" : ""}` : "Quote on request"}</p>
              {s.serviceArea && <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin size={14} aria-hidden />{s.serviceArea}</p>}
              {s.availability && <p className="text-sm text-muted">Availability: {s.availability}</p>}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {manage ? <Link href={`/my/listings/service/${s.id}`} className="btn-primary"><Pencil size={16} aria-hidden />Edit service</Link> : s.status === "active" ? <EnquireButton listingType="service" listingId={s.id} title={s.title} signedIn={!!viewer} label="Request a quote" /> : null}
              {viewer && <SaveButton entityType="service" entityId={s.id} initial={saved} />}
              <ShareButton path={`/services/${s.id}`} title={s.title} />
              {viewer && !manage && <ReportButton entityType="service" entityId={s.id} />}
            </div>
            <div className="card flex items-center gap-3 p-3">
              <Avatar name={provider.displayName} src={provider.avatarUrl} size={44} />
              <div className="min-w-0"><p className="text-xs text-muted">Provider</p><Link href={`/profile/${provider.username}`} className="flex items-center gap-1 font-medium hover:underline">{provider.displayName}{provider.verified && <VerifiedBadge />}</Link>{company && <Link href={`/companies/${company.slug}`} className="text-sm text-muted hover:underline">{company.name}</Link>}</div>
            </div>
            {s.description && <section><h2 className="text-lg">About this service</h2><div className="mt-1 text-sm"><RichText text={s.description} /></div></section>}
          </div>
        </div>
      </Container>
    </FeatureGate>
  );
}
