import "server-only";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { useDb, schema } from "../db";
import { AppError, ok, fail, isUuid, likeEscape, slugify, uniqueSuffix, type ActionResult } from "../util";
import { requireFeature } from "../features";
import { enforceRateLimit } from "../ratelimit";
import { optStr, optUrl, parseInput } from "../validation";
import { memberRole, userCell } from "./listings";
import { notify } from "./notify";

const MEDIA_URL = /^(\/api\/media\/[0-9a-f-]{36}(\?thumb=1)?|\/(art|images)\/[a-z0-9-]+\.jpg)$/i;
const urlOpt = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().regex(MEDIA_URL, "Invalid image").optional());

async function uniqueSlug(table: "companies" | "shops" | "groups", name: string) {
  const db = await useDb();
  const tbl = table === "companies" ? schema.companies : table === "shops" ? schema.shops : schema.groups;
  const base = slugify(name, 40);
  for (let i = 0; i < 5; i++) {
    const s = i === 0 ? base : `${base}-${uniqueSuffix()}`;
    const [r] = await db.select({ id: tbl.id }).from(tbl).where(eq(tbl.slug, s)).limit(1);
    if (!r) return s;
  }
  return `${base}-${uniqueSuffix()}${uniqueSuffix()}`;
}

export const ROLE_ORDER = ["viewer", "editor", "admin", "owner"] as const;
export const canManageMembers = (role: string | null) => role === "owner" || role === "admin";
export const canEdit = (role: string | null) => role === "owner" || role === "admin" || role === "editor";

/* ───────── companies ───────── */
const companySchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100),
  tagline: optStr(140), description: optStr(5000), industry: optStr(80), website: optUrl,
  publicEmail: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email().max(254).optional()),
  publicPhone: optStr(30), locationLabel: optStr(100), logoUrl: urlOpt, coverUrl: urlOpt,
});

export async function saveCompany(userId: string, id: string | null, input: unknown): Promise<ActionResult<{ slug: string }>> {
  await requireFeature("companies");
  await enforceRateLimit("business", 15, 3600, userId);
  const p = parseInput(companySchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  const db = await useDb();
  const values = { name: d.name, tagline: d.tagline ?? null, description: d.description ?? null, industry: d.industry ?? null, website: d.website ?? null, publicEmail: d.publicEmail ?? null, publicPhone: d.publicPhone ?? null, locationLabel: d.locationLabel ?? null, logoUrl: d.logoUrl ?? null, coverUrl: d.coverUrl ?? null, updatedAt: new Date() };
  if (id) {
    const [c] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    if (!c || !canEdit(await memberRole("company", id, userId))) throw new AppError(404, "Company not found.");
    if (c.status === "removed") return fail("This page was removed by moderators.");
    await db.update(schema.companies).set(values).where(eq(schema.companies.id, id));
    return ok({ slug: c.slug }, "Company updated.");
  }
  const slug = await uniqueSlug("companies", d.name);
  const [c] = await db.insert(schema.companies).values({ ...values, slug, ownerId: userId, geoCell: await userCell(userId) }).returning();
  await db.insert(schema.companyMembers).values({ companyId: c!.id, userId, role: "owner" });
  return ok({ slug }, "Company created.");
}

export async function getCompany(slug: string, viewerId: string | null) {
  const db = await useDb();
  const [c] = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug));
  if (!c || c.status === "removed") return null;
  const role = viewerId ? await memberRole("company", c.id, viewerId) : null;
  if (c.status !== "active" && !role) return null;
  const [owner] = await db.select({ username: schema.users.username, displayName: schema.users.displayName, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, c.ownerId));
  if (!role && owner?.status !== "active") return null;
  const [{ followers }] = await db.select({ followers: sql<number>`count(*)::int` }).from(schema.entityFollows).where(and(eq(schema.entityFollows.entityType, "company"), eq(schema.entityFollows.entityId, c.id)));
  const following = viewerId ? !!(await db.select().from(schema.entityFollows).where(and(eq(schema.entityFollows.userId, viewerId), eq(schema.entityFollows.entityType, "company"), eq(schema.entityFollows.entityId, c.id))))[0] : false;
  const team = await db.select({ role: schema.companyMembers.role, u: schema.users }).from(schema.companyMembers).innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId)).where(eq(schema.companyMembers.companyId, c.id));
  return { c, role, followers: followers!, following, team: team.filter((t) => t.u.status === "active").map((t) => ({ role: t.role, id: t.u.id, username: t.u.username, displayName: t.u.displayName, avatarUrl: t.u.avatarUrl, headline: t.u.headline })), owner };
}

