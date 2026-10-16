import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { useDb, schema } from "../db";
import { AppError, ok, fail, isUuid, likeEscape, type ActionResult } from "../util";
import { requireFeature } from "../features";
import { enforceRateLimit } from "../ratelimit";
import { checkbox, optDate, optNum, optStr, parseInput } from "../validation";
import { audit } from "../log";
import { getSettings } from "../settings";
import { notify } from "./notify";
import { sha256 } from "../util";
import { requestMeta } from "../log";

const MEDIA_URL = /^(\/api\/media\/[0-9a-f-]{36}(\?thumb=1)?|\/(art|images)\/[a-z0-9-]+\.jpg)$/i;
const imageList = z.preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().regex(MEDIA_URL, "Invalid image")).max(8));
const urlOpt = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(MEDIA_URL, "Invalid image").optional());

/* ───────── helpers ───────── */
export async function userCell(userId: string) {
  const db = await useDb();
  const [u] = await db.select({ c: schema.users.geoCell, s: schema.users.locationSharing }).from(schema.users).where(eq(schema.users.id, userId));
  return u?.s ? u.c : null;
}

export async function memberRole(kind: "company" | "shop", entityId: string, userId: string) {
  const db = await useDb();
  if (kind === "company") {
    const [m] = await db.select().from(schema.companyMembers).where(and(eq(schema.companyMembers.companyId, entityId), eq(schema.companyMembers.userId, userId))).limit(1);
    return m?.role ?? null;
  }
  const [m] = await db.select().from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, entityId), eq(schema.shopMembers.userId, userId))).limit(1);
  return m?.role ?? null;
}
const canEditRole = (r: string | null) => r === "owner" || r === "admin" || r === "editor";

async function assertLinkedBusiness(userId: string, shopId?: string, companyId?: string) {
  if (shopId) { await requireFeature("shops"); if (!canEditRole(await memberRole("shop", shopId, userId))) throw new AppError(403, "You cannot publish for that shop."); }
  if (companyId) { await requireFeature("companies"); if (!canEditRole(await memberRole("company", companyId, userId))) throw new AppError(403, "You cannot publish for that company."); }
}

async function bumpView(entityType: string, entityId: string, viewerId: string | null, table: typeof schema.products | typeof schema.services | typeof schema.trips) {
  const db = await useDb();
  const rm = await requestMeta();
  const key = viewerId ? `u:${viewerId}` : `ip:${sha256(rm.ip + (rm.userAgent ?? "")).slice(0, 20)}`;
  const day = new Date().toISOString().slice(0, 10);
  const ins = await db.insert(schema.entityViews).values({ entityType, entityId, viewerKey: key, day }).onConflictDoNothing().returning();
  if (ins.length) await db.update(table).set({ viewCount: sql`${table.viewCount} + 1` } as never).where(eq(table.id, entityId));
}

/* ───────── products ───────── */
const productSchema = z.object({
  title: z.string().trim().min(3, "Enter a title (3+ characters).").max(120),
  description: optStr(5000),
  category: optStr(60),
  price: optNum,
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]).default("INR"),
  condition: z.enum(["new", "like_new", "used"]).optional().or(z.literal("").transform(() => undefined)),
  availability: z.enum(["in_stock", "limited", "out_of_stock"]).default("in_stock"),
  locationLabel: optStr(80),
  images: imageList,
  status: z.enum(["draft", "active", "sold", "archived"]).default("active"),
  shopId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  companyId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
});

export async function canManageProduct(userId: string, p: typeof schema.products.$inferSelect) {
  if (p.sellerId === userId) return true;
  if (p.shopId && canEditRole(await memberRole("shop", p.shopId, userId))) return true;
  if (p.companyId && canEditRole(await memberRole("company", p.companyId, userId))) return true;
  return false;
}

