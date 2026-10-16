import "server-only";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { useDb, schema } from "../db";
import { sendEmail } from "../mail";
import { appUrl } from "../mail";
import { isFeatureEnabled } from "../features";

export const NOTIFICATION_TYPES = [
  { key: "connection", label: "Connection requests and acceptances" },
  { key: "reaction", label: "Likes on your posts" },
  { key: "comment", label: "Comments and replies" },
  { key: "mention", label: "Mentions" },
  { key: "message", label: "New messages" },
  { key: "enquiry", label: "Listing enquiries and responses" },
  { key: "group", label: "Group activity" },
  { key: "business", label: "Company and shop updates" },
  { key: "verification", label: "Verification outcomes" },
  { key: "announcement", label: "Platform announcements" },
] as const;
const DEFAULT_EMAIL_ON = new Set(["verification", "announcement"]);

export type NotifyInput = { userId: string; type: string; actorId?: string | null; title: string; body?: string; link?: string; dedupeKey?: string };

/** Creates an in-app notification (respecting preferences and dedupe) and optionally emails if the user opted in. */
export async function notify(n: NotifyInput) {
  if (n.actorId && n.actorId === n.userId) return;
  if (!(await isFeatureEnabled("notifications"))) return;
  const db = await useDb();
  const prefs = await db.select().from(schema.notificationPrefs).where(and(eq(schema.notificationPrefs.userId, n.userId), eq(schema.notificationPrefs.type, n.type)));
  const pref = (ch: string, def: boolean) => prefs.find((p) => p.channel === ch)?.enabled ?? def;
  if (n.actorId) {
    const blocked = await db.select().from(schema.blocks).where(and(eq(schema.blocks.blockerId, n.userId), eq(schema.blocks.blockedId, n.actorId))).limit(1);
    if (blocked[0]) return;
  }
  if (pref("in_app", true)) {
    await db.insert(schema.notifications).values({
      userId: n.userId, type: n.type, actorId: n.actorId ?? null, title: n.title.slice(0, 200), body: n.body?.slice(0, 300) ?? null, link: n.link ?? null, dedupeKey: n.dedupeKey ?? null,
    }).onConflictDoNothing();
  }
  if (pref("email", DEFAULT_EMAIL_ON.has(n.type))) {
    const [u] = await db.select({ email: schema.users.email, verified: schema.users.emailVerifiedAt }).from(schema.users).where(eq(schema.users.id, n.userId));
    if (u?.verified) {
      const link = n.link ? `${await appUrl()}${n.link}` : await appUrl();
      await sendEmail(u.email, n.title, `<p>${escapeHtml(n.title)}</p>${n.body ? `<p>${escapeHtml(n.body)}</p>` : ""}<p><a href="${link}">Open Nargito</a></p>`, `${n.title}\n${n.body ?? ""}\n${link}`);
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function unreadNotificationCount(userId: string) {
  const db = await useDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, cursor?: string | null, limit = 20) {
  const db = await useDb();
  const conds = [eq(schema.notifications.userId, userId)];
  if (cursor) conds.push(lt(schema.notifications.createdAt, new Date(cursor)));
  const rows = await db
    .select({ n: schema.notifications, actorName: schema.users.displayName, actorAvatar: schema.users.avatarUrl })
    .from(schema.notifications)
    .leftJoin(schema.users, eq(schema.users.id, schema.notifications.actorId))
    .where(and(...conds)).orderBy(desc(schema.notifications.createdAt)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: hasMore ? items[items.length - 1]!.n.createdAt.toISOString() : null };
}

export async function markRead(userId: string, id?: string) {
  const db = await useDb();
  const conds = [eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)];
  if (id) conds.push(eq(schema.notifications.id, id));
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(...conds));
}
