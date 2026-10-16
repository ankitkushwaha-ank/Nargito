import "server-only";
import { and, desc, eq, or, sql, ne, inArray } from "drizzle-orm";
import { useDb, schema, rowsOf } from "../db";
import { AppError, pairKey, ok, fail, type ActionResult } from "../util";
import { notify } from "./notify";
import { requireFeature } from "../features";
import { audit } from "../log";
import { z } from "zod";
import { parseInput, optStr, optUrl } from "../validation";
import { snapToCell } from "../location";

export type Relationship = {
  following: boolean;
  connection: "none" | "pending_out" | "pending_in" | "accepted";
  connectionId?: string;
  blocked: boolean; // viewer blocked target
  blockedBy: boolean; // target blocked viewer
  muted: boolean;
};

export async function getRelationship(viewerId: string, targetId: string): Promise<Relationship> {
  const db = await useDb();
  const [f] = await db.select().from(schema.follows).where(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followingId, targetId))).limit(1);
  const [c] = await db.select().from(schema.connections).where(eq(schema.connections.pairKey, pairKey(viewerId, targetId))).limit(1);
  const bl = await db.select().from(schema.blocks).where(or(and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, targetId)), and(eq(schema.blocks.blockerId, targetId), eq(schema.blocks.blockedId, viewerId))));
  const [m] = await db.select().from(schema.mutes).where(and(eq(schema.mutes.userId, viewerId), eq(schema.mutes.mutedUserId, targetId))).limit(1);
  return {
    following: !!f,
    connection: !c ? "none" : c.status === "accepted" ? "accepted" : c.requesterId === viewerId ? "pending_out" : "pending_in",
    connectionId: c?.id,
    blocked: bl.some((b) => b.blockerId === viewerId),
    blockedBy: bl.some((b) => b.blockerId === targetId),
    muted: !!m,
  };
}

/** Whether the viewer may see this profile's full details. */
export async function canViewProfile(viewerId: string | null, target: typeof schema.users.$inferSelect) {
  if (target.deletedAt || target.status === "banned") return false;
  if (viewerId === target.id) return true;
  if (viewerId) {
    const rel = await getRelationship(viewerId, target.id);
    if (rel.blocked || rel.blockedBy) return false;
    if (target.profileVisibility === "public") return true;
    if (target.profileVisibility === "connections") return rel.connection === "accepted";
    return false;
  }
  return target.profileVisibility === "public";
}

async function assertTarget(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw new AppError(400, "You cannot do that to yourself.");
  const db = await useDb();
  const [t] = await db.select().from(schema.users).where(eq(schema.users.id, targetId)).limit(1);
  if (!t || t.deletedAt || t.status === "banned") throw new AppError(404, "User not found.");
  const rel = await getRelationship(viewerId, targetId);
  if (rel.blocked || rel.blockedBy) throw new AppError(403, "This action is not available.");
  return { target: t, rel };
}

export async function followUser(viewerId: string, targetId: string) {
  await requireFeature("connections");
  const { target } = await assertTarget(viewerId, targetId);
  const db = await useDb();
  const r = await db.insert(schema.follows).values({ followerId: viewerId, followingId: targetId }).onConflictDoNothing().returning();
  if (r.length) await notify({ userId: target.id, type: "connection", actorId: viewerId, title: "You have a new follower", link: `/profile/${await usernameOf(viewerId)}`, dedupeKey: `follow:${viewerId}` });
}
export async function unfollowUser(viewerId: string, targetId: string) {
  const db = await useDb();
  await db.delete(schema.follows).where(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followingId, targetId)));
}

async function usernameOf(id: string) {
  const db = await useDb();
  const [u] = await db.select({ u: schema.users.username }).from(schema.users).where(eq(schema.users.id, id));
  return u?.u ?? "";
}

export async function sendConnectionRequest(viewerId: string, targetId: string) {
  await requireFeature("connections");
  const { rel } = await assertTarget(viewerId, targetId);
  if (rel.connection === "accepted") throw new AppError(409, "You are already connected.");
  if (rel.connection === "pending_out") throw new AppError(409, "Request already sent.");
  const db = await useDb();
  if (rel.connection === "pending_in") return acceptConnection(viewerId, rel.connectionId!);
  await db.insert(schema.connections).values({ requesterId: viewerId, addresseeId: targetId, pairKey: pairKey(viewerId, targetId) }).onConflictDoNothing();
  await notify({ userId: targetId, type: "connection", actorId: viewerId, title: "New connection request", link: "/connections", dedupeKey: `conn-req:${viewerId}` });
}