export async function saveProduct(userId: string, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireFeature("products");
  await enforceRateLimit("listing", 30, 3600, userId);
  const p = parseInput(productSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  await assertLinkedBusiness(userId, d.shopId, d.companyId);
  const db = await useDb();
  const cell = await userCell(userId);
  const values = { title: d.title, description: d.description ?? null, category: d.category ?? null, price: d.price !== undefined ? String(d.price) : null, currency: d.currency, condition: d.condition ?? null, availability: d.availability, locationLabel: d.locationLabel ?? null, images: d.images, status: d.status, shopId: d.shopId ?? null, companyId: d.companyId ?? null, updatedAt: new Date() };
  if (id) {
    const [cur] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    if (!cur || !(await canManageProduct(userId, cur))) throw new AppError(404, "Listing not found.");
    if (cur.status === "removed") return fail("This listing was removed by moderators.");
    await db.update(schema.products).set(values).where(eq(schema.products.id, id));
    if (cur.status !== d.status) await db.insert(schema.listingStatusHistory).values({ listingType: "product", listingId: id, fromStatus: cur.status, toStatus: d.status, changedBy: userId });
    return ok({ id }, "Listing updated.");
  }
  const [row] = await db.insert(schema.products).values({ ...values, sellerId: userId, geoCell: cell }).returning({ id: schema.products.id });
  await db.insert(schema.listingStatusHistory).values({ listingType: "product", listingId: row!.id, toStatus: d.status, changedBy: userId });
  return ok({ id: row!.id }, "Listing created.");
}

export type ProductFilters = { q?: string; category?: string; min?: number; max?: number; sort?: "new" | "price_asc" | "price_desc"; page?: number; shopId?: string; companyId?: string };
export async function listProducts(f: ProductFilters, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.products.status, "active"), sql`exists (select 1 from users u where u.id = ${schema.products.sellerId} and u.status = 'active')`];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.products.title, l), ilike(schema.products.description, l))!); }
  if (f.category) conds.push(eq(schema.products.category, f.category));
  if (f.min !== undefined) conds.push(gte(schema.products.price, String(f.min)));
  if (f.max !== undefined) conds.push(lte(schema.products.price, String(f.max)));
  if (f.shopId) conds.push(eq(schema.products.shopId, f.shopId));
  if (f.companyId) conds.push(eq(schema.products.companyId, f.companyId));
  const order = f.sort === "price_asc" ? asc(schema.products.price) : f.sort === "price_desc" ? desc(schema.products.price) : desc(schema.products.createdAt);
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select().from(schema.products).where(and(...conds)).orderBy(order).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getProduct(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null;
  const db = await useDb();
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  if (!p || p.status === "removed") return null;
  const manage = viewerId ? await canManageProduct(viewerId, p) : false;
  if (p.status !== "active" && p.status !== "sold" && !manage) return null;
  const [seller] = await db.select().from(schema.users).where(eq(schema.users.id, p.sellerId));
  if (!manage && (!seller || seller.status !== "active")) return null;
  if (!manage) await bumpView("product", id, viewerId, schema.products);
  const shop = p.shopId ? (await db.select().from(schema.shops).where(eq(schema.shops.id, p.shopId)))[0] : null;
  const company = p.companyId ? (await db.select().from(schema.companies).where(eq(schema.companies.id, p.companyId)))[0] : null;
  return { p, seller: seller!, shop: shop ?? null, company: company ?? null, manage };
}

/* ───────── services ───────── */
const serviceSchema = z.object({
  title: z.string().trim().min(3, "Enter a title (3+ characters).").max(120),
  description: optStr(5000),
  category: optStr(60),
  serviceArea: optStr(120),
  pricingModel: z.enum(["fixed", "hourly", "quote"]).default("fixed"),
  startingPrice: optNum,
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]).default("INR"),
  availability: optStr(200),
  locationLabel: optStr(80),
  images: imageList,
  status: z.enum(["draft", "active", "archived"]).default("active"),
  companyId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
});

export async function canManageService(userId: string, s: typeof schema.services.$inferSelect) {
  if (s.providerId === userId) return true;
  return !!s.companyId && canEditRole(await memberRole("company", s.companyId, userId));
}

