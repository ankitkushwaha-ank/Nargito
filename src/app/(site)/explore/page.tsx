import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { getSessionUser } from "@/server/auth/session";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState } from "@/components/ui/kit";
import { SaveButton } from "@/components/social/save-button";
import {
  Plane,
  Store,
  ShoppingBag,
  Wrench,
  UtensilsCrossed,
  Home,
  CalendarDays,
  UserRound,
  MapPin,
  CalendarDays as CalendarIcon,
  Tag,
  ArrowRight,
} from "lucide-react";
import { SearchBox } from "@/components/shell/search-box";
import { useDb, schema } from "@/server/db";
import { getDiscovery } from "@/server/services/discovery";
import { isFeatureEnabled } from "@/server/features";
import { formatDate, formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { inArray } from "drizzle-orm";

export const metadata = {
  title: "Explore",
  description: "Discover trips, shops, products, services and people on Nargito.",
};

const CATEGORIES = [
  { href: "/trips", label: "Trips", icon: Plane, tone: "bg-blue-100 text-primary" },
  { href: "/shops", label: "Shops", icon: Store, tone: "bg-emerald-100 text-emerald-600" },
  { href: "/products", label: "Products", icon: ShoppingBag, tone: "bg-violet-100 text-violet-600" },
  { href: "/services", label: "Services", icon: Wrench, tone: "bg-indigo-100 text-indigo-600" },
  { href: "/search?q=food", label: "Food & Drinks", icon: UtensilsCrossed, tone: "bg-orange-100 text-orange-500" },
  { href: "/search?q=stay", label: "Stays", icon: Home, tone: "bg-sky-100 text-sky-600" },
  { href: "/groups", label: "Events", icon: CalendarDays, tone: "bg-pink-100 text-pink-500" },
  { href: "/people", label: "People", icon: UserRound, tone: "bg-rose-100 text-rose-500" },
] as const;

export default async function Explore() {
  const viewer = await getSessionUser();
  const locale = await getLocale();
  const db = await useDb();

  const [d, on] = await Promise.all([
    getDiscovery(viewer?.id ?? null),
    Promise.all(["trips", "shops", "products", "services", "groups"].map(isFeatureEnabled)),
  ]);

  const [tripsOn, shopsOn, productsOn, servicesOn, groupsOn] = on;

  const [trips, shops, products, services, groups] = await Promise.all([
    tripsOn
      ? db
          .select()
          .from(schema.trips)
          .where(and(eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public")))
          .orderBy(desc(schema.trips.createdAt))
          .limit(4)
      : [],
    shopsOn
      ? db
          .select()
          .from(schema.shops)
          .where(eq(schema.shops.status, "active"))
          .orderBy(desc(schema.shops.createdAt))
          .limit(4)
      : [],
    productsOn
      ? db
          .select()
          .from(schema.products)
          .where(eq(schema.products.status, "active"))
          .orderBy(desc(schema.products.createdAt))
          .limit(4)
      : [],
    servicesOn
      ? db
          .select()
          .from(schema.services)
          .where(eq(schema.services.status, "active"))
          .orderBy(desc(schema.services.createdAt))
          .limit(4)
      : [],
    groupsOn
      ? db
          .select()
          .from(schema.groups)
          .where(and(eq(schema.groups.status, "active"), eq(schema.groups.visibility, "public")))
          .orderBy(desc(schema.groups.createdAt))
          .limit(4)
      : [],
  ]);

  // Saved entities tracking for viewer
  let savedTrips = new Set<string>();
  let savedProducts = new Set<string>();

  if (viewer) {
    const tripIds = trips.map((t) => t.id);
    const productIds = products.map((p) => p.id);

    const [savedTripRows, savedProductRows] = await Promise.all([
      tripIds.length
        ? db
            .select({ id: schema.savedItems.entityId })
            .from(schema.savedItems)
            .where(
              and(
                eq(schema.savedItems.userId, viewer.id),
                eq(schema.savedItems.entityType, "trip"),
                inArray(schema.savedItems.entityId, tripIds)
              )
            )
        : [],
      productIds.length
        ? db
            .select({ id: schema.savedItems.entityId })
            .from(schema.savedItems)
            .where(
              and(
                eq(schema.savedItems.userId, viewer.id),
                eq(schema.savedItems.entityType, "product"),
                inArray(schema.savedItems.entityId, productIds)
              )
            )
        : [],
    ]);

    savedTrips = new Set(savedTripRows.map((r) => r.id));
    savedProducts = new Set(savedProductRows.map((r) => r.id));
  }

  const nothing = !trips.length && !shops.length && !products.length && !services.length && !groups.length;

  const Section = ({
    title,
    href,
    children,
    empty,
  }: {
    title: string;
    href: string;
    children: React.ReactNode;
    empty: boolean;
  }) =>
    empty ? null : (
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          <Link
            href={href}
            className="group flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            See all
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {children}
      </section>
    );

  return (
    <FeatureGate feature="search">
      {/* Matching Hero Section Banner */}
      <section className="relative isolate overflow-hidden bg-white text-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/brand/banner-explore"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_30%]"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10 sm:via-white/70"
          aria-hidden
        />
        <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
          <p className="eyebrow flex items-center gap-2">
            <span className="h-px w-5 bg-primary" />
            Explore
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Discover New <br />
            <span className="text-primary">Experiences.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">
            Find trips, local shops, products, services and amazing people around you.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="relative z-10 mx-auto -mt-12 max-w-shell px-4 sm:px-6">
        {/* Integrated Floating Search Bar */}
        <div className="card p-4 shadow-lg backdrop-blur">
          <SearchBox className="w-full max-w-none" />
        </div>

        {/* Category Circular Quick Links Nav */}
        <nav
          aria-label="Categories"
          className="no-scrollbar -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:justify-between sm:px-0"
        >
          {CATEGORIES.map(({ href, label, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center text-xs font-semibold text-slate-700 transition-transform hover:-translate-y-0.5"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition-shadow group-hover:shadow-md",
                  tone
                )}
              >
                <Icon size={24} aria-hidden />
              </span>
              <span className="truncate max-w-full">{label}</span>
            </Link>
          ))}
        </nav>

        {nothing && (
          <div className="mt-8">
            <EmptyState
              title="Nothing to explore yet"
              description="Content will appear as members publish trips, shops, products, and services."
            />
          </div>
        )}

        <div className="pb-24 md:pb-10">
          {/* Upcoming Trips */}
          <Section title="Upcoming trips" href="/trips" empty={!trips.length}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {trips.map((t) => (
                <li
                  key={t.id}
                  className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <Link href={`/trips/${t.id}`} className="relative block overflow-hidden" aria-label={t.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.coverUrl ? (
                      <img
                        src={t.coverUrl}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-primary-tint to-sky-100" aria-hidden />
                    )}
                    {t.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
                        {t.category}
                      </span>
                    )}
                  </Link>

                  {viewer && (
                    <div className="absolute right-2 top-2 rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur">
                      <SaveButton
                        entityType="trip"
                        entityId={t.id}
                        initial={savedTrips.has(t.id)}
                        compact
                        className="!min-h-[36px] !rounded-full !px-2 !text-slate-700"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-1 text-lg font-extrabold">
                      <Link href={`/trips/${t.id}`} className="hover:text-primary">
                        {t.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                      <span className="truncate">{t.destination}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs font-semibold text-ink/75 border-t border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon size={14} className="text-primary" aria-hidden />
                        {t.startDate
                          ? formatDate(t.startDate, locale, { day: "numeric", month: "short" })
                          : "Dates TBA"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Local Shops */}
          <Section title="Featured shops" href="/shops" empty={!shops.length}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shops.map((s) => (
                <li
                  key={s.id}
                  className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <Link href={`/shops/${s.slug}`} className="relative block overflow-hidden" aria-label={s.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.coverUrl || s.logoUrl ? (
                      <img
                        src={s.coverUrl ?? s.logoUrl ?? ""}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center text-emerald-600/40">
                        <Store size={32} />
                      </div>
                    )}
                    {s.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                        {s.category}
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-1 text-lg font-extrabold">
                      <Link href={`/shops/${s.slug}`} className="hover:text-primary">
                        {s.name}
                      </Link>
                    </h3>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{s.description}</p>
                    )}
                    <div className="mt-auto pt-3 text-xs font-semibold text-muted border-t border-slate-100 flex items-center gap-1.5">
                      <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                      <span className="truncate">{s.locationLabel ?? "Local Shop"}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Products Section */}
          <Section title="Recent products" href="/products" empty={!products.length}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => {
                const coverImg = p.images?.[0];
                const priceFormatted = p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry";

                return (
                  <li
                    key={p.id}
                    className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <Link href={`/products/${p.id}`} className="relative block overflow-hidden" aria-label={p.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {coverImg ? (
                        <img
                          src={coverImg}
                          alt=""
                          loading="lazy"
                          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="aspect-[16/10] bg-gradient-to-br from-primary-tint to-sky-100 flex items-center justify-center text-primary/40">
                          <Tag size={32} />
                        </div>
                      )}
                      {p.category && (
                        <span className="absolute left-3 top-3 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 shadow-sm">
                          {p.category}
                        </span>
                      )}
                    </Link>

                    {viewer && (
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur">
                        <SaveButton
                          entityType="product"
                          entityId={p.id}
                          initial={savedProducts.has(p.id)}
                          compact
                          className="!min-h-[36px] !rounded-full !px-2 !text-slate-700"
                        />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-1 text-lg font-extrabold">
                        <Link href={`/products/${p.id}`} className="hover:text-primary">
                          {p.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-sm font-medium text-primary">{priceFormatted}</p>
                      <div className="mt-auto pt-3 text-xs font-semibold text-muted border-t border-slate-100 truncate">
                        {p.locationLabel ?? "Local Marketplace"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* Services Section */}
          <Section title="Local services" href="/services" empty={!services.length}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <Link href={`/services/${s.id}`} className="relative block overflow-hidden" aria-label={s.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.images?.[0] ? (
                      <img
                        src={s.images[0]}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center text-indigo-600/40">
                        <Wrench size={32} />
                      </div>
                    )}
                    {s.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm">
                        {s.category}
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-1 text-lg font-extrabold">
                      <Link href={`/services/${s.id}`} className="hover:text-primary">
                        {s.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 text-sm font-semibold text-primary">
                      {s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}` : "Quote on request"}
                    </p>
                    <div className="mt-auto pt-3 text-xs font-semibold text-muted border-t border-slate-100 truncate">
                      {s.serviceArea ?? "Local Area"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Groups Section */}
          <Section title="Communities & Groups" href="/groups" empty={!groups.length}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                >
                  <Link href={`/groups/${g.slug}`} className="relative block overflow-hidden" aria-label={g.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {g.coverUrl ? (
                      <img
                        src={g.coverUrl}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/10] bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center text-pink-600/40">
                        <CalendarDays size={32} />
                      </div>
                    )}
                    {g.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 shadow-sm">
                        {g.category}
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-1 text-lg font-extrabold">
                      <Link href={`/groups/${g.slug}`} className="hover:text-primary">
                        {g.name}
                      </Link>
                    </h3>
                    {g.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{g.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* People Section */}
          {d.people.length > 0 && (
            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">People to follow</h2>
                <Link
                  href="/people"
                  className="group flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                >
                  See all
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/profile/${p.username}`}
                      className="card flex items-center justify-between p-3.5 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          {p.displayName?.[0] ?? "U"}
                        </div>
                        <div className="truncate">
                          <p className="truncate font-extrabold text-slate-900">{p.displayName}</p>
                          {p.headline && <p className="truncate text-xs text-slate-500">{p.headline}</p>}
                        </div>
                      </div>
                      <span className="btn-secondary btn-sm shrink-0">View</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </FeatureGate>
  );
}