import "server-only";
import { and, desc, eq, inArray, lt, ne, or, sql, isNull } from "drizzle-orm";
import { useDb, schema, rowsOf } from "../db";
import { AppError, pairKey, ok, fail, isUuid, likeEscape, truncate, type ActionResult } from "../util";
import { getSettings } from "../settings";
import { requireFeature, isFeatureEnabled } from "../features";
import { enforceRateLimit } from "../ratelimit";
import { notify } from "./notify";
import { resolveEntity } from "./entities";

async function blockedBetween(a: string, b: string) {
  const db = await useDb();
  const r = await db.select().from(schema.blocks).where(or(and(eq(schema.blocks.blockerId, a), eq(schema.blocks.blockedId, b)), and(eq(schema.blocks.blockerId, b), eq(schema.blocks.blockedId, a)))).limit(1);
  return !!r[0];
}

async function ensureConversation(a: string, b: string, contextKey: string) {
  const db = await useDb();
  const pk = pairKey(a, b);
  const [existing] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.pairKey, pk), eq(schema.conversations.contextKey, contextKey))).limit(1);
  if (existing) return { id: existing.id, created: false };
  const [c] = await db.insert(schema.conversations).values({ pairKey: pk, contextKey }).onConflictDoNothing().returning();
  if (!c) {
    const [again] = await db.select().from(schema.conversations).where(and(eq(schema.conversations.pairKey, pk), eq(schema.conversations.contextKey, contextKey))).limit(1);
    return { id: again!.id, created: false };
  }
  await db.insert(schema.conversationParticipants).values([{ conversationId: c.id, userId: a }, { conversationId: c.id, userId: b }]).onConflictDoNothing();
  return { id: c.id, created: true };
}

export async function messagingEnabled() {
  const s = await getSettings(["chat.enabled"]);
  return Boolean(s["chat.enabled"]) && (await isFeatureEnabled("messaging"));
}

export async function startDirectConversation(userId: string, otherId: string) {
  await requireFeature("messaging");
  if (!(await messagingEnabled())) throw new AppError(403, "Messaging is currently disabled.");
  if (userId === otherId) throw new AppError(400, "You cannot message yourself.");
  const db = await useDb();
  const [o] = await db.select({ s: schema.users.status, d: schema.users.deletedAt }).from(schema.users).where(eq(schema.users.id, otherId));
  if (!o || o.d || o.s === "banned") throw new AppError(404, "User not found.");
  if (await blockedBetween(userId, otherId)) throw new AppError(403, "You cannot message this user.");
  return (await ensureConversation(userId, otherId, "")).id;
}

async function assertParticipant(userId: string, conversationId: string) {
  if (!isUuid(conversationId)) throw new AppError(404, "Conversation not found.");
  const db = await useDb();
  const [p] = await db.select().from(schema.conversationParticipants).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, userId))).limit(1);
  if (!p) throw new AppError(404, "Conversation not found."); // 404, not 403: do not reveal existence
  const others = await db.select().from(schema.conversationParticipants).where(and(eq(schema.conversationParticipants.conversationId, conversationId), ne(schema.conversationParticipants.userId, userId)));
  return { participant: p, otherId: others[0]?.userId ?? null };
}

export async function sendMessage(userId: string, conversationId: string, bodyRaw: string, attachmentId?: string | null): Promise<ActionResult<{ id: string }>> {
  await requireFeature("messaging");
  const s = await getSettings();
  if (!s["chat.enabled"]) return fail("Messaging is currently disabled.");
  await enforceRateLimit("message", 60, 60, userId);
  const { otherId } = await assertParticipant(userId, conversationId);
  if (!otherId) return fail("This conversation has no other participant.");
  if (await blockedBetween(userId, otherId)) return fail("You cannot message this user.");
  const body = bodyRaw.trim();
  if (!body && !attachmentId) return fail("Write a message first.");
  if (body.length > Number(s["chat.maxMessageLength"])) return fail(`Messages are limited to ${s["chat.maxMessageLength"]} characters.`);
  let kind = "text";
  const db = await useDb();
  if (attachmentId) {
    if (!s["chat.allowAttachments"]) return fail("Attachments are disabled.");
    const [m] = await db.select().from(schema.media).where(and(eq(schema.media.id, attachmentId), eq(schema.media.ownerId, userId))).limit(1);
    if (!m) return fail("Attachment not found.");
    kind = m.kind === "image" ? "image" : "file";
  }
  const [msg] = await db.insert(schema.messages).values({ conversationId, senderId: userId, body, kind, attachmentId: attachmentId ?? null }).returning({ id: schema.messages.id });
  await db.update(schema.conversations).set({ lastMessageAt: new Date() }).where(eq(schema.conversations.id, conversationId));
  await db.update(schema.conversationParticipants).set({ lastReadAt: new Date() }).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, userId)));
  // enquiry status -> responded when the recipient replies
  await db.update(schema.enquiries).set({ status: "responded", updatedAt: new Date() }).where(and(eq(schema.enquiries.conversationId, conversationId), eq(schema.enquiries.recipientId, userId), eq(schema.enquiries.status, "new")));
  const [other] = await db.select().from(schema.conversationParticipants).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, otherId)));
  if (!other?.muted) await notify({ userId: otherId, type: "message", actorId: userId, title: "New message", body: truncate(body || "Sent an attachment", 100), link: `/messages/${conversationId}`, dedupeKey: `msg:${conversationId}` });
  return ok({ id: msg!.id });
}