export async function acceptConnection(viewerId: string, connectionId: string) {
  const db = await useDb();
  const [c] = await db.select().from(schema.connections).where(and(eq(schema.connections.id, connectionId), eq(schema.connections.addresseeId, viewerId), eq(schema.connections.status, "pending"))).limit(1);
  if (!c) throw new AppError(404, "Request not found.");
  await db.update(schema.connections).set({ status: "accepted", respondedAt: new Date() }).where(eq(schema.connections.id, c.id));
  await db.insert(schema.follows).values([{ followerId: viewerId, followingId: c.requesterId }, { followerId: c.requesterId, followingId: viewerId }]).onConflictDoNothing();
  await notify({ userId: c.requesterId, type: "connection", actorId: viewerId, title: "Your connection request was accepted", link: `/profile/${await usernameOf(viewerId)}`, dedupeKey: `conn-acc:${viewerId}` });
}

/** Decline (addressee), withdraw (requester) or remove (either side of an accepted connection). */
export async function removeConnection(viewerId: string, connectionId: string) {
  const db = await useDb();
  const [c] = await db.select().from(schema.connections).where(and(eq(schema.connections.id, connectionId), or(eq(schema.connections.requesterId, viewerId), eq(schema.connections.addresseeId, viewerId)))).limit(1);
  if (!c) throw new AppError(404, "Connection not found.");
  await db.delete(schema.connections).where(eq(schema.connections.id, c.id));
}

export async function blockUser(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw new AppError(400, "You cannot block yourself.");
  const db = await useDb();
  await db.transaction(async (tx) => {
    await tx.insert(schema.blocks).values({ blockerId: viewerId, blockedId: targetId }).onConflictDoNothing();
    await tx.delete(schema.follows).where(or(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followingId, targetId)), and(eq(schema.follows.followerId, targetId), eq(schema.follows.followingId, viewerId))));
    await tx.delete(schema.connections).where(eq(schema.connections.pairKey, pairKey(viewerId, targetId)));
  });
}
export async function unblockUser(viewerId: string, targetId: string) {
  const db = await useDb();
  await db.delete(schema.blocks).where(and(eq(schema.blocks.blockerId, viewerId), eq(schema.blocks.blockedId, targetId)));
}
export async function toggleMute(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw new AppError(400, "You cannot mute yourself.");
  const db = await useDb();
  const del = await db.delete(schema.mutes).where(and(eq(schema.mutes.userId, viewerId), eq(schema.mutes.mutedUserId, targetId))).returning();
  if (!del.length) await db.insert(schema.mutes).values({ userId: viewerId, mutedUserId: targetId }).onConflictDoNothing();
  return !del.length;
}