export async function saveService(userId: string, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireFeature("services");
  await enforceRateLimit("listing", 30, 3600, userId);
  const p = parseInput(serviceSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  await assertLinkedBusiness(userId, undefined, d.companyId);
  const db = await useDb();
  const values = { title: d.title, description: d.description ?? null, category: d.category ?? null, serviceArea: d.serviceArea ?? null, pricingModel: d.pricingModel, startingPrice: d.startingPrice !== undefined ? String(d.startingPrice) : null, currency: d.currency, availability: d.availability ?? null, locationLabel: d.locationLabel ?? d.serviceArea ?? null, images: d.images, status: d.status, companyId: d.companyId ?? null, updatedAt: new Date() };
  if (id) {
    const [cur] = await db.select().from(schema.services).where(eq(schema.services.id, id));
    if (!cur || !(await canManageService(userId, cur))) throw new AppError(404, "Listing not found.");
    if (cur.status === "removed") return fail("This listing was removed by moderators.");
    await db.update(schema.services).set(values).where(eq(schema.services.id, id));
    if (cur.status !== d.status) await db.insert(schema.listingStatusHistory).values({ listingType: "service", listingId: id, fromStatus: cur.status, toStatus: d.status, changedBy: userId });
    return ok({ id }, "Service updated.");
  }
  const [row] = await db.insert(schema.services).values({ ...values, providerId: userId, geoCell: await userCell(userId) }).returning({ id: schema.services.id });
  await db.insert(schema.listingStatusHistory).values({ listingType: "service", listingId: row!.id, toStatus: d.status, changedBy: userId });
  return ok({ id: row!.id }, "Service created.");
}

export async function listServices(f: { q?: string; category?: string; sort?: "new" | "price_asc"; page?: number; companyId?: string }, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.services.status, "active"), sql`exists (select 1 from users u where u.id = ${schema.services.providerId} and u.status = 'active')`];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.services.title, l), ilike(schema.services.description, l), ilike(schema.services.serviceArea, l))!); }
  if (f.category) conds.push(eq(schema.services.category, f.category));
  if (f.companyId) conds.push(eq(schema.services.companyId, f.companyId));
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select().from(schema.services).where(and(...conds)).orderBy(f.sort === "price_asc" ? asc(schema.services.startingPrice) : desc(schema.services.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getService(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null;
  const db = await useDb();
  const [s] = await db.select().from(schema.services).where(eq(schema.services.id, id));
  if (!s || s.status === "removed") return null;
  const manage = viewerId ? await canManageService(viewerId, s) : false;
  if (s.status !== "active" && !manage) return null;
  const [provider] = await db.select().from(schema.users).where(eq(schema.users.id, s.providerId));
  if (!manage && (!provider || provider.status !== "active")) return null;
  if (!manage) await bumpView("service", id, viewerId, schema.services);
  const company = s.companyId ? (await db.select().from(schema.companies).where(eq(schema.companies.id, s.companyId)))[0] : null;
  return { s, provider: provider!, company: company ?? null, manage };
}

/* ───────── trips ───────── */
const tripSchema = z.object({
  title: z.string().trim().min(3, "Enter a title (3+ characters).").max(120),
  description: optStr(5000),
  coverUrl: urlOpt,
  originArea: optStr(80),
  destination: z.string().trim().min(2, "Enter a destination.").max(120),
  startDate: optDate,
  endDate: optDate,
  category: optStr(60),
  budgetMin: optNum,
  budgetMax: optNum,
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]).default("INR"),
  visibility: z.enum(["public", "connections", "private"]).default("public"),
  slots: z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().int().min(1).max(500).optional()),
  requireApproval: checkbox,
  preferences: optStr(1000),
  status: z.enum(["draft", "published", "completed", "cancelled"]).default("draft"),
  itinerary: z.preprocess((v) => { try { return typeof v === "string" ? JSON.parse(v) : v ?? []; } catch { return []; } }, z.array(z.object({ day: z.coerce.number().int().min(1).max(60), title: z.string().trim().min(1).max(120), details: z.string().trim().max(1000).optional(), isPrivate: z.boolean().optional() })).max(60)),
});