export async function markConversationRead(userId: string, conversationId: string) {
  const db = await useDb();
  await db.update(schema.conversationParticipants).set({ lastReadAt: new Date() }).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, userId)));
  await db.delete(schema.notifications).where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.dedupeKey, `msg:${conversationId}`)));
}

export type MessageView = { id: string; senderId: string | null; kind: string; body: string; createdAt: string; mine: boolean; attachment: { url: string; kind: string } | null; read: boolean };

export async function getMessages(userId: string, conversationId: string, opts: { before?: string | null; after?: string | null; limit?: number } = {}) {
  const { otherId } = await assertParticipant(userId, conversationId);
  const db = await useDb();
  const limit = opts.limit ?? 40;
  const conds = [eq(schema.messages.conversationId, conversationId), isNull(schema.messages.deletedAt)];
  if (opts.before) conds.push(lt(schema.messages.createdAt, new Date(opts.before)));
  if (opts.after) conds.push(sql`${schema.messages.createdAt} > ${new Date(opts.after)}`);
  const rows = opts.after
    ? await db.select().from(schema.messages).where(and(...conds)).orderBy(schema.messages.createdAt).limit(200)
    : await db.select().from(schema.messages).where(and(...conds)).orderBy(desc(schema.messages.createdAt)).limit(limit + 1);
  const hasMore = !opts.after && rows.length > limit;
  const slice = (opts.after ? rows : rows.slice(0, limit)).reverse().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let otherRead: Date | null = null;
  if (otherId) {
    const [p] = await db.select().from(schema.conversationParticipants).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, otherId)));
    otherRead = p?.lastReadAt ?? null;
  }
  const atts = slice.filter((m) => m.attachmentId).map((m) => m.attachmentId!);
  const mediaRows = atts.length ? await db.select().from(schema.media).where(inArray(schema.media.id, atts)) : [];
  const mMap = new Map(mediaRows.map((m) => [m.id, m]));
  const items: MessageView[] = slice.map((m) => ({
    id: m.id, senderId: m.senderId, kind: m.kind, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderId === userId,
    attachment: m.attachmentId && mMap.get(m.attachmentId) ? { url: `/api/media/${m.attachmentId}`, kind: mMap.get(m.attachmentId)!.kind } : null,
    read: m.senderId === userId && !!otherRead && otherRead >= m.createdAt,
  }));
  return { items, hasMore, oldest: items[0]?.createdAt ?? null };
}

export async function listConversations(userId: string, q?: string) {
  const db = await useDb();
  const like = q ? `%${likeEscape(q)}%` : null;
  const res = await db.execute(sql`
    SELECT c.id::text AS id, c.last_message_at,
      o.id::text AS other_id, o.display_name AS other_name, o.username AS other_username, o.avatar_url AS other_avatar, o.status AS other_status,
      cp.muted,
      (SELECT left(m.body, 80) FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_body,
      (SELECT m.kind FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_kind,
      (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL AND m.sender_id <> ${userId}::uuid AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)) AS unread,
      (SELECT e.title_snapshot FROM enquiries e WHERE e.conversation_id = c.id LIMIT 1) AS context_title
    FROM conversation_participants cp
    JOIN conversations c ON c.id = cp.conversation_id
    JOIN conversation_participants op ON op.conversation_id = c.id AND op.user_id <> cp.user_id
    JOIN users o ON o.id = op.user_id
    WHERE cp.user_id = ${userId}::uuid
      ${like ? sql`AND (o.display_name ILIKE ${like} OR o.username ILIKE ${like} OR EXISTS (SELECT 1 FROM enquiries e WHERE e.conversation_id = c.id AND e.title_snapshot ILIKE ${like}))` : sql``}
    ORDER BY c.last_message_at DESC NULLS LAST LIMIT 100`);
  return rowsOf<{ id: string; last_message_at: Date | string; other_id: string; other_name: string; other_username: string; other_avatar: string | null; other_status: string; muted: boolean; last_body: string | null; last_kind: string | null; unread: number; context_title: string | null }>(res);
}

export async function unreadMessageCount(userId: string) {
  const db = await useDb();
  const res = await db.execute(sql`SELECT count(DISTINCT c.id)::int AS n FROM conversation_participants cp JOIN conversations c ON c.id = cp.conversation_id
    WHERE cp.user_id = ${userId}::uuid AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL AND m.sender_id <> ${userId}::uuid AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at))`);
  return rowsOf<{ n: number }>(res)[0]?.n ?? 0;
}

