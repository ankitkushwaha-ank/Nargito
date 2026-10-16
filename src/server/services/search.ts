import "server-only";
import { sql, eq, and, desc } from "drizzle-orm";
import { useDb, schema, rowsOf } from "../db";
import { likeEscape } from "../util";
import { postVisible } from "./posts";
import { neighbourCells, cellDistanceKm, distanceBucket, cellSizeKm } from "../location";
import { enforceRateLimit } from "../ratelimit";
import { isFeatureEnabled } from "../features";
import { getSetting } from "../settings";

export const SEARCH_TYPES = ["people", "posts", "companies", "shops", "products", "services", "trips", "groups"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchHit = { type: SearchType; id: string; title: string; subtitle: string | null; href: string; image: string | null; meta: string | null; distance: string | null };

type Def = {
  table: string; doc: string; title: string; subtitle: string; href: string; image: string; meta: string;
  where: (viewerId: string | null) => ReturnType<typeof sql>; geo: boolean; feature: string;
};

const R = (s: string) => sql.raw(s);
const DEFS: Record<SearchType, Def> = {
  people: {
    table: "users", doc: "coalesce(display_name,'') || ' ' || coalesce(username,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(bio,'')",
    title: "display_name", subtitle: "coalesce(headline, '@' || username)", href: "'/profile/' || username", image: "avatar_url", meta: "location_label", geo: false, feature: "profiles",
    where: (v) => sql`status = 'active' AND deleted_at IS NULL AND profile_visibility = 'public' AND discoverable = true ${v ? sql`AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${v}::uuid AND b.blocked_id = users.id) OR (b.blocker_id = users.id AND b.blocked_id = ${v}::uuid))` : sql``}`,
  },
  posts: {
    table: "posts", doc: "coalesce(body,'')", title: "left(body, 90)", subtitle: "(select display_name from users where id = posts.author_id)", href: "'/posts/' || id", image: "null", meta: "type", geo: false, feature: "posts",
    where: (v) => sql`${postVisible(v)} AND group_id IS NULL`,
  },
  companies: {
    table: "companies", doc: "coalesce(name,'') || ' ' || coalesce(tagline,'') || ' ' || coalesce(description,'') || ' ' || coalesce(industry,'')",
    title: "name", subtitle: "coalesce(tagline, industry)", href: "'/companies/' || slug", image: "logo_url", meta: "location_label", geo: true, feature: "companies",
    where: () => sql`status = 'active'`,
  },
  shops: {
    table: "shops", doc: "coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')",
    title: "name", subtitle: "category", href: "'/shops/' || slug", image: "logo_url", meta: "location_label", geo: true, feature: "shops",
    where: () => sql`status = 'active'`,
  },
  products: {
    table: "products", doc: "coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')",
    title: "title", subtitle: "category", href: "'/products/' || id", image: "images[1]", meta: "case when price is null then null else currency || ' ' || price::int end", geo: true, feature: "products",
    where: () => sql`status = 'active' AND EXISTS (SELECT 1 FROM users u WHERE u.id = products.seller_id AND u.status = 'active')`,
  },
  services: {
    table: "services", doc: "coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')",
    title: "title", subtitle: "category", href: "'/services/' || id", image: "images[1]", meta: "service_area", geo: true, feature: "services",
    where: () => sql`status = 'active' AND EXISTS (SELECT 1 FROM users u WHERE u.id = services.provider_id AND u.status = 'active')`,
  },
  trips: {
    table: "trips", doc: "coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(destination,'')",
    title: "title", subtitle: "destination", href: "'/trips/' || id", image: "cover_url", meta: "to_char(start_date, 'DD Mon YYYY')", geo: true, feature: "trips",
    where: () => sql`status = 'published' AND visibility = 'public'`,
  },
  groups: {
    table: "groups", doc: "coalesce(name,'') || ' ' || coalesce(description,'')",
    title: "name", subtitle: "category", href: "'/groups/' || slug", image: "cover_url", meta: "null", geo: false, feature: "groups",
    where: () => sql`status = 'active' AND visibility = 'public'`,
  },
};

export type SearchOpts = { q: string; type?: SearchType | "all"; sort?: "relevance" | "newest"; category?: string; near?: boolean; page?: number; pageSize?: number };

async function runType(type: SearchType, viewerId: string | null, o: SearchOpts, limit: number, offset: number, viewerCell: string | null, km: number): Promise<SearchHit[]> {
  const d = DEFS[type];
  const db = await useDb();
  const q = o.q.trim().slice(0, 100);
  const like = `%${likeEscape(q.replace(/^#/, ""))}%`;
  const doc = R(d.doc);
  const tsMatch = sql`to_tsvector('simple', ${doc}) @@ websearch_to_tsquery('simple', ${q})`;
  const rank = sql`ts_rank(to_tsvector('simple', ${doc}), websearch_to_tsquery('simple', ${q})) + (CASE WHEN ${R(d.title)}::text ILIKE ${like} THEN 0.5 ELSE 0 END)`;
  const parts = [d.where(viewerId), sql`(${tsMatch} OR ${doc} ILIKE ${like})`];
  if (o.category && ["products", "services", "trips", "shops", "companies", "groups"].includes(type)) {
    const col = type === "companies" ? "industry" : "category";
    parts.push(sql`${R(col)} ILIKE ${"%" + likeEscape(o.category) + "%"}`);
  }
  if (o.near && viewerCell && d.geo) parts.push(sql`geo_cell IN (${sql.join(neighbourCells(viewerCell, 2).map((c) => sql`${c}`), sql`, `)})`);
  const where = sql.join(parts, sql` AND `);
  const order = o.sort === "newest" ? sql`created_at DESC` : sql`rank DESC, created_at DESC`;
  const geoCol = d.geo ? sql`geo_cell` : sql`null::text`;
  const res = await db.execute(sql`SELECT id::text AS id, ${R(d.title)} AS title, ${R(d.subtitle)} AS subtitle, ${R(d.href)} AS href, ${R(d.image)} AS image, ${R(d.meta)}::text AS meta, ${geoCol} AS geo, created_at, ${rank} AS rank FROM ${R(d.table)} WHERE ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`);
  return rowsOf<{ id: string; title: string; subtitle: string | null; href: string; image: string | null; meta: string | null; geo: string | null }>(res).map((r) => ({
    type, id: r.id, title: r.title ?? "", subtitle: r.subtitle, href: r.href, image: r.image, meta: r.meta,
    distance: viewerCell && r.geo ? distanceBucket(cellDistanceKm(viewerCell, r.geo, km)) : null,
  }));
}

