import "server-only";
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { useDb, schema } from "../db";
import { AppError, ok, fail, isUuid, type ActionResult } from "../util";
import { getSettings } from "../settings";
import { requireFeature, isFeatureEnabled } from "../features";
import { enforceRateLimit } from "../ratelimit";
import { parseInput, optStr, optUrl } from "../validation";
import { notify } from "./notify";
import { fetchLinkPreview } from "../linkpreview";
import { formatMoney } from "@/lib/format";

/* ───────── view types ───────── */
export type MediaView = { id: string; url: string; thumbUrl: string | null; kind: string; mime: string; alt: string | null; width: number | null; height: number | null };
export type AuthorView = { id: string; username: string; displayName: string; avatarUrl: string | null; headline: string | null; verified: boolean };
export type PostView = {
  id: string; type: string; body: string; visibility: string; createdAt: string; editedAt: string | null; status: string;
  author: AuthorView;
  context: { kind: "company" | "shop" | "group"; name: string; href: string } | null;
  media: MediaView[];
  link: { url: string; title: string | null; description: string | null; image: string | null } | null;
  ref: { type: string; id: string; title: string; href: string; image: string | null; price: string | null } | null;
  shared: { id: string; body: string; author: AuthorView; createdAt: string; media: MediaView[] } | null;
  poll: { options: { label: string; votes: number }[]; total: number; myVote: number | null } | null;
  likeCount: number; commentCount: number; shareCount: number;
  liked: boolean; saved: boolean; commentsEnabled: boolean; mine: boolean;
  sponsored: { promotionId: string } | null;
};