export async function getConversationView(userId: string, conversationId: string) {
  const { otherId, participant } = await assertParticipant(userId, conversationId);
  const db = await useDb();
  const [other] = otherId ? await db.select().from(schema.users).where(eq(schema.users.id, otherId)) : [];
  const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.conversationId, conversationId)).limit(1);
  let listing: { title: string; href: string | null; image: string | null; subtitle: string | null; available: boolean } | null = null;
  if (enq) {
    const live = await resolveEntity(enq.listingType, enq.listingId);
    listing = { title: live?.title ?? enq.titleSnapshot, href: live && live.status !== "removed" ? live.href : null, image: live?.image ?? enq.imageSnapshot, subtitle: live?.subtitle ?? null, available: !!live?.public };
  }
  const blocked = otherId ? await blockedBetween(userId, otherId) : false;
  return { other: other ?? null, enquiry: enq ?? null, listing, muted: participant.muted, blocked, isRecipient: enq?.recipientId === userId };
}

export async function toggleConversationMute(userId: string, conversationId: string) {
  const { participant } = await assertParticipant(userId, conversationId);
  const db = await useDb();
  await db.update(schema.conversationParticipants).set({ muted: !participant.muted }).where(and(eq(schema.conversationParticipants.conversationId, conversationId), eq(schema.conversationParticipants.userId, userId)));
  return !participant.muted;
}

/* ───────── contextual enquiries ───────── */
export async function startEnquiry(userId: string, input: { listingType: string; listingId: string; message?: string }): Promise<ActionResult<{ conversationId: string }>> {
  await requireFeature("messaging");
  if (!(await messagingEnabled())) return fail("Messaging is currently disabled.");
  if (!["product", "service", "trip", "company", "shop"].includes(input.listingType)) return fail("This item cannot be enquired about.");
  await enforceRateLimit("enquiry", 20, 3600, userId);
  const e = await resolveEntity(input.listingType, input.listingId);
  if (!e || !e.public) return fail("This listing is no longer available.");
  if (e.ownerId === userId) return fail("This is your own listing.");
  if (await blockedBetween(userId, e.ownerId)) return fail("You cannot contact this seller.");
  const db = await useDb();
  const key = `${input.listingType}:${input.listingId}`;
  const conv = await ensureConversation(userId, e.ownerId, key);
  const text = (input.message ?? "").trim().slice(0, 2000) || `Hi, I'm interested in "${e.title}". Is it still available?`;
  const [existing] = await db.select().from(schema.enquiries).where(and(eq(schema.enquiries.listingType, input.listingType), eq(schema.enquiries.listingId, input.listingId), eq(schema.enquiries.enquirerId, userId))).limit(1);
  if (!existing) {
    await db.insert(schema.enquiries).values({ listingType: input.listingType, listingId: input.listingId, titleSnapshot: e.title, imageSnapshot: e.image, enquirerId: userId, recipientId: e.ownerId, conversationId: conv.id }).onConflictDoNothing();
  } else if (existing.status === "closed") {
    await db.update(schema.enquiries).set({ status: "new", updatedAt: new Date() }).where(eq(schema.enquiries.id, existing.id));
  }
  const sent = await sendMessage(userId, conv.id, text);
  if (!sent.ok) return sent;
  await notify({ userId: e.ownerId, type: "enquiry", actorId: userId, title: `New enquiry: ${truncate(e.title, 60)}`, body: truncate(text, 100), link: `/messages/${conv.id}`, dedupeKey: `enq:${conv.id}:${Date.now() - (Date.now() % 3600000)}` });
  return ok({ conversationId: conv.id }, conv.created ? "Enquiry sent." : "Message added to your existing conversation.");
}

export async function setEnquiryStatus(userId: string, enquiryId: string, status: "new" | "responded" | "closed") {
  const db = await useDb();
  const r = await db.update(schema.enquiries).set({ status, updatedAt: new Date() }).where(and(eq(schema.enquiries.id, enquiryId), eq(schema.enquiries.recipientId, userId))).returning();
  if (!r.length) throw new AppError(404, "Enquiry not found.");
}

export async function listEnquiries(userId: string, role: "recipient" | "enquirer", status?: string, page = 1, pageSize = 20) {
  const db = await useDb();
  const col = role === "recipient" ? schema.enquiries.recipientId : schema.enquiries.enquirerId;
  const conds = [eq(col, userId)];
  if (status && ["new", "responded", "closed"].includes(status)) conds.push(eq(schema.enquiries.status, status));
  const otherCol = role === "recipient" ? schema.enquiries.enquirerId : schema.enquiries.recipientId;
  const rows = await db.select({ e: schema.enquiries, u: schema.users }).from(schema.enquiries).innerJoin(schema.users, eq(schema.users.id, otherCol)).where(and(...conds)).orderBy(desc(schema.enquiries.updatedAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
