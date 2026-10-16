import "server-only";
import { and, desc, eq, gte, sql, ne } from "drizzle-orm";
import { useDb, schema } from "../db";
import { neighbourCells, cellDistanceKm, distanceBucket, cellSizeKm } from "../location";
import { getSetting } from "../settings";
import { postVisible } from "./posts";
import { suggestedPeople } from "./social";

export async function viewerCell(userId: string | null) {
  if (!userId) return null;
  if (!(await getSetting<boolean>("location.enabled"))) return null;
  const db = await useDb();
  const [u] = await db.select({ c: schema.users.geoCell, s: schema.users.locationSharing }).from(schema.users).where(eq(schema.users.id, userId));
  return u?.s ? u.c : null;
}

export async function recommendedBusinesses(viewerId: string | null, limit = 4) {
  const db = await useDb();
  const companies = await db.select({ id: schema.companies.id, name: schema.companies.name, slug: schema.companies.slug, sub: schema.companies.industry, logo: schema.companies.logoUrl, verified: schema.companies.verified })
    .from(schema.companies).where(eq(schema.companies.status, "active")).orderBy(desc(schema.companies.createdAt)).limit(limit);
  const shops = await db.select({ id: schema.shops.id, name: schema.shops.name, slug: schema.shops.slug, sub: schema.shops.category, logo: schema.shops.logoUrl, verified: schema.shops.verified })
    .from(schema.shops).where(eq(schema.shops.status, "active")).orderBy(desc(schema.shops.createdAt)).limit(limit);
  void viewerId;
  return [...companies.map((c) => ({ ...c, kind: "companies" as const })), ...shops.map((s) => ({ ...s, kind: "shops" as const }))].slice(0, limit);
}

export async function nearbyBusinesses(viewerId: string | null, limit = 4) {
  const cell = await viewerCell(viewerId);
  if (!cell) return null; // null = location not available (UI explains), [] = none nearby
  const km = await cellSizeKm();
  const cells = neighbourCells(cell, 2);
  const db = await useDb();
  const inCells = (col: unknown) => sql`${col} in (${sql.join(cells.map((c) => sql`${c}`), sql`, `)})`;
  const shops = await db.select({ id: schema.shops.id, name: schema.shops.name, slug: schema.shops.slug, sub: schema.shops.category, cell: schema.shops.geoCell }).from(schema.shops).where(and(eq(schema.shops.status, "active"), inCells(schema.shops.geoCell))).limit(limit);
  const companies = await db.select({ id: schema.companies.id, name: schema.companies.name, slug: schema.companies.slug, sub: schema.companies.industry, cell: schema.companies.geoCell }).from(schema.companies).where(and(eq(schema.companies.status, "active"), inCells(schema.companies.geoCell))).limit(limit);
  return [...shops.map((s) => ({ ...s, kind: "shops" as const })), ...companies.map((c) => ({ ...c, kind: "companies" as const }))]
    .slice(0, limit).map((r) => ({ id: r.id, name: r.name, href: `/${r.kind}/${r.slug}`, sub: r.sub, distance: distanceBucket(cellDistanceKm(cell, r.cell, km)) }));
}

export async function upcomingTrips(limit = 3) {
  const db = await useDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.select({ id: schema.trips.id, title: schema.trips.title, destination: schema.trips.destination, startDate: schema.trips.startDate, cover: schema.trips.coverUrl })
    .from(schema.trips).where(and(eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"), gte(schema.trips.startDate, today))).orderBy(schema.trips.startDate).limit(limit);
}

/** The viewer's soonest upcoming trip (organiser or approved participant), with the number of approved travellers. */
export async function myNextTrip(userId: string) {
  const db = await useDb();
  const today = new Date().toISOString().slice(0, 10);
  const [trip] = await db.select({ id: schema.trips.id, title: schema.trips.title, destination: schema.trips.destination, startDate: schema.trips.startDate, endDate: schema.trips.endDate, cover: schema.trips.coverUrl })
    .from(schema.trips)
    .where(and(
      sql`${schema.trips.status} in ('published')`, gte(schema.trips.startDate, today),
      sql`(${schema.trips.ownerId} = ${userId} or exists (select 1 from trip_participants tp where tp.trip_id = ${schema.trips.id} and tp.user_id = ${userId} and tp.status = 'approved'))`,
    )).orderBy(schema.trips.startDate).limit(1);
  if (!trip) return null;
  const going = await db.select({ name: schema.users.displayName, avatar: schema.users.avatarUrl })
    .from(schema.tripParticipants).innerJoin(schema.users, eq(schema.users.id, schema.tripParticipants.userId))
    .where(and(eq(schema.tripParticipants.tripId, trip.id), eq(schema.tripParticipants.status, "approved"))).limit(8);
  return { ...trip, going };
}

/** People who sent the viewer a pending connection request (newest first). */
export async function pendingRequestPeople(userId: string, limit = 4) {
  const db = await useDb();
  const rows = await db.select({ id: schema.users.id, name: schema.users.displayName, avatar: schema.users.avatarUrl })
    .from(schema.connections).innerJoin(schema.users, eq(schema.users.id, schema.connections.requesterId))
    .where(and(eq(schema.connections.addresseeId, userId), eq(schema.connections.status, "pending"))).orderBy(desc(schema.connections.createdAt)).limit(limit);
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.connections).where(and(eq(schema.connections.addresseeId, userId), eq(schema.connections.status, "pending")));
  return { people: rows, total: c?.n ?? 0 };
}

export async function recommendedListings(limit = 4) {
  const db = await useDb();
  const products = await db.select({ id: schema.products.id, title: schema.products.title, price: schema.products.price, currency: schema.products.currency, image: sql<string | null>`${schema.products.images}[1]` })
    .from(schema.products).where(eq(schema.products.status, "active")).orderBy(desc(schema.products.viewCount), desc(schema.products.createdAt)).limit(limit);
  const services = await db.select({ id: schema.services.id, title: schema.services.title, price: schema.services.startingPrice, currency: schema.services.currency, image: sql<string | null>`${schema.services.images}[1]` })
    .from(schema.services).where(eq(schema.services.status, "active")).orderBy(desc(schema.services.createdAt)).limit(limit);
  return [...products.map((p) => ({ ...p, href: `/products/${p.id}`, kind: "Product" })), ...services.map((p) => ({ ...p, href: `/services/${p.id}`, kind: "Service" }))].slice(0, limit);
}

export async function trendingPosts(viewerId: string | null, limit = 3) {
  const db = await useDb();
  const since = new Date(Date.now() - 14 * 86400_000);
  return db.select({ id: schema.posts.id, body: schema.posts.body, likes: schema.posts.likeCount, comments: schema.posts.commentCount })
    .from(schema.posts).where(and(postVisible(viewerId), eq(schema.posts.visibility, "public"), gte(schema.posts.createdAt, since), ne(schema.posts.body, ""), sql`${schema.posts.groupId} is null`))
    .orderBy(desc(sql`${schema.posts.commentCount} * 3 + ${schema.posts.likeCount} * 2 + ${schema.posts.shareCount} * 4`), desc(schema.posts.createdAt)).limit(limit);
}

export async function getDiscovery(viewerId: string | null) {
  const [people, businesses, nearby, trips, listings, trending] = await Promise.all([
    suggestedPeople(viewerId, 4), recommendedBusinesses(viewerId, 4), nearbyBusinesses(viewerId, 3), upcomingTrips(3), recommendedListings(4), trendingPosts(viewerId, 3),
  ]);
  return { people, businesses, nearby, trips, listings, trending };
}
