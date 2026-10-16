import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Compass, MapPin, Play, Plane, ShoppingBag, Store, UserRound, UsersRound, Users, Users2, Building2, MessagesSquare, Wrench } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/server/auth/session";
import { getT, getLocale } from "@/i18n/server";
import { useDb, schema } from "@/server/db";
import { formatMoney, formatNumber } from "@/lib/format";
import { isFeatureEnabled } from "@/server/features";
import { cn } from "@/lib/cn";

const PILLARS = [
  { href: "/people", icon: UserRound, title: "Meet People", body: "Connect with travellers, creators, professionals and locals near you.", tone: "from-blue-50 to-white dark:from-primary/15 dark:to-surface", chip: "bg-blue-100 text-primary" },
  { href: "/trips", icon: Plane, title: "Plan Trips", body: "Find travel buddies, discover new places and plan together.", tone: "from-cyan-50 to-white dark:from-cyan-500/10 dark:to-surface", chip: "bg-cyan-100 text-cyan-600" },
  { href: "/products", icon: Store, title: "Buy & Sell", body: "Shop local products, services and experiences from real people.", tone: "from-orange-50 to-white dark:from-orange-500/10 dark:to-surface", chip: "bg-orange-100 text-orange-500" },
  { href: "/groups", icon: UsersRound, title: "Join Communities", body: "Be part of interest-based groups, local communities and events.", tone: "from-violet-50 to-white dark:from-violet-500/10 dark:to-surface", chip: "bg-violet-100 text-violet-600" },
] as const;