const TRIP_TRANSITIONS: Record<string, string[]> = { draft: ["draft", "published", "cancelled"], published: ["published", "completed", "cancelled", "draft"], completed: ["completed"], cancelled: ["cancelled", "draft"], removed: [] };

export async function saveTrip(userId: string, id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireFeature("trips");
  await enforceRateLimit("trip", 20, 3600, userId);
  const p = parseInput(tripSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  if (d.startDate && d.endDate && d.endDate < d.startDate) return fail("The end date must be after the start date.", { endDate: "End date is before start date." });
  if (d.budgetMin !== undefined && d.budgetMax !== undefined && d.budgetMax < d.budgetMin) return fail("Maximum budget is below the minimum.", { budgetMax: "Below minimum." });
  const db = await useDb();
  const values = { title: d.title, description: d.description ?? null, coverUrl: d.coverUrl ?? null, originArea: d.originArea ?? null, destination: d.destination, startDate: d.startDate ?? null, endDate: d.endDate ?? null, category: d.category ?? null, budgetMin: d.budgetMin !== undefined ? String(d.budgetMin) : null, budgetMax: d.budgetMax !== undefined ? String(d.budgetMax) : null, currency: d.currency, visibility: d.visibility, slots: d.slots ?? null, requireApproval: d.requireApproval, preferences: d.preferences ?? null, status: d.status, updatedAt: new Date() };
  let tripId = id;
  if (id) {
    const [cur] = await db.select().from(schema.trips).where(and(eq(schema.trips.id, id), eq(schema.trips.ownerId, userId)));
    if (!cur) throw new AppError(404, "Trip not found.");
    if (!(TRIP_TRANSITIONS[cur.status] ?? []).includes(d.status)) return fail(`A ${cur.status} trip cannot be changed to ${d.status}.`);
    await db.update(schema.trips).set(values).where(eq(schema.trips.id, id));
  } else {
    const [row] = await db.insert(schema.trips).values({ ...values, ownerId: userId, geoCell: await userCell(userId) }).returning({ id: schema.trips.id });
    tripId = row!.id;
  }
  await db.delete(schema.tripItinerary).where(eq(schema.tripItinerary.tripId, tripId!));
  if (d.itinerary.length) await db.insert(schema.tripItinerary).values(d.itinerary.map((it, i) => ({ tripId: tripId!, day: it.day, title: it.title, details: it.details ?? null, isPrivate: !!it.isPrivate, position: i })));
  return ok({ id: tripId! }, id ? "Trip updated." : d.status === "published" ? "Trip published." : "Trip saved as draft.");
}

export type TripFilters = { q?: string; category?: string; destination?: string; from?: string; to?: string; page?: number; ownerId?: string };
export async function listTrips(f: TripFilters, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"), sql`exists (select 1 from users u where u.id = ${schema.trips.ownerId} and u.status = 'active')`];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.trips.title, l), ilike(schema.trips.description, l), ilike(schema.trips.destination, l))!); }
  if (f.category) conds.push(eq(schema.trips.category, f.category));
  if (f.destination) conds.push(ilike(schema.trips.destination, `%${likeEscape(f.destination)}%`));
  if (f.from) conds.push(gte(schema.trips.startDate, f.from));
  if (f.to) conds.push(lte(schema.trips.startDate, f.to));
  if (f.ownerId) conds.push(eq(schema.trips.ownerId, f.ownerId));
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select().from(schema.trips).where(and(...conds)).orderBy(asc(schema.trips.startDate), desc(schema.trips.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getTrip(id: string, viewerId: string | null) {
  if (!isUuid(id)) return null;
  const db = await useDb();
  const [t] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
  if (!t || t.status === "removed") return null;
  const owner = viewerId === t.ownerId;
  const [org] = await db.select().from(schema.users).where(eq(schema.users.id, t.ownerId));
  if (!org) return null;
  if (!owner) {
    if (t.status === "draft" || org.status !== "active") return null;
    if (t.visibility === "private") return null;
    if (t.visibility === "connections") {
      if (!viewerId) return null;
      const [c] = await db.select().from(schema.connections).where(and(eq(schema.connections.status, "accepted"), or(and(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, t.ownerId)), and(eq(schema.connections.addresseeId, viewerId), eq(schema.connections.requesterId, t.ownerId)))));
      if (!c) return null;
    }
    if (viewerId) {
      const [b] = await db.select().from(schema.blocks).where(or(and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, t.ownerId)), and(eq(schema.blocks.blockerId, t.ownerId), eq(schema.blocks.blockedId, viewerId))));
      if (b) return null;
    }
    await bumpView("trip", id, viewerId, schema.trips);
  }
  const myPart = viewerId ? (await db.select().from(schema.tripParticipants).where(and(eq(schema.tripParticipants.tripId, id), eq(schema.tripParticipants.userId, viewerId))))[0] ?? null : null;
  const approved = myPart?.status === "approved";
  // private itinerary items are visible only to the organiser and approved participants
  const items = (await db.select().from(schema.tripItinerary).where(eq(schema.tripItinerary.tripId, id)).orderBy(schema.tripItinerary.day, schema.tripItinerary.position)).filter((i) => !i.isPrivate || owner || approved);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tripParticipants).where(and(eq(schema.tripParticipants.tripId, id), eq(schema.tripParticipants.status, "approved")));
  return { t, organiser: org, items, owner, myPart, approvedCount: n!, hiddenItems: !owner && !approved };
}

