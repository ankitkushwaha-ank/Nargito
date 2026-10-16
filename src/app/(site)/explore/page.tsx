import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState } from "@/components/ui/kit";
import { PageBanner } from "@/components/ui/page-banner";
import { Plane, Store, ShoppingBag, Wrench, UtensilsCrossed, Home, CalendarDays, UserRound } from "lucide-react";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { SearchBox } from "@/components/shell/search-box";
import { useDb, schema } from "@/server/db";
import { getDiscovery } from "@/server/services/discovery";
import { isFeatureEnabled } from "@/server/features";
import { formatDate, formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Explore", description: "Discover trips, shops, products, services and people on Nargito." };

export default async function Explore() {
  const viewer = await getSessionUser();
  const locale = await getLocale();
  const db = await useDb();
  const [d, on] = await Promise.all([getDiscovery(viewer?.id ?? null), Promise.all(["trips", "shops", "products", "services", "groups"].map(isFeatureEnabled))]);
  const [tripsOn, shopsOn, productsOn, servicesOn, groupsOn] = on;
  const [trips, shops, products, services, groups] = await Promise.all([
    tripsOn ? db.select().from(schema.trips).where(and(eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"))).orderBy(desc(schema.trips.createdAt)).limit(3) : [],
    shopsOn ? db.select().from(schema.shops).where(eq(schema.shops.status, "active")).orderBy(desc(schema.shops.createdAt)).limit(3) : [],
    productsOn ? db.select().from(schema.products).where(eq(schema.products.status, "active")).orderBy(desc(schema.products.createdAt)).limit(3) : [],
    servicesOn ? db.select().from(schema.services).where(eq(schema.services.status, "active")).orderBy(desc(schema.services.createdAt)).limit(3) : [],
    groupsOn ? db.select().from(schema.groups).where(and(eq(schema.groups.status, "active"), eq(schema.groups.visibility, "public"))).orderBy(desc(schema.groups.createdAt)).limit(3) : [],
  ]);
  const Section = ({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: boolean }) => empty ? null : (
    <section className="mb-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl">{title}</h2><Link href={href} className="link text-sm">See all</Link></div>{children}</section>
  );
  const nothing = !trips.length && !shops.length && !products.length && !services.length && !groups.length;
  return (
    <FeatureGate feature="search">
      <PageBanner kind="banner-explore" eyebrow="Explore" title="Discover New" accent="Experiences" description="Find trips, local shops, products, services and amazing people around you."><SearchBox className="max-w-md" /></PageBanner>
      <Container width="max-w-6xl">

        <nav aria-label="Categories" className="no-scrollbar -mx-1 mb-7 flex gap-3 overflow-x-auto px-1 pb-1 sm:justify-between">
          {[["/trips", "Trips", Plane, "bg-blue-100 text-primary"], ["/shops", "Shops", Store, "bg-emerald-100 text-emerald-600"], ["/products", "Products", ShoppingBag, "bg-violet-100 text-violet-600"], ["/services", "Services", Wrench, "bg-indigo-100 text-indigo-600"], ["/search?q=food", "Food & Drinks", UtensilsCrossed, "bg-orange-100 text-orange-500"], ["/search?q=stay", "Stays", Home, "bg-sky-100 text-sky-600"], ["/groups", "Events", CalendarDays, "bg-pink-100 text-pink-500"], ["/people", "People", UserRound, "bg-rose-100 text-rose-500"]].map(([href, label, Icon, tone]) => {
            const I = Icon as typeof Plane;
            return <Link key={href as string} href={href as string} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5 text-center text-xs font-semibold"><span className={`flex h-14 w-14 items-center justify-center rounded-full ${tone as string}`}><I size={24} aria-hidden /></span>{label as string}</Link>;
          })}
        </nav>
        {nothing && <EmptyState title="Nothing to explore yet" description="Content will appear as members publish." />}
        <Section title="Upcoming trips" href="/trips" empty={!trips.length}><CardGrid>{trips.map((t) => <ListingCard key={t.id} href={`/trips/${t.id}`} title={t.title} subtitle={t.destination} image={t.coverUrl} badge={t.category} meta={t.startDate ? formatDate(t.startDate, locale) : undefined} />)}</CardGrid></Section>
        <Section title="Shops" href="/shops" empty={!shops.length}><CardGrid>{shops.map((s) => <ListingCard key={s.id} href={`/shops/${s.slug}`} title={s.name} subtitle={s.description?.slice(0, 90)} image={s.logoUrl ?? s.coverUrl} badge={s.category} verified={s.verified} meta={s.locationLabel} ratio="aspect-[16/9]" />)}</CardGrid></Section>
        <Section title="Products" href="/products" empty={!products.length}><CardGrid>{products.map((p) => <ListingCard key={p.id} href={`/products/${p.id}`} title={p.title} subtitle={p.locationLabel} image={p.images[0]} meta={p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"} />)}</CardGrid></Section>
        <Section title="Services" href="/services" empty={!services.length}><CardGrid>{services.map((s) => <ListingCard key={s.id} href={`/services/${s.id}`} title={s.title} subtitle={s.serviceArea} image={s.images[0]} badge={s.category} meta={s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}` : "Quote on request"} />)}</CardGrid></Section>
        <Section title="Groups" href="/groups" empty={!groups.length}><CardGrid>{groups.map((g) => <ListingCard key={g.id} href={`/groups/${g.slug}`} title={g.name} subtitle={g.description?.slice(0, 90)} image={g.coverUrl} badge={g.category} ratio="aspect-[16/9]" />)}</CardGrid></Section>
        {d.people.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl">People to follow</h2><Link href="/people" className="link text-sm">See all</Link></div><ul className="grid gap-3 sm:grid-cols-2">{d.people.map((p) => <li key={p.id}><Link href={`/profile/${p.username}`} className="card flex items-center gap-3 p-3 hover:bg-primary-tint"><span className="font-medium">{p.displayName}</span><span className="truncate text-sm text-muted">{p.headline}</span></Link></li>)}</ul></section>}
      </Container>
    </FeatureGate>
  );
}