/* ───────── visibility ───────── */
/** SQL predicate: posts the viewer is allowed to see (blocks, mutes, audience, groups, author state). */
export function postVisible(viewerId: string | null): SQL {
  const v = viewerId;
  const P = schema.posts;
  return sql`(
    ${P.status} = 'published' AND ${P.deletedAt} IS NULL
    AND EXISTS (SELECT 1 FROM users a WHERE a.id = ${P.authorId} AND a.status IN ('active','restricted') AND a.deleted_at IS NULL)
    AND (${P.visibility} = 'public'
      OR (${v}::uuid IS NOT NULL AND ${P.authorId} = ${v}::uuid)
      OR (${P.visibility} = 'connections' AND ${v}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM connections c WHERE c.status = 'accepted' AND ((c.requester_id = ${v}::uuid AND c.addressee_id = ${P.authorId}) OR (c.addressee_id = ${v}::uuid AND c.requester_id = ${P.authorId})))))
    AND (${v}::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${v}::uuid AND b.blocked_id = ${P.authorId}) OR (b.blocker_id = ${P.authorId} AND b.blocked_id = ${v}::uuid)))
    AND (${v}::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM mutes m WHERE m.user_id = ${v}::uuid AND m.muted_user_id = ${P.authorId}))
    AND (${P.groupId} IS NULL
      OR EXISTS (SELECT 1 FROM groups g WHERE g.id = ${P.groupId} AND g.visibility = 'public' AND g.status = 'active')
      OR (${v}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = ${P.groupId} AND gm.user_id = ${v}::uuid AND gm.status = 'active')))
  )`;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function mediaFor(postIds: string[]): Promise<Map<string, MediaView[]>> {
  const out = new Map<string, MediaView[]>();
  if (!postIds.length) return out;
  const db = await useDb();
  const rows = await db.select({ postId: schema.postMedia.postId, pos: schema.postMedia.position, m: schema.media })
    .from(schema.postMedia).innerJoin(schema.media, eq(schema.media.id, schema.postMedia.mediaId))
    .where(inArray(schema.postMedia.postId, postIds)).orderBy(schema.postMedia.position);
  for (const r of rows) {
    const list = out.get(r.postId) ?? [];
    list.push({ id: r.m.id, url: `/api/media/${r.m.id}`, thumbUrl: r.m.thumbPath ? `/api/media/${r.m.id}?thumb=1` : null, kind: r.m.kind, mime: r.m.mime, alt: r.m.alt, width: r.m.width, height: r.m.height });
    out.set(r.postId, list);
  }
  return out;
}

const authorView = (u: { id: string; username: string; displayName: string; avatarUrl: string | null; headline: string | null; verified: boolean }): AuthorView => ({
  id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, headline: u.headline, verified: u.verified,
});

export async function hydratePosts(rows: (typeof schema.posts.$inferSelect)[], viewerId: string | null): Promise<PostView[]> {
  if (!rows.length) return [];
  const db = await useDb();
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = await db.select().from(schema.users).where(inArray(schema.users.id, authorIds));
  const aMap = new Map(authors.map((a) => [a.id, a]));
  const media = await mediaFor(ids);
  const liked = new Set<string>();
  const saved = new Set<string>();
  const votes = new Map<string, number>();
  if (viewerId) {
    (await db.select({ id: schema.postReactions.postId }).from(schema.postReactions).where(and(eq(schema.postReactions.userId, viewerId), inArray(schema.postReactions.postId, ids)))).forEach((r) => liked.add(r.id));
    (await db.select({ id: schema.savedItems.entityId }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewerId), eq(schema.savedItems.entityType, "post"), inArray(schema.savedItems.entityId, ids)))).forEach((r) => saved.add(r.id));
    (await db.select().from(schema.pollVotes).where(and(eq(schema.pollVotes.userId, viewerId), inArray(schema.pollVotes.postId, ids)))).forEach((r) => votes.set(r.postId, r.optionIndex));
  }
  // poll tallies
  const pollIds = rows.filter((r) => r.pollOptions).map((r) => r.id);
  const tallies = new Map<string, number[]>();
  if (pollIds.length) {
    const t = await db.select({ postId: schema.pollVotes.postId, idx: schema.pollVotes.optionIndex, n: sql<number>`count(*)::int` }).from(schema.pollVotes).where(inArray(schema.pollVotes.postId, pollIds)).groupBy(schema.pollVotes.postId, schema.pollVotes.optionIndex);
    for (const r of t) { const a = tallies.get(r.postId) ?? []; a[r.idx] = r.n; tallies.set(r.postId, a); }
  }
  // referenced entities (trip / product / service)
  const refs = new Map<string, PostView["ref"]>();
  for (const type of ["trip", "product", "service"] as const) {
    const rid = rows.filter((r) => r.refType === type && r.refId).map((r) => r.refId!);
    if (!rid.length) continue;
    if (type === "trip") for (const t of await db.select().from(schema.trips).where(and(inArray(schema.trips.id, rid), eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public")))) refs.set(`trip:${t.id}`, { type, id: t.id, title: t.title, href: `/trips/${t.id}`, image: t.coverUrl, price: null });
    if (type === "product") for (const t of await db.select().from(schema.products).where(and(inArray(schema.products.id, rid), eq(schema.products.status, "active")))) refs.set(`product:${t.id}`, { type, id: t.id, title: t.title, href: `/products/${t.id}`, image: t.images[0] ?? null, price: t.price ? formatMoney(t.price, t.currency) : null });
    if (type === "service") for (const t of await db.select().from(schema.services).where(and(inArray(schema.services.id, rid), eq(schema.services.status, "active")))) refs.set(`service:${t.id}`, { type, id: t.id, title: t.title, href: `/services/${t.id}`, image: t.images[0] ?? null, price: t.startingPrice ? `From ${formatMoney(t.startingPrice, t.currency)}` : null });
  }
  // context labels
  const ctx = new Map<string, PostView["context"]>();
  const cIds = rows.filter((r) => r.companyId).map((r) => r.companyId!);
  const sIds = rows.filter((r) => r.shopId).map((r) => r.shopId!);
  const gIds = rows.filter((r) => r.groupId).map((r) => r.groupId!);
  if (cIds.length) for (const c of await db.select().from(schema.companies).where(inArray(schema.companies.id, cIds))) ctx.set(`c:${c.id}`, { kind: "company", name: c.name, href: `/companies/${c.slug}` });
  if (sIds.length) for (const c of await db.select().from(schema.shops).where(inArray(schema.shops.id, sIds))) ctx.set(`s:${c.id}`, { kind: "shop", name: c.name, href: `/shops/${c.slug}` });
  if (gIds.length) for (const c of await db.select().from(schema.groups).where(inArray(schema.groups.id, gIds))) ctx.set(`g:${c.id}`, { kind: "group", name: c.name, href: `/groups/${c.slug}` });
  // shared originals (only if still public and published)
  const sharedIds = rows.filter((r) => r.sharedPostId).map((r) => r.sharedPostId!);
  const shared = new Map<string, NonNullable<PostView["shared"]>>();
  if (sharedIds.length) {
    const originals = await db.select().from(schema.posts).where(and(inArray(schema.posts.id, sharedIds), eq(schema.posts.status, "published"), eq(schema.posts.visibility, "public"), isNull(schema.posts.deletedAt)));
    const oa = await db.select().from(schema.users).where(inArray(schema.users.id, originals.map((o) => o.authorId)));
    const om = await mediaFor(originals.map((o) => o.id));
    const oaMap = new Map(oa.map((a) => [a.id, a]));
    for (const o of originals) {
      const a = oaMap.get(o.authorId);
      if (a && a.status === "active") shared.set(o.id, { id: o.id, body: o.body, createdAt: o.createdAt.toISOString(), author: authorView(a), media: om.get(o.id) ?? [] });
    }
  }
  return rows.map((r) => {
    const a = aMap.get(r.authorId)!;
    const opts = r.pollOptions;
    const tally = tallies.get(r.id) ?? [];
    return {
      id: r.id, type: r.type, body: r.body, visibility: r.visibility, status: r.status, createdAt: r.createdAt.toISOString(), editedAt: iso(r.editedAt),
      author: authorView(a),
      context: (r.companyId && ctx.get(`c:${r.companyId}`)) || (r.shopId && ctx.get(`s:${r.shopId}`)) || (r.groupId && ctx.get(`g:${r.groupId}`)) || null,
      media: media.get(r.id) ?? [],
      link: r.linkUrl ? { url: r.linkUrl, title: r.linkTitle, description: r.linkDescription, image: r.linkImage } : null,
      ref: r.refType && r.refId ? refs.get(`${r.refType}:${r.refId}`) ?? null : null,
      shared: r.sharedPostId ? shared.get(r.sharedPostId) ?? null : null,
      poll: opts ? { options: opts.map((label, i) => ({ label, votes: tally[i] ?? 0 })), total: tally.reduce((s, n) => s + (n ?? 0), 0), myVote: votes.get(r.id) ?? null } : null,
      likeCount: r.likeCount, commentCount: r.commentCount, shareCount: r.shareCount,
      liked: liked.has(r.id), saved: saved.has(r.id), commentsEnabled: r.commentsEnabled, mine: viewerId === r.authorId, sponsored: null,
    } satisfies PostView;
  });
}

/* ───────── feed ───────── */
export type FeedTab = "all" | "following" | "discover" | "trips" | "listings";
export async function getFeed(viewerId: string | null, opts: { tab?: FeedTab; sort?: "recent" | "relevant"; cursor?: string | null; limit?: number; authorId?: string; groupId?: string; companyId?: string; shopId?: string }) {
  const db = await useDb();
  const P = schema.posts;
  const s = await getSettings(["feed.pageSize"]);
  const limit = opts.limit ?? Number(s["feed.pageSize"]);
  const tab = opts.tab ?? "all";
  const conds: SQL[] = [postVisible(viewerId)];
  if (opts.authorId) conds.push(eq(P.authorId, opts.authorId), isNull(P.groupId));
  if (opts.groupId) conds.push(eq(P.groupId, opts.groupId));
  if (opts.companyId) conds.push(eq(P.companyId, opts.companyId));
  if (opts.shopId) conds.push(eq(P.shopId, opts.shopId));
  if (!opts.groupId && !opts.authorId && !opts.companyId && !opts.shopId) conds.push(sql`(${P.groupId} IS NULL OR ${P.visibility} = 'public')`);
  const followed = viewerId
    ? sql`(${P.authorId} = ${viewerId}::uuid OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId}::uuid AND f.following_id = ${P.authorId}))`
    : sql`false`;
  if (tab === "following") conds.push(followed);
  if (tab === "discover") conds.push(sql`NOT ${followed}`);
  if (tab === "trips") conds.push(eq(P.type, "trip"));
  if (tab === "listings") conds.push(inArray(P.type, ["product", "service"]));
  const sort = opts.sort ?? "recent";
  let rows: (typeof schema.posts.$inferSelect)[];
  let nextCursor: string | null = null;
  if (sort === "recent") {
    if (opts.cursor) {
      const [ts, id] = opts.cursor.split("|");
      if (ts && isUuid(id) && !Number.isNaN(Date.parse(ts))) conds.push(or(lt(P.createdAt, new Date(ts)), and(eq(P.createdAt, new Date(ts)), lt(P.id, id)))!);
    }
    rows = await db.select().from(P).where(and(...conds)).orderBy(desc(P.createdAt), desc(P.id)).limit(limit + 1);
    if (rows.length > limit) { rows = rows.slice(0, limit); const last = rows[rows.length - 1]!; nextCursor = `${last.createdAt.toISOString()}|${last.id}`; }
  } else {
    const offset = Math.max(0, Number(opts.cursor ?? 0) || 0);
    const score = sql`((${P.likeCount} * 2 + ${P.commentCount} * 3 + ${P.shareCount} * 4 + CASE WHEN ${followed} THEN 10 ELSE 0 END + 1)::float / power(extract(epoch FROM (now() - ${P.createdAt})) / 3600.0 + 2, 1.3))`;
    rows = await db.select().from(P).where(and(...conds)).orderBy(desc(score), desc(P.createdAt)).limit(limit + 1).offset(offset);
    if (rows.length > limit) { rows = rows.slice(0, limit); nextCursor = String(offset + limit); }
  }
  return { items: await hydratePosts(rows, viewerId), nextCursor };
}

export async function getPostView(viewerId: string | null, id: string): Promise<PostView | null> {
  if (!isUuid(id)) return null;
  const db = await useDb();
  const [row] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, id), postVisible(viewerId))).limit(1);
  if (!row) return null;
  return (await hydratePosts([row], viewerId))[0] ?? null;
}