/* ───────── shops ───────── */
const shopSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100), description: optStr(5000), category: optStr(60), serviceArea: optStr(120),
  locationLabel: optStr(100), hours: optStr(300), contactPreference: z.enum(["enquiry", "phone", "email"]).default("enquiry"),
  logoUrl: urlOpt, coverUrl: urlOpt, companyId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
});

export async function saveShop(userId: string, id: string | null, input: unknown): Promise<ActionResult<{ slug: string }>> {
  await requireFeature("shops");
  await enforceRateLimit("business", 15, 3600, userId);
  const p = parseInput(shopSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  const db = await useDb();
  if (d.companyId && !canEdit(await memberRole("company", d.companyId, userId))) return fail("You cannot attach the shop to that company.");
  const values = { name: d.name, description: d.description ?? null, category: d.category ?? null, serviceArea: d.serviceArea ?? null, locationLabel: d.locationLabel ?? null, hours: d.hours ?? null, contactPreference: d.contactPreference, logoUrl: d.logoUrl ?? null, coverUrl: d.coverUrl ?? null, companyId: d.companyId ?? null, updatedAt: new Date() };
  if (id) {
    const [s] = await db.select().from(schema.shops).where(eq(schema.shops.id, id));
    if (!s || !canEdit(await memberRole("shop", id, userId))) throw new AppError(404, "Shop not found.");
    if (s.status === "removed") return fail("This page was removed by moderators.");
    await db.update(schema.shops).set(values).where(eq(schema.shops.id, id));
    return ok({ slug: s.slug }, "Shop updated.");
  }
  const slug = await uniqueSlug("shops", d.name);
  const [s] = await db.insert(schema.shops).values({ ...values, slug, ownerId: userId, geoCell: await userCell(userId) }).returning();
  await db.insert(schema.shopMembers).values({ shopId: s!.id, userId, role: "owner" });
  return ok({ slug }, "Shop created.");
}

export async function getShop(slug: string, viewerId: string | null) {
  const db = await useDb();
  const [s] = await db.select().from(schema.shops).where(eq(schema.shops.slug, slug));
  if (!s || s.status === "removed") return null;
  const role = viewerId ? await memberRole("shop", s.id, viewerId) : null;
  if (s.status !== "active" && !role) return null;
  const [owner] = await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, s.ownerId));
  if (!role && owner?.status !== "active") return null;
  const [{ followers }] = await db.select({ followers: sql<number>`count(*)::int` }).from(schema.entityFollows).where(and(eq(schema.entityFollows.entityType, "shop"), eq(schema.entityFollows.entityId, s.id)));
  const following = viewerId ? !!(await db.select().from(schema.entityFollows).where(and(eq(schema.entityFollows.userId, viewerId), eq(schema.entityFollows.entityType, "shop"), eq(schema.entityFollows.entityId, s.id))))[0] : false;
  const team = await db.select({ role: schema.shopMembers.role, u: schema.users }).from(schema.shopMembers).innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId)).where(eq(schema.shopMembers.shopId, s.id));
  return { s, role, followers: followers!, following, team: team.map((t) => ({ role: t.role, id: t.u.id, username: t.u.username, displayName: t.u.displayName, avatarUrl: t.u.avatarUrl })) };
}

export async function toggleEntityFollow(userId: string, type: "company" | "shop", entityId: string) {
  await requireFeature(type === "company" ? "companies" : "shops");
  const db = await useDb();
  const del = await db.delete(schema.entityFollows).where(and(eq(schema.entityFollows.userId, userId), eq(schema.entityFollows.entityType, type), eq(schema.entityFollows.entityId, entityId))).returning();
  if (del.length) return { following: false };
  const tbl = type === "company" ? schema.companies : schema.shops;
  const [e] = await db.select({ id: tbl.id, ownerId: tbl.ownerId, name: tbl.name, slug: tbl.slug }).from(tbl).where(eq(tbl.id, entityId));
  if (!e) throw new AppError(404, "Not found");
  await db.insert(schema.entityFollows).values({ userId, entityType: type, entityId }).onConflictDoNothing();
  await notify({ userId: e.ownerId, type: "business", actorId: userId, title: `New follower for ${e.name}`, link: `/${type === "company" ? "companies" : "shops"}/${e.slug}`, dedupeKey: `bfollow:${entityId}:${userId}` });
  return { following: true };
}