export async function requestToJoin(userId: string, tripId: string, message: string): Promise<ActionResult> {
  await requireFeature("trips");
  await enforceRateLimit("trip-join", 20, 3600, userId);
  const db = await useDb();
  const [t] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId));
  if (!t || t.status !== "published") return fail("This trip is not open for requests.");
  if (t.ownerId === userId) return fail("You are the organiser.");
  if (t.slots) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tripParticipants).where(and(eq(schema.tripParticipants.tripId, tripId), eq(schema.tripParticipants.status, "approved")));
    if (n! >= t.slots) return fail("All slots are taken.");
  }
  const status = t.requireApproval ? "pending" : "approved";
  const r = await db.insert(schema.tripParticipants).values({ tripId, userId, status, message: message.slice(0, 500) || null }).onConflictDoNothing().returning();
  if (!r.length) return fail("You have already requested to join.");
  await notify({ userId: t.ownerId, type: "group", actorId: userId, title: status === "pending" ? `Join request: ${t.title}` : `New participant: ${t.title}`, link: `/trips/${tripId}`, dedupeKey: `join:${tripId}:${userId}` });
  return ok(undefined, status === "pending" ? "Request sent. The organiser will review it." : "You're in!");
}

export async function decideParticipant(ownerId: string, tripId: string, userId: string, decision: "approved" | "declined"): Promise<ActionResult> {
  const db = await useDb();
  const [t] = await db.select().from(schema.trips).where(and(eq(schema.trips.id, tripId), eq(schema.trips.ownerId, ownerId)));
  if (!t) throw new AppError(404, "Trip not found.");
  if (decision === "approved" && t.slots) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tripParticipants).where(and(eq(schema.tripParticipants.tripId, tripId), eq(schema.tripParticipants.status, "approved")));
    if (n! >= t.slots) return fail("All slots are taken.");
  }
  await db.update(schema.tripParticipants).set({ status: decision }).where(and(eq(schema.tripParticipants.tripId, tripId), eq(schema.tripParticipants.userId, userId)));
  await notify({ userId, type: "group", actorId: ownerId, title: decision === "approved" ? `You're confirmed for ${t.title}` : `Your request for ${t.title} was declined`, link: `/trips/${tripId}`, dedupeKey: `join-dec:${tripId}:${userId}:${decision}` });
  return ok();
}