export async function listConnections(userId: string, page = 1, pageSize = 20) {
  const db = await useDb();
  const rows = await db
    .select({ id: schema.connections.id, other: schema.users })
    .from(schema.connections)
    .innerJoin(schema.users, sql`${schema.users.id} = case when ${schema.connections.requesterId} = ${userId} then ${schema.connections.addresseeId} else ${schema.connections.requesterId} end`)
    .where(and(eq(schema.connections.status, "accepted"), or(eq(schema.connections.requesterId, userId), eq(schema.connections.addresseeId, userId)), eq(schema.users.status, "active")))
    .orderBy(desc(schema.connections.respondedAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function pendingRequests(userId: string) {
  const db = await useDb();
  const incoming = await db.select({ id: schema.connections.id, user: schema.users, at: schema.connections.createdAt }).from(schema.connections)
    .innerJoin(schema.users, eq(schema.users.id, schema.connections.requesterId))
    .where(and(eq(schema.connections.addresseeId, userId), eq(schema.connections.status, "pending"))).orderBy(desc(schema.connections.createdAt));
  const outgoing = await db.select({ id: schema.connections.id, user: schema.users, at: schema.connections.createdAt }).from(schema.connections)
    .innerJoin(schema.users, eq(schema.users.id, schema.connections.addresseeId))
    .where(and(eq(schema.connections.requesterId, userId), eq(schema.connections.status, "pending"))).orderBy(desc(schema.connections.createdAt));
  return { incoming, outgoing };
}

export async function listFollowers(userId: string, page = 1, pageSize = 20) {
  const db = await useDb();
  const rows = await db.select({ user: schema.users }).from(schema.follows).innerJoin(schema.users, eq(schema.users.id, schema.follows.followerId))
    .where(and(eq(schema.follows.followingId, userId), eq(schema.users.status, "active"))).orderBy(desc(schema.follows.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function profileCounts(userId: string) {
  const db = await useDb();
  const [r] = rowsOf<{ followers: number; following: number; connections: number; posts: number }>(await db.execute(sql`
    select
      (select count(*)::int from follows where following_id = ${userId}) as followers,
      (select count(*)::int from follows where follower_id = ${userId}) as following,
      (select count(*)::int from connections where status = 'accepted' and (requester_id = ${userId} or addressee_id = ${userId})) as connections,
      (select count(*)::int from posts where author_id = ${userId} and status = 'published' and deleted_at is null) as posts`));
  return r ?? { followers: 0, following: 0, connections: 0, posts: 0 };
}

export function profileCompletion(u: typeof schema.users.$inferSelect) {
  const checks = [!!u.avatarUrl, !!u.headline, !!u.bio && u.bio.length > 20, !!u.locationLabel, u.skills.length > 0, !!u.coverUrl, !!u.emailVerifiedAt];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/* ───────── profile editing ───────── */
const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name.").max(60),
  headline: optStr(120),
  bio: optStr(1000),
  locationLabel: optStr(80),
  website: optUrl,
  skills: optStr(300),
  contactEmail: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email().max(254).optional()),
  contactPhone: optStr(30),
  contactVisibility: z.enum(["private", "connections", "public"]).default("private"),
  avatarUrl: optStr(300),
  coverUrl: optStr(300),
  resumeJson: z.string().max(30000).optional(),
});
const resumeItem = z.object({ kind: z.enum(["experience", "education", "certification", "file"]), title: z.string().trim().min(1).max(120), org: z.string().trim().max(300).default(""), from: z.string().trim().max(20).default(""), to: z.string().trim().max(20).default(""), description: z.string().trim().max(600).default("") }).refine((i) => i.kind !== "file" || /^\/api\/media\/[0-9a-f-]{36}$/i.test(i.org), { message: "Invalid resume file." });
const mediaUrl = /^(\/api\/media\/[0-9a-f-]{36}(\?thumb=1)?|\/(art|images)\/[a-z0-9-]+\.jpg)$/i;

export async function updateProfile(userId: string, input: unknown): Promise<ActionResult> {
  await requireFeature("profiles");
  const p = parseInput(profileSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  for (const k of ["avatarUrl", "coverUrl"] as const) if (d[k] && !mediaUrl.test(d[k]!)) return fail("Invalid image reference.");
  let resume: z.infer<typeof resumeItem>[] | undefined;
  if (d.resumeJson !== undefined) {
    try { const parsed = z.array(resumeItem).max(20).safeParse(JSON.parse(d.resumeJson || "[]")); if (!parsed.success) return fail("Check your resume entries: each needs a title."); resume = parsed.data; } catch { return fail("Resume could not be read."); }
  }
  const db = await useDb();
  await db.update(schema.users).set({
    ...(resume ? { resume } : {}),
    displayName: d.displayName, headline: d.headline ?? null, bio: d.bio ?? null, locationLabel: d.locationLabel ?? null, website: d.website ?? null,
    skills: (d.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15),
    contactEmail: d.contactEmail ?? null, contactPhone: d.contactPhone ?? null, contactVisibility: d.contactVisibility,
    ...(d.avatarUrl !== undefined ? { avatarUrl: d.avatarUrl } : {}), ...(d.coverUrl !== undefined ? { coverUrl: d.coverUrl } : {}),
    updatedAt: new Date(),
  }).where(eq(schema.users.id, userId));
  return ok(undefined, "Profile updated.");
}

export async function updatePrivacy(userId: string, input: { profileVisibility: string; discoverable: boolean }) {
  const vis = ["public", "connections", "private"].includes(input.profileVisibility) ? input.profileVisibility : "public";
  const db = await useDb();
  await db.update(schema.users).set({ profileVisibility: vis, discoverable: input.discoverable, updatedAt: new Date() }).where(eq(schema.users.id, userId));
}

export async function setLocationPreference(userId: string, enabled: boolean, coords?: { lat: number; lng: number }, label?: string) {
  const db = await useDb();
  const cell = coords ? await snapToCell(coords.lat, coords.lng) : null; // precise coordinates are discarded here
  await db.update(schema.users).set({
    locationSharing: enabled, geoCell: enabled ? (cell ?? undefined) : null, ...(label !== undefined ? { locationLabel: label || null } : {}), updatedAt: new Date(),
  }).where(eq(schema.users.id, userId));
  await audit(userId, "location.preference", "user", userId, { enabled });
}

export async function suggestedPeople(viewerId: string | null, limit = 5) {
  const db = await useDb();
  const conds = [eq(schema.users.status, "active"), eq(schema.users.profileVisibility, "public"), eq(schema.users.discoverable, true), sql`${schema.users.deletedAt} is null`];
  if (viewerId) {
    conds.push(ne(schema.users.id, viewerId));
    conds.push(sql`not exists (select 1 from follows f where f.follower_id = ${viewerId} and f.following_id = ${schema.users.id})`);
    conds.push(sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewerId} and b.blocked_id = ${schema.users.id}) or (b.blocker_id = ${schema.users.id} and b.blocked_id = ${viewerId}))`);
  }
  return db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, headline: schema.users.headline, avatarUrl: schema.users.avatarUrl, verified: schema.users.verified })
    .from(schema.users).where(and(...conds))
    .orderBy(sql`(select count(*) from follows where following_id = ${schema.users.id}) desc`, desc(schema.users.createdAt)).limit(limit);
}

export async function usersByIds(ids: string[]) {
  if (!ids.length) return [];
  const db = await useDb();
  return db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, ids));
}