export async function search(viewerId: string | null, o: SearchOpts) {
  const q = o.q.trim();
  if (!q) return { hits: [] as SearchHit[], grouped: {} as Record<string, SearchHit[]>, hasMore: false };
  const pageSize = Math.min(o.pageSize ?? 20, 50);
  const page = Math.max(1, o.page ?? 1);
  let cell: string | null = null;
  const km = await cellSizeKm();
  if (viewerId) {
    const db = await useDb();
    const [u] = await db.select({ c: schema.users.geoCell, s: schema.users.locationSharing }).from(schema.users).where(eq(schema.users.id, viewerId));
    if (u?.s && (await getSetting<boolean>("location.enabled"))) cell = u.c;
  }
  if (o.near && cell && viewerId) await enforceRateLimit("nearby", 30, 600, viewerId); // anti-triangulation
  const near = !!(o.near && cell);
  const allowed: SearchType[] = [];
  for (const t of SEARCH_TYPES) if (await isFeatureEnabled(DEFS[t].feature)) allowed.push(t);
  if (o.type && o.type !== "all") {
    if (!allowed.includes(o.type)) return { hits: [], grouped: {}, hasMore: false };
    const rows = await runType(o.type, viewerId, { ...o, near }, pageSize + 1, (page - 1) * pageSize, cell, km);
    return { hits: rows.slice(0, pageSize), grouped: {}, hasMore: rows.length > pageSize };
  }
  const grouped: Record<string, SearchHit[]> = {};
  await Promise.all(allowed.map(async (t) => { const r = await runType(t, viewerId, { ...o, near }, 5, 0, cell, km); if (r.length) grouped[t] = r; }));
  return { hits: [], grouped, hasMore: false };
}

export async function suggest(viewerId: string | null, qRaw: string) {
  const q = qRaw.trim().slice(0, 60);
  if (q.length < 2) return [];
  const like = `${likeEscape(q)}%`;
  const likeAny = `%${likeEscape(q)}%`;
  const db = await useDb();
  const res = await db.execute(sql`
    (SELECT 'people' AS type, display_name AS title, '/profile/' || username AS href, '@' || username AS sub FROM users WHERE status='active' AND deleted_at IS NULL AND profile_visibility='public' AND discoverable AND (display_name ILIKE ${like} OR username ILIKE ${like} OR display_name ILIKE ${'% ' + likeEscape(q) + '%'}) LIMIT 3)
    UNION ALL (SELECT 'companies', name, '/companies/' || slug, industry FROM companies WHERE status='active' AND name ILIKE ${likeAny} LIMIT 2)
    UNION ALL (SELECT 'shops', name, '/shops/' || slug, category FROM shops WHERE status='active' AND name ILIKE ${likeAny} LIMIT 2)
    UNION ALL (SELECT 'products', title, '/products/' || id, category FROM products WHERE status='active' AND title ILIKE ${likeAny} LIMIT 2)
    UNION ALL (SELECT 'services', title, '/services/' || id, category FROM services WHERE status='active' AND title ILIKE ${likeAny} LIMIT 2)
    UNION ALL (SELECT 'trips', title, '/trips/' || id, destination FROM trips WHERE status='published' AND visibility='public' AND (title ILIKE ${likeAny} OR destination ILIKE ${likeAny}) LIMIT 2)
    UNION ALL (SELECT 'groups', name, '/groups/' || slug, category FROM groups WHERE status='active' AND visibility='public' AND name ILIKE ${likeAny} LIMIT 2)`);
  void viewerId;
  return rowsOf<{ type: string; title: string; href: string; sub: string | null }>(res).slice(0, 8);
}

/* recent searches (private to the user, clearable) */
export async function recordSearch(userId: string, q: string) {
  const term = q.trim().slice(0, 100);
  if (!term) return;
  const db = await useDb();
  await db.delete(schema.recentSearches).where(and(eq(schema.recentSearches.userId, userId), eq(schema.recentSearches.query, term)));
  await db.insert(schema.recentSearches).values({ userId, query: term });
  const old = await db.select({ id: schema.recentSearches.id }).from(schema.recentSearches).where(eq(schema.recentSearches.userId, userId)).orderBy(desc(schema.recentSearches.createdAt)).offset(10);
  for (const o of old) await db.delete(schema.recentSearches).where(eq(schema.recentSearches.id, o.id));
}
export async function recentSearches(userId: string) {
  const db = await useDb();
  return db.select().from(schema.recentSearches).where(eq(schema.recentSearches.userId, userId)).orderBy(desc(schema.recentSearches.createdAt)).limit(8);
}
export async function clearRecentSearches(userId: string) {
  const db = await useDb();
  await db.delete(schema.recentSearches).where(eq(schema.recentSearches.userId, userId));
}
