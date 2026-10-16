import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { useDb, schema } from "../db";
import { AppError, isUuid } from "../util";
import { audit } from "../log";
import { notify } from "./notify";
import { getPermissionsFor } from "../auth/guard";
import { revokeAllSessions } from "../auth/session";

export type UserAction = "warn" | "restrict" | "suspend" | "ban" | "reinstate";

export async function moderateUser(adminId: string, userId: string, action: UserAction, reason: string, days = 7) {
  if (!isUuid(userId)) throw new AppError(400, "Invalid user.");
  if (adminId === userId) throw new AppError(400, "You cannot moderate your own account.");
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!u) throw new AppError(404, "User not found.");
  const targetPerms = await getPermissionsFor(userId);
  if (targetPerms.has("roles.manage") && action !== "warn") throw new AppError(403, "Administrators with role-management access are protected. Remove their role first.");
  const note = reason.trim().slice(0, 300);
  if (action !== "reinstate" && !note) throw new AppError(400, "A reason is required.");
  if (action === "warn") {
    await notify({ userId, type: "announcement", title: "A warning about your account", body: note, link: "/community-guidelines", dedupeKey: `warn:${userId}:${Date.now()}` });
  } else if (action === "restrict") {
    await db.update(schema.users).set({ status: "restricted", statusReason: note, restrictedUntil: new Date(Date.now() + Math.max(1, Math.min(90, days)) * 86400_000) }).where(eq(schema.users.id, userId));
  } else if (action === "suspend") {
    await db.update(schema.users).set({ status: "suspended", statusReason: note, restrictedUntil: null }).where(eq(schema.users.id, userId));
    await revokeAllSessions(userId);
  } else if (action === "ban") {
    await db.update(schema.users).set({ status: "banned", statusReason: note, restrictedUntil: null }).where(eq(schema.users.id, userId));
    await revokeAllSessions(userId);
  } else {
    await db.update(schema.users).set({ status: "active", statusReason: null, restrictedUntil: null }).where(eq(schema.users.id, userId));
  }
  if (action === "restrict" || action === "suspend" || action === "ban") await notify({ userId, type: "announcement", title: `Your account was ${action === "restrict" ? "restricted" : action === "suspend" ? "suspended" : "banned"}`, body: note, link: "/community-guidelines", dedupeKey: `mod:${userId}:${action}:${Date.now()}` });
  await audit(adminId, `user.${action}`, "user", userId, { reason: note, days: action === "restrict" ? days : undefined });
}

const TABLES = {
  post: { tbl: schema.posts, ownerCol: schema.posts.authorId, remove: { status: "removed" }, restore: { status: "published" } },
  trip: { tbl: schema.trips, ownerCol: schema.trips.ownerId, remove: { status: "removed" }, restore: { status: "published" } },
  product: { tbl: schema.products, ownerCol: schema.products.sellerId, remove: { status: "removed" }, restore: { status: "active" } },
  service: { tbl: schema.services, ownerCol: schema.services.providerId, remove: { status: "removed" }, restore: { status: "active" } },
  company: { tbl: schema.companies, ownerCol: schema.companies.ownerId, remove: { status: "removed" }, restore: { status: "active" } },
  shop: { tbl: schema.shops, ownerCol: schema.shops.ownerId, remove: { status: "removed" }, restore: { status: "active" } },
  group: { tbl: schema.groups, ownerCol: schema.groups.ownerId, remove: { status: "removed" }, restore: { status: "active" } },
} as const;
export type ContentType = keyof typeof TABLES | "comment";