export async function getMyPosts(userId: string, status: "published" | "draft", page = 1, pageSize = 15) {
  const db = await useDb();
  const rows = await db.select().from(schema.posts).where(and(eq(schema.posts.authorId, userId), eq(schema.posts.status, status), isNull(schema.posts.deletedAt))).orderBy(desc(schema.posts.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize);
  return { items: await hydratePosts(rows.slice(0, pageSize), userId), hasMore: rows.length > pageSize };
}

/* ───────── create / edit / delete ───────── */
const createSchema = z.object({
  body: z.string().max(20000).default(""),
  visibility: z.enum(["public", "connections", "private"]).default("public"),
  status: z.enum(["published", "draft"]).default("published"),
  mediaIds: z.array(z.string().uuid()).max(20).default([]),
  linkUrl: optUrl,
  pollOptions: z.array(z.string().trim().min(1).max(80)).min(2).max(6).optional(),
  refType: z.enum(["trip", "product", "service"]).optional(),
  refId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  commentsEnabled: z.boolean().optional(),
  alt: optStr(300),
});
export type CreatePostInput = z.input<typeof createSchema>;

async function assertCanPostAs(userId: string, d: z.infer<typeof createSchema>) {
  const db = await useDb();
  if (d.companyId) {
    const [m] = await db.select().from(schema.companyMembers).where(and(eq(schema.companyMembers.companyId, d.companyId), eq(schema.companyMembers.userId, userId))).limit(1);
    if (!m || m.role === "viewer") throw new AppError(403, "You cannot post for that company.");
  }
  if (d.shopId) {
    const [m] = await db.select().from(schema.shopMembers).where(and(eq(schema.shopMembers.shopId, d.shopId), eq(schema.shopMembers.userId, userId))).limit(1);
    if (!m || m.role === "viewer") throw new AppError(403, "You cannot post for that shop.");
  }
  if (d.groupId) {
    await requireFeature("groups");
    const [m] = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, d.groupId), eq(schema.groupMembers.userId, userId), eq(schema.groupMembers.status, "active"))).limit(1);
    if (!m) throw new AppError(403, "Join the group to post in it.");
  }
  if (d.refType && d.refId) {
    const tbl = d.refType === "trip" ? schema.trips : d.refType === "product" ? schema.products : schema.services;
    const col = d.refType === "trip" ? schema.trips.ownerId : d.refType === "product" ? schema.products.sellerId : schema.services.providerId;
    const [r] = await db.select({ id: tbl.id }).from(tbl).where(and(eq(tbl.id, d.refId), eq(col, userId))).limit(1);
    if (!r) throw new AppError(403, "You can only promote your own listings.");
  }
}

