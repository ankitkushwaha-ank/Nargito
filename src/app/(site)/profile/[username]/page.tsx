import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, desc, eq, sql } from "drizzle-orm";
import { MapPin, Globe, Mail, Phone, Pencil, Camera, FileText, Plane, Users, Store, Briefcase, Image as ImageIcon, UsersRound, Settings, ScrollText, GraduationCap, Award } from "lucide-react";
import { useDb, schema } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { ThreeColumn } from "@/components/shell/frames";
import { Avatar, VerifiedBadge, Badge, Notice, EmptyState } from "@/components/ui/kit";
import { FeatureGate } from "@/components/ui/feature-gate";
import { canViewProfile, getRelationship, profileCounts } from "@/server/services/social";
import { getFeed } from "@/server/services/posts";
import { FeedList } from "@/components/social/feed-list";
import { ProfileActions } from "@/components/social/relationship-buttons";
import { messagingEnabled } from "@/server/services/messaging";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { RichText } from "@/components/social/rich-text";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { cn } from "@/lib/cn";

async function load(username: string) {
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(sql`lower(${schema.users.username})`, username.toLowerCase())).limit(1);
  return u ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const u = await load(username);
  if (!u || u.profileVisibility !== "public" || u.status === "banned" || u.deletedAt) return { title: "Profile", robots: { index: false } };
  return { title: u.displayName, description: u.headline ?? `${u.displayName} on Nargito`, openGraph: { title: u.displayName, description: u.headline ?? undefined, type: "profile" } };
}