/* ───────── team members ───────── */
export async function addMember(actorId: string, kind: "company" | "shop", entityId: string, username: string, role: string): Promise<ActionResult> {
  if (!(["viewer", "editor", "admin"] as string[]).includes(role)) return fail("Invalid role.");
  if (!canManageMembers(await memberRole(kind, entityId, actorId))) throw new AppError(403, "Only owners and admins can manage the team.");
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(sql`lower(${schema.users.username}) = ${username.trim().toLowerCase().replace(/^@/, "")}`);
  if (!u || u.status !== "active") return fail("No active user with that username.");
  if (kind === "company") await db.insert(schema.companyMembers).values({ companyId: entityId, userId: u.id, role }).onConflictDoUpdate({ target: [schema.companyMembers.companyId, schema.companyMembers.userId], set: { role }, setWhere: sql`${schema.companyMembers.role} <> 'owner'` });
  else await db.insert(schema.shopMembers).values({ shopId: entityId, userId: u.id, role }).onConflictDoUpdate({ target: [schema.shopMembers.shopId, schema.shopMembers.userId], set: { role }, setWhere: sql`${schema.shopMembers.role} <> 'owner'` });
  await notify({ userId: u.id, type: "business", actorId, title: "You were added to a business team", link: "/my/businesses", dedupeKey: `team:${entityId}:${u.id}:${role}` });
  return ok(undefined, `${u.displayName} added as ${role}.`);
}

export async function removeMember(actorId: string, kind: "company" | "shop", entityId: string, userId: string): Promise<ActionResult> {
  const self = actorId === userId;
  if (!self && !canManageMembers(await memberRole(kind, entityId, actorId))) throw new AppError(403, "Only owners and admins can manage the team.");
  const target = await memberRole(kind, entityId, userId);
  if (target === "owner") return fail("The owner cannot be removed.");
  const db = await useDb();
  if (kind === "company") await db.delete(schema.companyMembers).where(and(eq(schema.companyMembers.companyId, entityId), eq(schema.companyMembers.userId, userId)));
  else await db.delete(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, entityId), eq(schema.shopMembers.userId, userId)));
  return ok();
}

export async function myBusinesses(userId: string) {
  const db = await useDb();
  const companies = await db.select({ c: schema.companies, role: schema.companyMembers.role }).from(schema.companyMembers).innerJoin(schema.companies, eq(schema.companies.id, schema.companyMembers.companyId)).where(and(eq(schema.companyMembers.userId, userId), sql`${schema.companies.status} <> 'removed'`)).orderBy(desc(schema.companies.createdAt));
  const shops = await db.select({ s: schema.shops, role: schema.shopMembers.role }).from(schema.shopMembers).innerJoin(schema.shops, eq(schema.shops.id, schema.shopMembers.shopId)).where(and(eq(schema.shopMembers.userId, userId), sql`${schema.shops.status} <> 'removed'`)).orderBy(desc(schema.shops.createdAt));
  return { companies, shops };
}