export async function createPost(userId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireFeature("posts");
  const s = await getSettings();
  await enforceRateLimit("post", Number(s["posts.rateLimitPerHour"]), 3600, userId);
  const p = parseInput(createSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  const body = d.body.trim();
  if (body.length > Number(s["posts.maxLength"])) return fail(`Posts are limited to ${s["posts.maxLength"]} characters.`, { body: "Too long." });
  if (d.mediaIds.length > Math.min(Number(s["posts.maxMediaPerPost"]), Number(s["upload.maxFilesPerPost"]))) return fail("Too many attachments.");
  if (d.pollOptions) {
    if (!(await isFeatureEnabled("polls")) || !s["posts.allowPolls"]) return fail("Polls are disabled.");
  }
  if (!body && !d.mediaIds.length && !d.linkUrl && !d.pollOptions && !d.refId) return fail("Write something or attach media first.", { body: "Required" });
  await assertCanPostAs(userId, d);
  const db = await useDb();
  let mediaRows: (typeof schema.media.$inferSelect)[] = [];
  if (d.mediaIds.length) {
    mediaRows = await db.select().from(schema.media).where(and(inArray(schema.media.id, d.mediaIds), eq(schema.media.ownerId, userId)));
    if (mediaRows.length !== d.mediaIds.length) return fail("One of the attachments is not available.");
  }
  let link: Awaited<ReturnType<typeof fetchLinkPreview>> | null = null;
  if (d.linkUrl) { try { link = await fetchLinkPreview(d.linkUrl); } catch { link = { url: d.linkUrl, title: "", description: "", image: "" }; } }
  const kinds = new Set(mediaRows.map((m) => m.kind));
  const type = d.pollOptions ? "poll" : d.refType ?? (d.companyId || d.shopId ? "announcement" : kinds.has("video") ? "video" : kinds.has("image") ? "image" : kinds.has("document") ? "document" : link ? "link" : "text");
  const [post] = await db.transaction(async (tx) => {
    const r = await tx.insert(schema.posts).values({
      authorId: userId, body, type, visibility: d.groupId ? "public" : d.visibility, status: d.status,
      commentsEnabled: d.commentsEnabled ?? Boolean(s["posts.commentsEnabledByDefault"]),
      linkUrl: link?.url ?? null, linkTitle: link?.title || null, linkDescription: link?.description || null, linkImage: link?.image || null,
      refType: d.refType ?? null, refId: d.refId ?? null, companyId: d.companyId ?? null, shopId: d.shopId ?? null, groupId: d.groupId ?? null,
      pollOptions: d.pollOptions ?? null,
    }).returning({ id: schema.posts.id });
    if (mediaRows.length) {
      await tx.insert(schema.postMedia).values(d.mediaIds.map((mid, i) => ({ postId: r[0]!.id, mediaId: mid, position: i })));
      if (d.alt) await tx.update(schema.media).set({ alt: d.alt }).where(inArray(schema.media.id, d.mediaIds));
    }
    return r;
  });
  if (d.status === "published") await notifyMentions(userId, body, `/posts/${post!.id}`, `mention:post:${post!.id}`);
  return ok({ id: post!.id }, d.status === "draft" ? "Draft saved." : "Posted.");
}

export async function notifyMentions(actorId: string, text: string, link: string, dedupe: string) {
  const names = [...new Set([...text.matchAll(/(?:^|\s)@([a-z0-9_]{3,30})/gi)].map((m) => m[1]!.toLowerCase()))].slice(0, 5);
  if (!names.length) return;
  const db = await useDb();
  const users = await db.select({ id: schema.users.id }).from(schema.users).where(inArray(schema.users.username, names));
  for (const u of users) await notify({ userId: u.id, type: "mention", actorId, title: "You were mentioned", body: text.slice(0, 120), link, dedupeKey: `${dedupe}:${u.id}` });
}

export async function updatePost(userId: string, postId: string, input: { body: string; visibility?: string; commentsEnabled?: boolean; publish?: boolean }): Promise<ActionResult> {
  const s = await getSettings();
  const db = await useDb();
  const [post] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), eq(schema.posts.authorId, userId), isNull(schema.posts.deletedAt))).limit(1);
  if (!post || post.status === "removed") throw new AppError(404, "Post not found.");
  const body = input.body.trim();
  if (body.length > Number(s["posts.maxLength"])) return fail(`Posts are limited to ${s["posts.maxLength"]} characters.`);
  if (!body && post.type === "text") return fail("A text post cannot be empty.");
  const vis = ["public", "connections", "private"].includes(input.visibility ?? "") ? input.visibility! : post.visibility;
  await db.update(schema.posts).set({
    body, visibility: post.groupId ? "public" : vis, commentsEnabled: input.commentsEnabled ?? post.commentsEnabled,
    status: input.publish && post.status === "draft" ? "published" : post.status, editedAt: post.status === "published" ? new Date() : post.editedAt, updatedAt: new Date(),
  }).where(eq(schema.posts.id, postId));
  return ok(undefined, "Post updated.");
}

