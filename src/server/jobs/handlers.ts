import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq, lt, sql, isNotNull } from "drizzle-orm";
import { useDb, schema } from "../db";
import { getSetting } from "../settings";
import { UPLOAD_ROOT } from "../storage";

export type JobResult = { summary: string };
const days = (n: number) => new Date(Date.now() - n * 86400_000);

export const HANDLERS: Record<string, () => Promise<JobResult>> = {
  async reconcile_counters() {
    const db = await useDb();
    await db.execute(sql`UPDATE posts p SET
      like_count = (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id),
      comment_count = (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'published'),
      share_count = (SELECT count(*)::int FROM posts s WHERE s.shared_post_id = p.id AND s.status = 'published' AND s.deleted_at IS NULL)`);
    return { summary: "Engagement counters recomputed from source rows." };
  },
  async cleanup_auth() {
    const db = await useDb();
    const s = await db.delete(schema.sessions).where(sql`${schema.sessions.expiresAt} < now() - interval '7 days' OR ${schema.sessions.revokedAt} < now() - interval '30 days'`).returning({ id: schema.sessions.id });
    const t = await db.delete(schema.verificationTokens).where(sql`${schema.verificationTokens.expiresAt} < now() - interval '1 day' OR ${schema.verificationTokens.usedAt} < now() - interval '1 day'`).returning({ id: schema.verificationTokens.id });
    return { summary: `Removed ${s.length} sessions and ${t.length} tokens.` };
  },
  async log_retention() {
    const db = await useDb();
    const a = await db.delete(schema.systemLogs).where(lt(schema.systemLogs.createdAt, days(30))).returning({ id: schema.systemLogs.id });
    const b = await db.delete(schema.securityEvents).where(lt(schema.securityEvents.createdAt, days(180))).returning({ id: schema.securityEvents.id });
    const c = await db.delete(schema.auditLogs).where(lt(schema.auditLogs.createdAt, days(730))).returning({ id: schema.auditLogs.id });
    const d = await db.delete(schema.emailLog).where(lt(schema.emailLog.createdAt, days(90))).returning({ id: schema.emailLog.id });
    return { summary: `Removed ${a.length} system logs, ${b.length} security events, ${c.length} audit logs, ${d.length} delivery logs.` };
  },
  async expire_promotions() {
    const db = await useDb();
    const r = await db.update(schema.promotions).set({ status: "ended" }).where(and(isNotNull(schema.promotions.endsAt), lt(schema.promotions.endsAt, new Date()), sql`${schema.promotions.status} in ('active','paused')`)).returning({ id: schema.promotions.id });
    return { summary: `Ended ${r.length} promotions.` };
  },
  async complete_trips() {
    const db = await useDb();
    const today = new Date().toISOString().slice(0, 10);
    const r = await db.update(schema.trips).set({ status: "completed" }).where(and(eq(schema.trips.status, "published"), isNotNull(schema.trips.endDate), lt(schema.trips.endDate, today))).returning({ id: schema.trips.id });
    return { summary: `Completed ${r.length} past trips.` };
  },
  async message_retention() {
    const keep = await getSetting<number>("chat.retentionDays");
    if (!keep) return { summary: "Retention is set to keep messages forever. Nothing to do." };
    const db = await useDb();
    const r = await db.delete(schema.messages).where(lt(schema.messages.createdAt, days(keep))).returning({ id: schema.messages.id });
    return { summary: `Deleted ${r.length} messages older than ${keep} days.` };
  },
  async draft_cleanup() {
    const keep = await getSetting<number>("posts.draftRetentionDays");
    const db = await useDb();
    const r = await db.delete(schema.posts).where(and(eq(schema.posts.status, "draft"), lt(schema.posts.updatedAt, days(keep)))).returning({ id: schema.posts.id });
    return { summary: `Deleted ${r.length} drafts older than ${keep} days.` };
  },
  async process_deletions() {
    const db = await useDb();
    const due = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.type, "deletion"), eq(schema.dataRequests.status, "pending"), lt(schema.dataRequests.createdAt, days(7))));
    for (const d of due) {
      const tag = d.userId.slice(0, 8);
      await db.transaction(async (tx) => {
        await tx.update(schema.users).set({ email: `deleted+${tag}@deleted.invalid`, username: `deleted_${tag}`, displayName: "Deleted user", headline: null, bio: null, avatarUrl: null, coverUrl: null, website: null, phone: null, contactEmail: null, contactPhone: null, locationLabel: null, geoCell: null, passwordHash: null, mfaSecret: null, mfaEnabled: false, skills: [], status: "banned", statusReason: "Account deleted by user", deletedAt: new Date() }).where(eq(schema.users.id, d.userId));
        await tx.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.userId, d.userId));
        await tx.delete(schema.authAccounts).where(eq(schema.authAccounts.userId, d.userId));
        await tx.update(schema.posts).set({ status: "removed", deletedAt: new Date() }).where(eq(schema.posts.authorId, d.userId));
        await tx.update(schema.dataRequests).set({ status: "done", processedAt: new Date() }).where(eq(schema.dataRequests.id, d.id));
      });
    }
    return { summary: `Processed ${due.length} deletion requests.` };
  },
  async media_orphans() {
    const db = await useDb();
    const rows = await db.select({ id: schema.media.id, p: schema.media.path }).from(schema.media).limit(5000);
    let missing = 0;
    for (const r of rows) { if (r.p.startsWith("r2:")) continue; try { await fs.access(path.join(UPLOAD_ROOT, r.p)); } catch { missing++; } }
    return { summary: `${missing} of ${rows.length} media rows reference a missing file.` };
  },
};