export async function listCompanies(f: { q?: string; industry?: string; page?: number }, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.companies.status, "active"), sql`exists (select 1 from users u where u.id = ${schema.companies.ownerId} and u.status = 'active')`];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.companies.name, l), ilike(schema.companies.description, l), ilike(schema.companies.tagline, l))!); }
  if (f.industry) conds.push(eq(schema.companies.industry, f.industry));
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select().from(schema.companies).where(and(...conds)).orderBy(desc(schema.companies.verified), desc(schema.companies.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
export async function listShops(f: { q?: string; category?: string; page?: number }, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.shops.status, "active"), sql`exists (select 1 from users u where u.id = ${schema.shops.ownerId} and u.status = 'active')`];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.shops.name, l), ilike(schema.shops.description, l), ilike(schema.shops.category, l))!); }
  if (f.category) conds.push(eq(schema.shops.category, f.category));
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select().from(schema.shops).where(and(...conds)).orderBy(desc(schema.shops.verified), desc(schema.shops.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

/* ───────── verification requests ───────── */
export async function submitVerification(userId: string, kind: "user" | "company" | "shop", entityId: string | null, note: string, evidenceMediaIds: string[]): Promise<ActionResult> {
  await requireFeature("verification");
  await enforceRateLimit("verify-req", 5, 86400, userId);
  const db = await useDb();
  if (kind !== "user") {
    if (!entityId || !isUuid(entityId) || !canManageMembers(await memberRole(kind, entityId, userId))) return fail("You cannot request verification for that business.");
  }
  const [open] = await db.select().from(schema.verificationRequests).where(and(eq(schema.verificationRequests.userId, userId), eq(schema.verificationRequests.kind, kind), sql`${schema.verificationRequests.status} in ('pending','more_info')`, entityId ? eq(schema.verificationRequests.entityId, entityId) : sql`true`)).limit(1);
  if (open) return fail("You already have an open verification request.");
  const media = evidenceMediaIds.length ? await db.select({ id: schema.media.id }).from(schema.media).where(and(sql`${schema.media.id} in (${sql.join(evidenceMediaIds.map((i) => sql`${i}::uuid`), sql`, `)})`, eq(schema.media.ownerId, userId))) : [];
  await db.insert(schema.verificationRequests).values({ userId, kind, entityId, note: note.slice(0, 1000) || null, evidenceMediaIds: media.map((m) => m.id) });
  return ok(undefined, "Verification request submitted. We'll notify you of the outcome.");
}

/* ───────── groups ───────── */
const groupSchema = z.object({ name: z.string().trim().min(3, "Enter a name (3+ characters).").max(80), description: optStr(2000), category: optStr(60), visibility: z.enum(["public", "private"]).default("public"), coverUrl: urlOpt });

export async function createGroup(userId: string, input: unknown): Promise<ActionResult<{ slug: string }>> {
  await requireFeature("groups");
  await enforceRateLimit("group", 10, 3600, userId);
  const p = parseInput(groupSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  const db = await useDb();
  const slug = await uniqueSlug("groups", d.name);
  const [g] = await db.insert(schema.groups).values({ ownerId: userId, name: d.name, slug, description: d.description ?? null, category: d.category ?? null, visibility: d.visibility, coverUrl: d.coverUrl ?? null }).returning();
  await db.insert(schema.groupMembers).values({ groupId: g!.id, userId, role: "owner" });
  return ok({ slug }, "Group created.");
}

export async function getGroup(slug: string, viewerId: string | null) {
  const db = await useDb();
  const [g] = await db.select().from(schema.groups).where(eq(schema.groups.slug, slug));
  if (!g || g.status !== "active") return null;
  const mem = viewerId ? (await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, g.id), eq(schema.groupMembers.userId, viewerId))))[0] ?? null : null;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, g.id), eq(schema.groupMembers.status, "active")));
  const isMember = mem?.status === "active";
  return { g, mem, isMember, memberCount: n!, canView: g.visibility === "public" || isMember };
}

export async function joinGroup(userId: string, groupId: string): Promise<ActionResult> {
  await requireFeature("groups");
  const db = await useDb();
  const [g] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!g || g.status !== "active") throw new AppError(404, "Group not found.");
  const status = g.visibility === "public" ? "active" : "pending";
  const r = await db.insert(schema.groupMembers).values({ groupId, userId, role: "member", status }).onConflictDoNothing().returning();
  if (!r.length) return fail("You are already a member or have a pending request.");
  if (status === "pending") await notify({ userId: g.ownerId, type: "group", actorId: userId, title: `Join request for ${g.name}`, link: `/groups/${g.slug}`, dedupeKey: `gjoin:${groupId}:${userId}` });
  return ok(undefined, status === "active" ? "You joined the group." : "Request sent to the group admins.");
}

export async function leaveGroup(userId: string, groupId: string): Promise<ActionResult> {
  const db = await useDb();
  const [m] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  if (!m) return fail("You are not a member.");
  if (m.role === "owner") return fail("The owner cannot leave. Delete or transfer the group first.");
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  return ok();
}

export async function decideGroupRequest(actorId: string, groupId: string, userId: string, approve: boolean): Promise<ActionResult> {
  const db = await useDb();
  const [m] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, actorId), eq(schema.groupMembers.status, "active")));
  if (!m || (m.role !== "owner" && m.role !== "moderator")) throw new AppError(403, "Only group admins can do that.");
  if (approve) await db.update(schema.groupMembers).set({ status: "active" }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  else await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  return ok();
}

export async function listGroups(f: { q?: string; category?: string; page?: number }, pageSize = 18) {
  const db = await useDb();
  const conds: SQL[] = [eq(schema.groups.status, "active"), eq(schema.groups.visibility, "public")];
  if (f.q) { const l = `%${likeEscape(f.q)}%`; conds.push(or(ilike(schema.groups.name, l), ilike(schema.groups.description, l))!); }
  if (f.category) conds.push(eq(schema.groups.category, f.category));
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.select({ g: schema.groups, members: sql<number>`(select count(*)::int from group_members gm where gm.group_id = groups.id and gm.status = 'active')` }).from(schema.groups).where(and(...conds)).orderBy(desc(schema.groups.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function myGroups(userId: string) {
  const db = await useDb();
  return db.select({ g: schema.groups, role: schema.groupMembers.role, status: schema.groupMembers.status }).from(schema.groupMembers).innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId)).where(and(eq(schema.groupMembers.userId, userId), eq(schema.groups.status, "active"))).orderBy(desc(schema.groupMembers.createdAt));
}