export async function deletePost(actor: { id: string }, postId: string, asModerator = false) {
  const db = await useDb();
  const cond = asModerator ? eq(schema.posts.id, postId) : and(eq(schema.posts.id, postId), eq(schema.posts.authorId, actor.id));
  const r = await db.update(schema.posts).set({ deletedAt: new Date(), status: "removed", updatedAt: new Date() }).where(cond!).returning({ id: schema.posts.id });
  if (!r.length) throw new AppError(404, "Post not found.");
}

/* ───────── reactions / comments / saves / shares / polls ───────── */
async function assertVisible(viewerId: string, postId: string) {
  const db = await useDb();
  const [p] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, postId), postVisible(viewerId))).limit(1);
  if (!p) throw new AppError(404, "Post not found.");
  return p;
}

export async function toggleLike(userId: string, postId: string) {
  await requireFeature("reactions");
  await enforceRateLimit("react", 120, 600, userId);
  const post = await assertVisible(userId, postId);
  const db = await useDb();
  const res = await db.transaction(async (tx) => {
    const ins = await tx.insert(schema.postReactions).values({ postId, userId }).onConflictDoNothing().returning();
    let liked = true;
    if (ins.length) await tx.update(schema.posts).set({ likeCount: sql`${schema.posts.likeCount} + 1` }).where(eq(schema.posts.id, postId));
    else {
      const del = await tx.delete(schema.postReactions).where(and(eq(schema.postReactions.postId, postId), eq(schema.postReactions.userId, userId))).returning();
      if (del.length) await tx.update(schema.posts).set({ likeCount: sql`greatest(${schema.posts.likeCount} - 1, 0)` }).where(eq(schema.posts.id, postId));
      liked = false;
    }
    const [{ n }] = await tx.select({ n: schema.posts.likeCount }).from(schema.posts).where(eq(schema.posts.id, postId)).then((r) => r.map((x) => ({ n: x.n })));
    return { liked, likeCount: n!, fresh: ins.length > 0 };
  });
  if (res.liked && res.fresh) await notify({ userId: post.authorId, type: "reaction", actorId: userId, title: "Someone liked your post", body: post.body.slice(0, 100), link: `/posts/${postId}`, dedupeKey: `like:${postId}:${userId}` });
  return { liked: res.liked, likeCount: res.likeCount };
}