export async function moderateContent(adminId: string, type: ContentType, id: string, action: "remove" | "restore", reason: string) {
  if (!isUuid(id)) throw new AppError(400, "Invalid id.");
  const db = await useDb();
  const note = reason.trim().slice(0, 300);
  if (action === "remove" && !note) throw new AppError(400, "A reason is required.");
  if (type === "comment") {
    const [c] = await db.select().from(schema.comments).where(eq(schema.comments.id, id));
    if (!c) throw new AppError(404, "Not found");
    if (action === "remove" && c.status === "published") {
      await db.update(schema.comments).set({ status: "removed" }).where(eq(schema.comments.id, id));
      await db.update(schema.posts).set({ commentCount: sql`greatest(${schema.posts.commentCount} - 1, 0)` }).where(eq(schema.posts.id, c.postId));
    } else if (action === "restore" && c.status === "removed") {
      await db.update(schema.comments).set({ status: "published" }).where(eq(schema.comments.id, id));
      await db.update(schema.posts).set({ commentCount: sql`${schema.posts.commentCount} + 1` }).where(eq(schema.posts.id, c.postId));
    }
    await audit(adminId, `comment.${action}`, "comment", id, { reason: note });
    return;
  }
  const t = TABLES[type];
  if (!t) throw new AppError(400, "Unsupported content type.");
  const patch = action === "remove" ? t.remove : t.restore;
  const [row] = await db.select({ id: (t.tbl as typeof schema.posts).id, owner: t.ownerCol }).from(t.tbl as typeof schema.posts).where(eq((t.tbl as typeof schema.posts).id, id));
  if (!row) throw new AppError(404, "Not found");
  await db.update(t.tbl as typeof schema.posts).set(type === "post" && action === "remove" ? { ...patch, deletedAt: new Date() } : type === "post" ? { ...patch, deletedAt: null } : (patch as never)).where(eq((t.tbl as typeof schema.posts).id, id));
  if (action === "remove") await notify({ userId: String(row.owner), type: "announcement", title: `Your ${type} was removed by a moderator`, body: note, link: "/community-guidelines", dedupeKey: `rm:${type}:${id}` });
  await audit(adminId, `${type}.${action}`, type, id, { reason: note });
}

export async function resolveReport(adminId: string, reportId: string, input: { status: "reviewing" | "resolved" | "dismissed" | "appealed"; resolution?: string; notes?: string; action?: string; assignToMe?: boolean }) {
  const db = await useDb();
  const [r] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
  if (!r) throw new AppError(404, "Report not found.");
  const done = input.status === "resolved" || input.status === "dismissed";
  await db.update(schema.reports).set({
    status: input.status, resolution: input.resolution?.slice(0, 500) ?? r.resolution, reviewNotes: input.notes?.slice(0, 1000) ?? r.reviewNotes,
    assigneeId: input.assignToMe ? adminId : r.assigneeId, resolvedAt: done ? new Date() : null,
  }).where(eq(schema.reports.id, reportId));
  await db.insert(schema.reportActions).values({ reportId, adminId, action: input.action ?? `status:${input.status}`, note: input.notes?.slice(0, 500) ?? null });
  await audit(adminId, `report.${input.status}`, "report", reportId, { action: input.action });
  if (done && r.reporterId) await notify({ userId: r.reporterId, type: "announcement", title: "Your report was reviewed", body: input.status === "resolved" ? "We took action on the content you reported." : "We reviewed your report and found no violation.", link: "/community-guidelines", dedupeKey: `report:${reportId}:${input.status}` });
}

/** Find the owner/author of reported content (to apply user-level actions straight from a report). */
export async function reportTargetOwner(type: string, id: string): Promise<string | null> {
  const db = await useDb();
  if (type === "user") return id;
  if (type in TABLES) {
    const t = TABLES[type as keyof typeof TABLES];
    const [row] = await db.select({ owner: t.ownerCol }).from(t.tbl as typeof schema.posts).where(eq((t.tbl as typeof schema.posts).id, id));
    return row ? String(row.owner) : null;
  }
  if (type === "comment") { const [c] = await db.select({ a: schema.comments.authorId }).from(schema.comments).where(eq(schema.comments.id, id)); return c?.a ?? null; }
  if (type === "message") { const [m] = await db.select({ a: schema.messages.senderId }).from(schema.messages).where(eq(schema.messages.id, id)); return m?.a ?? null; }
  return null;
}
void and; void inArray;