const TAG_TONES = ["bg-blue-50 text-blue-700", "bg-violet-50 text-violet-700", "bg-pink-50 text-pink-700", "bg-orange-50 text-orange-700", "bg-emerald-50 text-emerald-700"];
const TABS = [
  { id: "posts", label: "Posts", icon: FileText },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "groups", label: "Groups", icon: UsersRound },
  { id: "resume", label: "Resume", icon: ScrollText },
] as const;

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { username } = await params;
  const sp = await searchParams;
  const viewer = await getSessionUser();
  const u = await load(username);
  if (!u || u.deletedAt || u.status === "banned") notFound();
  const rel = viewer && viewer.id !== u.id ? await getRelationship(viewer.id, u.id) : null;
  if (rel && (rel.blocked || rel.blockedBy)) notFound();
  const locale = await getLocale();
  const full = await canViewProfile(viewer?.id ?? null, u);
  const self = viewer?.id === u.id;
  const tab = (TABS.find((x) => x.id === sp.tab)?.id ?? "posts") as (typeof TABS)[number]["id"];
  const counts = full ? await profileCounts(u.id) : null;
  const showContact = self || (u.contactVisibility === "public" && full) || (u.contactVisibility === "connections" && rel?.connection === "accepted");
  const canMessage = !!viewer && !self && viewer.status === "active" && (await messagingEnabled());
  const db = await useDb();

  // header stats + tab data (only for viewers allowed to see the profile)
  let stats = { trips: 0, posts: 0, products: 0, services: 0 };
  let feed: Awaited<ReturnType<typeof getFeed>> | null = null;
  let trips: (typeof schema.trips.$inferSelect)[] = [];
  let products: (typeof schema.products.$inferSelect)[] = [];
  let services: (typeof schema.services.$inferSelect)[] = [];
  let groups: { name: string; slug: string; description: string | null; coverUrl: string | null; category: string | null }[] = [];
  let photos: { id: string; alt: string | null; postId: string }[] = [];
  if (full) {
    const tripWhere = and(eq(schema.trips.ownerId, u.id), eq(schema.trips.status, "published"), self ? undefined : eq(schema.trips.visibility, "public"));
    const [[t], [p], [pr], [sv]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(schema.trips).where(tripWhere),
      db.select({ n: sql<number>`count(*)::int` }).from(schema.posts).where(and(eq(schema.posts.authorId, u.id), eq(schema.posts.status, "published"), sql`${schema.posts.groupId} is null`, self ? undefined : eq(schema.posts.visibility, "public"))),
      db.select({ n: sql<number>`count(*)::int` }).from(schema.products).where(and(eq(schema.products.sellerId, u.id), eq(schema.products.status, "active"))),
      db.select({ n: sql<number>`count(*)::int` }).from(schema.services).where(and(eq(schema.services.providerId, u.id), eq(schema.services.status, "active"))),
    ]);
    stats = { trips: t?.n ?? 0, posts: p?.n ?? 0, products: pr?.n ?? 0, services: sv?.n ?? 0 };
    if (tab === "posts") feed = await getFeed(viewer?.id ?? null, { authorId: u.id });
    if (tab === "trips") trips = await db.select().from(schema.trips).where(tripWhere).orderBy(desc(schema.trips.startDate)).limit(24);
    if (tab === "marketplace") products = await db.select().from(schema.products).where(and(eq(schema.products.sellerId, u.id), eq(schema.products.status, "active"))).orderBy(desc(schema.products.createdAt)).limit(24);
    if (tab === "services") services = await db.select().from(schema.services).where(and(eq(schema.services.providerId, u.id), eq(schema.services.status, "active"))).orderBy(desc(schema.services.createdAt)).limit(24);
    if (tab === "groups") groups = await db.select({ name: schema.groups.name, slug: schema.groups.slug, description: schema.groups.description, coverUrl: schema.groups.coverUrl, category: schema.groups.category }).from(schema.groupMembers).innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId)).where(and(eq(schema.groupMembers.userId, u.id), eq(schema.groups.visibility, "public"), eq(schema.groups.status, "active"))).limit(24);
    if (tab === "photos") {
      photos = await db.select({ id: schema.media.id, alt: schema.media.alt, postId: schema.posts.id }).from(schema.postMedia)
        .innerJoin(schema.posts, eq(schema.posts.id, schema.postMedia.postId)).innerJoin(schema.media, eq(schema.media.id, schema.postMedia.mediaId))
        .where(and(eq(schema.posts.authorId, u.id), eq(schema.posts.status, "published"), eq(schema.media.kind, "image"), self ? undefined : eq(schema.posts.visibility, "public"))).orderBy(desc(schema.posts.createdAt)).limit(36);
    }
  }
  const first = u.displayName.split(" ")[0];
  const statItems = [
    { icon: Plane, value: stats.trips, label: "Trips" },
    { icon: Users, value: counts?.connections ?? 0, label: "Connections" },
    { icon: FileText, value: stats.posts, label: "Posts" },
    { icon: Store, value: stats.products, label: "Products" },
    { icon: Briefcase, value: stats.services, label: "Services" },
  ];
  const href = (id: string) => `/profile/${u.username}${id === "posts" ? "" : `?tab=${id}`}`;
  return (
    <FeatureGate feature="profiles">
      <ThreeColumn user={viewer}>
        <section className="card overflow-hidden">
          <div className="relative h-36 sm:h-52 lg:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.coverUrl && full ? u.coverUrl : "/api/brand/cover"} data-zoom={u.coverUrl && full ? u.coverUrl : "/api/brand/cover"} alt="" className="h-full w-full cursor-zoom-in object-cover" />
            {self && <Link href="/settings/profile" className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-xl bg-black/55 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/70"><Camera size={16} aria-hidden />Edit cover</Link>}
          </div>
          <div className="px-4 pb-5 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative z-10 -mt-12 sm:-mt-20"><Avatar name={u.displayName} src={full ? u.avatarUrl : null} size={96} className="!border-4 !border-surface shadow-lg sm:hidden" /><Avatar name={u.displayName} src={full ? u.avatarUrl : null} size={128} className="hidden !border-[5px] !border-surface shadow-lg sm:flex" /></div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pb-1">
                {self ? (
                  <><Link href="/settings/profile" className="btn-secondary"><Pencil size={16} aria-hidden />Edit profile</Link><Link href="/settings" aria-label="Settings" className="btn-secondary !px-3"><Settings size={18} aria-hidden /></Link></>
                ) : viewer && rel ? <ProfileActions userId={u.id} rel={rel} canMessage={canMessage} /> : <Link href={`/login?next=/profile/${u.username}`} className="btn-primary">Sign in to connect</Link>}
              </div>
            </div>
            <div className="mt-3">
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold sm:text-3xl">{u.displayName}{u.verified && <VerifiedBadge />}{u.status !== "active" && <Badge tone="warn">{u.status}</Badge>}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted">
                  <span>@{u.username}</span>
                  {full && u.locationLabel && <span className="inline-flex items-center gap-1.5"><MapPin size={15} aria-hidden />{u.locationLabel}</span>}
                </p>
                {full ? (
                  <>
                    {u.headline && <p className="mt-3 font-medium">{u.headline}</p>}
                    {u.bio && <div className="mt-1 max-w-2xl text-[15px] text-ink/75"><RichText text={u.bio} /></div>}
                    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      {u.website && <a href={u.website} className="link inline-flex items-center gap-1" target="_blank" rel="noopener noreferrer nofollow"><Globe size={14} aria-hidden />{new URL(u.website).hostname}</a>}
                      {showContact && u.contactEmail && <a className="link inline-flex items-center gap-1" href={`mailto:${u.contactEmail}`}><Mail size={14} aria-hidden />{u.contactEmail}</a>}
                      {showContact && u.contactPhone && <span className="inline-flex items-center gap-1"><Phone size={14} aria-hidden />{u.contactPhone}</span>}
                      {counts && <span><b className="text-ink">{formatNumber(counts.followers)}</b> followers · <b className="text-ink">{formatNumber(counts.following)}</b> following</span>}
                    </p>
                    {u.skills.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">{u.skills.map((s, i) => <li key={s} className={cn("rounded-full px-3.5 py-1 text-sm font-medium", TAG_TONES[i % TAG_TONES.length])}>{s}</li>)}</ul>}
                  </>
                ) : (
                  <div className="mt-4"><Notice>This profile is private. Connect with {first} to see more.</Notice></div>
                )}
              </div>
              {full && (
                <dl className="mt-5 grid grid-cols-5 gap-x-1 border-t border-line pt-4 text-center sm:gap-x-4">
                  {statItems.map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1">
                      <s.icon size={20} className="text-primary" aria-hidden />
                      <dd className="text-base font-extrabold leading-none sm:text-lg">{formatNumber(s.value)}</dd>
                      <dt className="text-[11px] text-muted sm:text-xs">{s.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>

        {full && (
          <>
            <nav aria-label="Profile sections" className="card no-scrollbar flex overflow-x-auto px-2">
              {TABS.map((x) => (
                <Link key={x.id} href={href(x.id)} scroll={false} aria-current={tab === x.id ? "page" : undefined} className={cn("relative flex items-center gap-2 whitespace-nowrap px-4 py-4 text-[15px] font-semibold", tab === x.id ? "text-primary" : "text-muted hover:text-ink")}>
                  <x.icon size={18} aria-hidden />{x.label}
                  {tab === x.id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary" />}
                </Link>
              ))}
            </nav>

            {tab === "posts" && feed && (
              <section aria-label="Posts">
                <FeedList initialItems={feed.items} initialCursor={feed.nextCursor} query={`author=${u.id}`} sponsoredEvery={0} emptyText={`${first} hasn't posted yet.`} />
              </section>
            )}
            {tab === "trips" && (trips.length === 0 ? <EmptyState title="No trips yet" description={`${first} hasn't shared a trip yet.`} /> : (
              <CardGrid>{trips.map((tr) => <ListingCard key={tr.id} href={`/trips/${tr.id}`} title={tr.title} subtitle={tr.destination} image={tr.coverUrl} badge={tr.category} meta={tr.startDate ? formatDate(tr.startDate, locale) : undefined} />)}</CardGrid>
            ))}
            {tab === "photos" && (photos.length === 0 ? <EmptyState title="No photos yet" description={`Photos from ${first}'s posts show up here.`} /> : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.id + p.postId}><Link href={`/posts/${p.postId}`} className="block overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/${p.id}?thumb=1`} alt={p.alt ?? ""} loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-[1.03]" />
                  </Link></li>
                ))}
              </ul>
            ))}
            {tab === "marketplace" && (products.length === 0 ? <EmptyState title="Nothing listed" description={`${first} has no products listed right now.`} /> : (
              <CardGrid>{products.map((p) => <ListingCard key={p.id} href={`/products/${p.id}`} title={p.title} subtitle={p.locationLabel} image={p.images[0]} meta={p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"} />)}</CardGrid>
            ))}
            {tab === "services" && (services.length === 0 ? <EmptyState title="No services" description={`${first} isn't offering services right now.`} /> : (
              <CardGrid>{services.map((s) => <ListingCard key={s.id} href={`/services/${s.id}`} title={s.title} subtitle={s.serviceArea} image={s.images[0]} badge={s.category} meta={s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}` : "Request a quote"} />)}</CardGrid>
            ))}
            {tab === "resume" && ((u.resume ?? []).length === 0 ? <EmptyState title="No resume yet" description={self ? "Add your experience and education so people can get to know you." : `${first} hasn't added a resume yet.`} action={self ? <Link href="/settings/profile" className="btn-primary">Add resume</Link> : undefined} /> : (
              <section className="card p-5 sm:p-6" aria-label="Resume">
                {(["experience", "education", "certification"] as const).map((k) => {
                  const list = (u.resume ?? []).filter((r) => r.kind === k);
                  if (!list.length) return null;
                  const Icon = k === "experience" ? Briefcase : k === "education" ? GraduationCap : Award;
                  return (
                    <div key={k} className="mb-6 last:mb-0">
                      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold capitalize"><Icon size={20} className="text-primary" aria-hidden />{k === "certification" ? "Certifications" : k}</h2>
                      <ol className="space-y-4 border-l-2 border-primary/20 pl-5">
                        {list.map((r, i) => (
                          <li key={i} className="relative"><span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                            <p className="font-bold">{r.title}</p>
                            {r.org && <p className="text-sm text-ink/80">{r.org}</p>}
                            <p className="text-xs font-medium text-muted">{r.from ? r.from : ""}{r.from || r.to ? " – " : ""}{r.to ? r.to : r.from ? "Present" : ""}</p>
                            {r.description && <p className="mt-1 text-sm text-ink/75">{r.description}</p>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </section>
            ))}            {tab === "groups" && (groups.length === 0 ? <EmptyState title="No groups" description={`${first} hasn't joined any public groups.`} /> : (
              <CardGrid>{groups.map((g) => <ListingCard key={g.slug} href={`/groups/${g.slug}`} title={g.name} subtitle={g.description?.slice(0, 90)} image={g.coverUrl} badge={g.category} />)}</CardGrid>
            ))}
          </>
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