export default async function Landing() {
  if (await getSessionUser()) redirect("/home");
  const t = await getT();
  const locale = await getLocale();
  const db = await useDb();
  const [tripsOn, servicesOn] = await Promise.all([isFeatureEnabled("trips"), isFeatureEnabled("services")]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: any, where?: any) => {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
    return r?.n ?? 0;
  };
  const [users, tripsCount, shopsCount, companiesCount, groupsCount, trips, services, latestShop] = await Promise.all([
    count(schema.users, eq(schema.users.status, "active")),
    count(schema.trips, eq(schema.trips.status, "published")),
    count(schema.shops, eq(schema.shops.status, "active")),
    count(schema.companies, eq(schema.companies.status, "active")),
    count(schema.groups, eq(schema.groups.status, "active")),
    tripsOn ? db.select().from(schema.trips).where(and(eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"))).orderBy(desc(schema.trips.viewCount), desc(schema.trips.createdAt)).limit(3) : [],
    servicesOn ? db.select().from(schema.services).where(eq(schema.services.status, "active")).orderBy(desc(schema.services.viewCount)).limit(3) : [],
    db.select().from(schema.shops).where(eq(schema.shops.status, "active")).orderBy(desc(schema.shops.createdAt)).limit(1),
  ]);
  const featuredTrip = trips[0];
  const shop = latestShop[0];
  const featured = [
    ...trips.slice(0, 2).map((x) => ({ href: `/trips/${x.id}`, title: x.title, sub: x.destination ?? "India", image: x.coverUrl })),
    ...(shop ? [{ href: `/shops/${shop.slug}`, title: shop.name, sub: shop.locationLabel ?? shop.category ?? "Local shop", image: shop.coverUrl ?? shop.logoUrl }] : []),
    ...services.slice(0, 1).map((x) => ({ href: `/services/${x.id}`, title: x.title, sub: x.serviceArea ?? "Local", image: x.images[0] ?? null })),
  ];
  const stats = [
    { icon: Users, value: formatNumber(users), label: "Members" },
    { icon: Plane, value: formatNumber(tripsCount), label: "Trips shared" },
    { icon: Store, value: formatNumber(shopsCount + companiesCount), label: "Local businesses" },
    { icon: UsersRound, value: formatNumber(groupsCount), label: "Communities" },
  ];
  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-white text-slate-900">
        {/* desktop artwork */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/hero" alt="" aria-hidden className="absolute inset-0 -z-10 hidden h-full w-full object-cover object-[75%_center] md:block" fetchPriority="high" />
        {/* mobile artwork: photo behind the text, fading to white at the top */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/hero-mobile" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_bottom] md:hidden" fetchPriority="high" />
        <div className="absolute inset-x-0 top-0 -z-10 h-[62%] bg-gradient-to-b from-white via-white/80 to-transparent md:hidden" aria-hidden />
        <div className="mx-auto max-w-shell px-4 pb-24 pt-6 sm:px-6 md:pb-32 md:pt-14 lg:pt-16">
          {/* mobile copy */}
          <div className="md:hidden">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/85 px-3.5 py-1.5 text-[13px] font-semibold text-primary shadow-sm"><Users2 size={15} aria-hidden />People · Trips · Local marketplace</p>
            <h1 className="mt-4 text-[2.15rem] font-extrabold leading-[1.1] tracking-tight text-slate-900">Where people, <span className="bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">journeys</span> and local businesses come together.</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">Nargito brings your network, trips, shops and services into one trusted place.</p>
            <div className="mt-5 flex items-center gap-3">
              <Link href="/register" className="btn-primary !px-6 !py-3 text-base">Join Nargito<ArrowRight size={18} aria-hidden /></Link>
              <Link href="/explore" className="btn !border !border-line !bg-white/90 !px-5 !py-3 text-base !text-slate-900 shadow-sm"><Compass size={17} className="text-primary" aria-hidden />Explore</Link>
            </div>
            <nav aria-label="Browse" className="mt-5 grid grid-cols-5 gap-1 text-center text-[12.5px] font-medium text-slate-800">
              {[["/people", "People", UserRound, "bg-rose-100 text-rose-500"], ["/trips", "Trips", Plane, "bg-blue-100 text-primary"], ["/shops", "Shops", Store, "bg-emerald-100 text-emerald-600"], ["/products", "Products", ShoppingBag, "bg-violet-100 text-violet-600"], ["/services", "Services", Wrench, "bg-orange-100 text-orange-500"]].map(([href, label, Icon, tone]) => {
                const I = Icon as typeof Plane;
                return <Link key={href as string} href={href as string} className="flex flex-col items-center gap-1.5"><span className={`flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-sm ${tone as string}`}><I size={22} aria-hidden /></span>{label as string}</Link>;
              })}
            </nav>
            <div className="mt-[190px]">
              {featuredTrip && (
                <Link href={`/trips/${featuredTrip.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {featuredTrip.coverUrl && <img src={featuredTrip.coverUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{featuredTrip.title}</p><p className="truncate text-xs text-slate-500">{featuredTrip.destination}{featuredTrip.slots ? ` · ${featuredTrip.slots} spots` : ""}</p></div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"><ArrowRight size={17} aria-hidden /></span>
                </Link>
              )}
            </div>
            {featured.length > 0 && (
              <div className="-mx-4 mt-5 rounded-t-[2rem] bg-white/95 px-4 pb-14 pt-5 shadow-[0_-10px_30px_rgba(18,80,245,0.08)]">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Featured on Nargito</h2><Link href="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">See all<ArrowRight size={14} aria-hidden /></Link></div>
                <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {featured.map((f) => (
                    <li key={f.href} className="w-[150px] shrink-0">
                      <Link href={f.href} className="block overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {f.image ? <img src={f.image} alt="" loading="lazy" className="h-[84px] w-full object-cover" /> : <div className="h-[84px] bg-primary-tint" />}
                        <div className="p-2.5"><p className="truncate text-[13px] font-bold">{f.title}</p><p className="flex items-center gap-1 truncate text-[11.5px] text-slate-500"><MapPin size={11} aria-hidden />{f.sub}</p></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* desktop copy */}
          <div className="hidden max-w-[640px] md:block">
            <p className="eyebrow">People · Trips · Marketplace · Local services · Communities</p>
            <h1 className="mt-5 text-[3.6rem] font-extrabold leading-[1.02] tracking-tight lg:text-[4.2rem]">
              Real People.<br /><span className="text-primary">Real Places.</span><br />Real Possibilities.
            </h1>
            <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-slate-600">Nargito connects people, travel buddies, local businesses and communities in one trusted place. Explore, plan, discover, buy, sell and grow together.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/register" className="btn-primary !px-8 !py-3.5 text-base">{t("landing.cta")}<ArrowRight size={18} aria-hidden /></Link>
              <Link href="/trips" className="btn !border !border-line !bg-white/90 !px-6 !py-3.5 text-base !text-slate-900 shadow-sm hover:!bg-white"><Play size={16} className="fill-primary text-primary" aria-hidden />Explore trips</Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS (real numbers from the database) */}
      <div className="relative z-10 mx-auto -mt-12 max-w-shell px-4 sm:px-6 md:-mt-16">
        <dl className="card grid grid-cols-2 gap-y-5 px-4 py-5 md:grid-cols-4 md:divide-x md:divide-line md:px-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-center gap-3.5 px-2">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary"><s.icon size={22} aria-hidden /></span>
              <div><dd className="text-xl font-extrabold leading-none">{s.value}</dd><dt className="mt-1 text-sm text-muted">{s.label}</dt></div>
            </div>
          ))}
        </dl>
      </div>

      {/* EVERYTHING IN ONE PLACE */}
      <section className="mx-auto max-w-shell px-4 pb-6 pt-14 sm:px-6" aria-labelledby="one-place">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Everything you need</p>
            <h2 id="one-place" className="mt-2 text-3xl font-extrabold sm:text-4xl">Everything you need, in <span className="text-primary">one place</span></h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted">From finding travel companions to growing your business, Nargito gives you the tools to connect, explore and create opportunities.</p>
        </div>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <li key={p.title}>
              <Link href={p.href} className={cn("card group relative flex h-full items-start gap-4 bg-gradient-to-br p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg", p.tone)}>
                <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", p.chip)}><p.icon size={26} aria-hidden /></span>
                <span className="min-w-0 pr-8"><span className="block text-base font-bold">{p.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted">{p.body}</span></span>
                <span className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary shadow-sm ring-1 ring-line transition-transform group-hover:translate-x-0.5"><ArrowRight size={16} aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* POPULAR TRIPS + TRUSTED SERVICES */}
      {(trips.length > 0 || services.length > 0) && (
        <section className="mx-auto grid max-w-shell gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-0">
          {trips.length > 0 && (
            <div className="lg:pr-8">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold sm:text-2xl">Popular trips</h2><Link href="/trips" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all trips<ArrowRight size={14} aria-hidden /></Link></div>
              <ul className="grid gap-4 sm:grid-cols-3">
                {trips.map((tr) => (
                  <li key={tr.id}>
                    <Link href={`/trips/${tr.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {tr.coverUrl ? <img src={tr.coverUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="aspect-[16/10] bg-primary-tint" aria-hidden />}
                      <div className="flex items-start gap-2 p-3.5">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tr.title}</p><p className="truncate text-xs text-muted">{tr.destination}</p>
                          <p className="mt-2 text-xs text-muted">{tr.slots ? `${tr.slots} spots` : "Open"}{tr.category ? ` · ${tr.category}` : ""}</p></div>
                        <ArrowRight size={14} className="mt-1 shrink-0 text-primary" aria-hidden />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {services.length > 0 && (
            <div className="lg:border-l lg:border-line lg:pl-8">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold sm:text-2xl">Trusted local services</h2><Link href="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all services<ArrowRight size={14} aria-hidden /></Link></div>
              <ul className="grid gap-4 sm:grid-cols-3">
                {services.map((sv) => (
                  <li key={sv.id}>
                    <Link href={`/services/${sv.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {sv.images[0] ? <img src={sv.images[0]} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="aspect-[16/10] bg-primary-tint" aria-hidden />}
                      <div className="p-3.5">
                        <p className="truncate text-sm font-bold">{sv.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted"><MapPin size={12} aria-hidden />{sv.locationLabel ?? sv.serviceArea}</p>
                        <p className="mt-2 text-xs font-semibold text-primary">{sv.startingPrice ? `From ${formatMoney(sv.startingPrice, sv.currency, locale)}` : "Request a quote"}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* FINAL CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="relative mx-auto max-w-shell overflow-hidden rounded-[2rem] text-white shadow-2xl shadow-primary/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/brand/hero-mobile" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a2380]/95 via-[#1250f5]/80 to-[#1250f5]/20" aria-hidden />
          <div className="relative flex flex-col items-start gap-4 px-6 py-14 sm:px-12 lg:max-w-2xl">
            <MessagesSquare size={28} aria-hidden className="text-white/80" />
            <h2 className="text-3xl font-extrabold sm:text-4xl">Your next trip, customer or friend is already on Nargito.</h2>
            <p className="text-white/85">Join for free and start in minutes.</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/register" className="btn bg-white !px-7 !py-3 text-base text-primary shadow-lg hover:bg-white/90">{t("landing.cta")}</Link>
              <Link href="/login" className="btn border border-white/50 !px-7 !py-3 text-base text-white hover:bg-white/10">{t("nav.signIn")}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