export async function listComments(viewerId: string | null, postId: string, cursor?: string | null, limit = 30) {
  const db = await useDb();
  const conds = [eq(schema.comments.postId, postId), eq(schema.comments.status, "published")];
  if (cursor) conds.push(sql`${schema.comments.createdAt} > ${new Date(cursor)}`);
  const rows = await db.select({ c: schema.comments, u: schema.users }).from(schema.comments).innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
    .where(and(...conds, sql`${schema.users.status} in ('active','restricted')`, viewerId ? sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewerId}::uuid and b.blocked_id = ${schema.comments.authorId}) or (b.blocker_id = ${schema.comments.authorId} and b.blocked_id = ${viewerId}::uuid))` : sql`true`))
    .orderBy(schema.comments.createdAt).limit(limit + 1);
  const items = rows.slice(0, limit).map(({ c, u }) => ({
    id: c.id, parentId: c.parentId, body: c.body, createdAt: c.createdAt.toISOString(), edited: !!c.editedAt,
    author: authorView(u), mine: viewerId === c.authorId,
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.createdAt : null };
}

export async function addComment(userId: string, postId: string, bodyRaw: string, parentId?: string | null): Promise<ActionResult<{ id: string }>> {
  await requireFeature("comments");
  await enforceRateLimit("comment", 40, 600, userId);
  const s = await getSettings(["posts.maxCommentLength"]);
  const body = bodyRaw.trim();
  if (!body) return fail("Write a comment first.");
  if (body.length > Number(s["posts.maxCommentLength"])) return fail(`Comments are limited to ${s["posts.maxCommentLength"]} characters.`);
  const post = await assertVisible(userId, postId);
  if (!post.commentsEnabled) return fail("Comments are turned off for this post.");
  const db = await useDb();
  let parentAuthor: string | null = null;
  if (parentId) {
    const [par] = await db.select().from(schema.comments).where(and(eq(schema.comments.id, parentId), eq(schema.comments.postId, postId), eq(schema.comments.status, "published"))).limit(1);
    if (!par) return fail("The comment you are replying to is gone.");
    parentAuthor = par.authorId;
  }
  const c = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.comments).values({ postId, authorId: userId, body, parentId: parentId ?? null }).returning({ id: schema.comments.id });
    await tx.update(schema.posts).set({ commentCount: sql`${schema.posts.commentCount} + 1` }).where(eq(schema.posts.id, postId));
    return row!;
  });
  await notify({ userId: post.authorId, type: "comment", actorId: userId, title: "New comment on your post", body: body.slice(0, 100), link: `/posts/${postId}`, dedupeKey: `comment:${c.id}` });
  if (parentAuthor && parentAuthor !== post.authorId) await notify({ userId: parentAuthor, type: "comment", actorId: userId, title: "Someone replied to your comment", body: body.slice(0, 100), link: `/posts/${postId}`, dedupeKey: `reply:${c.id}` });
  await notifyMentions(userId, body, `/posts/${postId}`, `mention:comment:${c.id}`);
  return ok({ id: c.id });
}

export async function editComment(userId: string, commentId: string, bodyRaw: string): Promise<ActionResult> {
  const body = bodyRaw.trim();
  if (!body) return fail("Comment cannot be empty.");
  const s = await getSettings(["posts.maxCommentLength"]);
  if (body.length > Number(s["posts.maxCommentLength"])) return fail("Comment is too long.");
  const db = await useDb();
  const r = await db.update(schema.comments).set({ body, editedAt: new Date() }).where(and(eq(schema.comments.id, commentId), eq(schema.comments.authorId, userId), eq(schema.comments.status, "published"))).returning();
  if (!r.length) throw new AppError(404, "Comment not found.");
  return ok();
}

export async function deleteComment(userId: string, commentId: string, asModerator = false) {
  const db = await useDb();
  const [c] = await db.select().from(schema.comments).where(and(eq(schema.comments.id, commentId), eq(schema.comments.status, "published"))).limit(1);
  if (!c) throw new AppError(404, "Comment not found.");
  const [post] = await db.select({ a: schema.posts.authorId }).from(schema.posts).where(eq(schema.posts.id, c.postId));
  if (!asModerator && c.authorId !== userId && post?.a !== userId) throw new AppError(403, "You cannot delete this comment.");
  await db.transaction(async (tx) => {
    await tx.update(schema.comments).set({ status: "removed" }).where(eq(schema.comments.id, commentId));
    await tx.update(schema.posts).set({ commentCount: sql`greatest(${schema.posts.commentCount} - 1, 0)` }).where(eq(schema.posts.id, c.postId));
  });
}

const SAVEABLE = ["post", "trip", "product", "service", "company", "shop", "group"] as const;
export async function toggleSave(userId: string, entityType: string, entityId: string) {
  await requireFeature("saved");
  if (!(SAVEABLE as readonly string[]).includes(entityType) || !isUuid(entityId)) throw new AppError(400, "Invalid item.");
  const db = await useDb();
  const del = await db.delete(schema.savedItems).where(and(eq(schema.savedItems.userId, userId), eq(schema.savedItems.entityType, entityType), eq(schema.savedItems.entityId, entityId))).returning();
  if (del.length) return { saved: false };
  if (entityType === "post") await assertVisible(userId, entityId);
  await db.insert(schema.savedItems).values({ userId, entityType, entityId }).onConflictDoNothing();
  return { saved: true };
}

export async function sharePost(userId: string, postId: string, comment: string): Promise<ActionResult<{ id: string }>> {
  await requireFeature("posts");
  await enforceRateLimit("share", 30, 3600, userId);
  const orig = await assertVisible(userId, postId);
  if (orig.visibility !== "public" || orig.groupId) return fail("Only public posts can be shared.");
  const db = await useDb();
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.posts).values({ authorId: userId, body: comment.trim().slice(0, 1000), type: "text", sharedPostId: orig.id, visibility: "public" }).returning({ id: schema.posts.id });
    await tx.update(schema.posts).set({ shareCount: sql`${schema.posts.shareCount} + 1` }).where(eq(schema.posts.id, orig.id));
    return row!.id;
  });
  await notify({ userId: orig.authorId, type: "reaction", actorId: userId, title: "Someone shared your post", link: `/posts/${id}`, dedupeKey: `share:${orig.id}:${userId}` });
  return ok({ id }, "Shared to your profile.");
}

export async function votePoll(userId: string, postId: string, optionIndex: number) {
  const post = await assertVisible(userId, postId);
  if (!post.pollOptions || optionIndex < 0 || optionIndex >= post.pollOptions.length) throw new AppError(400, "Invalid poll option.");
  const db = await useDb();
  await db.insert(schema.pollVotes).values({ postId, userId, optionIndex }).onConflictDoNothing();
}

/* ───────── reports ───────── */
export const REPORT_REASONS = ["Spam or scam", "Harassment or hate", "Nudity or sexual content", "Violence or dangerous", "Misleading or fake", "Illegal goods or services", "Intellectual property", "Other"] as const;
const SEVERITY: Record<string, string> = { "Violence or dangerous": "high", "Nudity or sexual content": "high", "Illegal goods or services": "high", "Harassment or hate": "high", "Spam or scam": "medium", "Misleading or fake": "medium", "Intellectual property": "medium", Other: "low" };
const REPORTABLE = ["user", "post", "comment", "product", "service", "trip", "company", "shop", "group", "message", "promotion"];

export async function reportEntity(reporterId: string, entityType: string, entityId: string, reason: string, details?: string): Promise<ActionResult> {
  if (!REPORTABLE.includes(entityType) || !isUuid(entityId)) return fail("Invalid report target.");
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return fail("Choose a reason.");
  await enforceRateLimit("report", 20, 3600, reporterId);
  const db = await useDb();
  const [dup] = await db.select().from(schema.reports).where(and(eq(schema.reports.reporterId, reporterId), eq(schema.reports.entityType, entityType), eq(schema.reports.entityId, entityId), inArray(schema.reports.status, ["open", "reviewing"]))).limit(1);
  if (dup) return ok(undefined, "You have already reported this. Our team is reviewing it.");
  await db.insert(schema.reports).values({ reporterId, entityType, entityId, reason, details: details?.slice(0, 1000) || null, severity: SEVERITY[reason] ?? "medium" });
  return ok(undefined, "Thanks. Our moderators will review this report.");
}