export async function listParticipants(tripId: string) {
  const db = await useDb();
  return db.select({ p: schema.tripParticipants, u: schema.users }).from(schema.tripParticipants).innerJoin(schema.users, eq(schema.users.id, schema.tripParticipants.userId)).where(eq(schema.tripParticipants.tripId, tripId)).orderBy(desc(schema.tripParticipants.createdAt));
}

/* ───────── owner dashboards ───────── */
export async function myListings(userId: string) {
  const db = await useDb();
  const shopIds = (await db.select({ id: schema.shopMembers.shopId }).from(schema.shopMembers).where(eq(schema.shopMembers.userId, userId))).map((r) => r.id);
  const companyIds = (await db.select({ id: schema.companyMembers.companyId }).from(schema.companyMembers).where(eq(schema.companyMembers.userId, userId))).map((r) => r.id);
  const products = await db.select().from(schema.products).where(and(sql`${schema.products.status} <> 'removed'`, or(eq(schema.products.sellerId, userId), shopIds.length ? inArray(schema.products.shopId, shopIds) : undefined, companyIds.length ? inArray(schema.products.companyId, companyIds) : undefined))).orderBy(desc(schema.products.createdAt));
  const services = await db.select().from(schema.services).where(and(sql`${schema.services.status} <> 'removed'`, or(eq(schema.services.providerId, userId), companyIds.length ? inArray(schema.services.companyId, companyIds) : undefined))).orderBy(desc(schema.services.createdAt));
  return { products, services };
}

export async function myTrips(userId: string) {
  const db = await useDb();
  return db.select().from(schema.trips).where(and(eq(schema.trips.ownerId, userId), sql`${schema.trips.status} <> 'removed'`)).orderBy(desc(schema.trips.createdAt));
}

export async function listingStats(userId: string) {
  const db = await useDb();
  const [p] = await db.select({ views: sql<number>`coalesce(sum(view_count),0)::int`, n: sql<number>`count(*)::int` }).from(schema.products).where(eq(schema.products.sellerId, userId));
  const [s] = await db.select({ views: sql<number>`coalesce(sum(view_count),0)::int`, n: sql<number>`count(*)::int` }).from(schema.services).where(eq(schema.services.providerId, userId));
  const [t] = await db.select({ views: sql<number>`coalesce(sum(view_count),0)::int`, n: sql<number>`count(*)::int` }).from(schema.trips).where(eq(schema.trips.ownerId, userId));
  const [e] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.enquiries).where(eq(schema.enquiries.recipientId, userId));
  const [sv] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.savedItems).where(sql`${schema.savedItems.entityId} in (select id from products where seller_id = ${userId} union select id from services where provider_id = ${userId} union select id from trips where owner_id = ${userId})`);
  return { products: p!, services: s!, trips: t!, enquiries: e!.n, saves: sv!.n };
}

export async function categoryNames(type: string) {
  const db = await useDb();
  const rows = await db.select().from(schema.categories).where(and(eq(schema.categories.type, type), eq(schema.categories.active, true))).orderBy(schema.categories.sortOrder);
  return rows.map((r) => r.name);
}

export async function removeListingByModerator(adminId: string, type: "product" | "service" | "trip", id: string, reason: string) {
  const db = await useDb();
  const tbl = type === "product" ? schema.products : type === "service" ? schema.services : schema.trips;
  const owner = type === "product" ? schema.products.sellerId : type === "service" ? schema.services.providerId : schema.trips.ownerId;
  const [row] = await db.select({ id: tbl.id, owner }).from(tbl).where(eq(tbl.id, id));
  if (!row) throw new AppError(404, "Not found");
  await db.update(tbl).set({ status: "removed" } as never).where(eq(tbl.id, id));
  await audit(adminId, `${type}.remove`, type, id, { reason });
  void getSettings; void isNull;
}
