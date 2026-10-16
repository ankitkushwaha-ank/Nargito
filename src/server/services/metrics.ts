import "server-only";
import { sql } from "drizzle-orm";
import { useDb, rowsOf } from "../db";
import { getSetting } from "../settings";

export type Metric = { key: string; label: string; value: number | null; previous?: number | null; kind: "actual" | "unavailable" | "estimated"; note?: string; href?: string; format?: "number" | "bytes" | "percent" };

export const RANGES = [7, 30, 90] as const;

async function one<T extends Record<string, number | string | null>>(q: ReturnType<typeof sql>): Promise<T> {
  const db = await useDb();
  return rowsOf<T>(await db.execute(q))[0] as T;
}

/** All figures come straight from database rows. Anything that cannot be measured is marked "unavailable" rather than invented. */
export async function getDashboard(days: number) {
  const d = Math.max(1, Math.min(365, Math.trunc(days)));
  const cur = sql`now() - make_interval(days => ${d})`;
  const prev = sql`now() - make_interval(days => ${d * 2})`;
  const presence = await getSetting<boolean>("chat.presenceEnabled");
  const r = await one<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS users_total,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND created_at >= ${cur}) AS users_new,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND created_at >= ${prev} AND created_at < ${cur}) AS users_new_prev,
      (SELECT count(*)::int FROM users WHERE last_seen_at >= ${cur}) AS users_active,
      (SELECT count(*)::int FROM users WHERE last_seen_at >= ${prev} AND last_seen_at < ${cur}) AS users_active_prev,
      (SELECT count(*)::int FROM users WHERE verified = true) AS users_verified,
      (SELECT count(*)::int FROM users WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL) AS users_email_verified,
      (SELECT count(*)::int FROM users WHERE last_seen_at >= now() - interval '5 minutes') AS users_online,
      (SELECT count(*)::int FROM users WHERE status IN ('suspended','banned','restricted') AND deleted_at IS NULL) AS users_suspended,
      (SELECT count(*)::int FROM posts WHERE status = 'published' AND created_at >= ${cur}) AS posts,
      (SELECT count(*)::int FROM posts WHERE status = 'published' AND created_at >= ${prev} AND created_at < ${cur}) AS posts_prev,
      (SELECT count(*)::int FROM trips WHERE status <> 'draft' AND created_at >= ${cur}) AS trips,
      (SELECT count(*)::int FROM trips WHERE status <> 'draft' AND created_at >= ${prev} AND created_at < ${cur}) AS trips_prev,
      (SELECT count(*)::int FROM products WHERE created_at >= ${cur}) + (SELECT count(*)::int FROM services WHERE created_at >= ${cur}) AS listings,
      (SELECT count(*)::int FROM products WHERE created_at >= ${prev} AND created_at < ${cur}) + (SELECT count(*)::int FROM services WHERE created_at >= ${prev} AND created_at < ${cur}) AS listings_prev,
      (SELECT count(*)::int FROM companies WHERE created_at >= ${cur}) + (SELECT count(*)::int FROM shops WHERE created_at >= ${cur}) AS businesses,
      (SELECT count(*)::int FROM companies WHERE created_at >= ${prev} AND created_at < ${cur}) + (SELECT count(*)::int FROM shops WHERE created_at >= ${prev} AND created_at < ${cur}) AS businesses_prev,
      (SELECT count(*)::int FROM messages WHERE created_at >= ${cur}) AS messages,
      (SELECT count(*)::int FROM messages WHERE created_at >= ${prev} AND created_at < ${cur}) AS messages_prev,
      (SELECT count(*)::int FROM enquiries WHERE created_at >= ${cur}) AS enquiries,
      (SELECT count(*)::int FROM enquiries WHERE created_at >= ${prev} AND created_at < ${cur}) AS enquiries_prev,
      (SELECT count(*)::int FROM post_reactions WHERE created_at >= ${cur}) + (SELECT count(*)::int FROM comments WHERE created_at >= ${cur}) AS engagement,
      (SELECT count(*)::int FROM post_reactions WHERE created_at >= ${prev} AND created_at < ${cur}) + (SELECT count(*)::int FROM comments WHERE created_at >= ${prev} AND created_at < ${cur}) AS engagement_prev,
      (SELECT count(*)::int FROM reports WHERE status IN ('open','reviewing','appealed')) AS reports_open,
      (SELECT count(*)::int FROM verification_requests WHERE status IN ('pending','more_info')) AS verification_pending,
      (SELECT count(*)::int FROM promotions WHERE status = 'active') AS promos_active,
      (SELECT count(*)::int FROM promotions WHERE status = 'pending') AS promos_pending,
      (SELECT count(*)::int FROM promotion_events WHERE type = 'impression' AND created_at >= ${cur}) AS impressions,
      (SELECT count(*)::int FROM promotion_events WHERE type = 'click' AND created_at >= ${cur}) AS clicks,
      (SELECT coalesce(sum(size),0)::bigint FROM media)::float8 AS storage_bytes,
      (SELECT count(*)::int FROM media WHERE status = 'failed' AND created_at >= ${cur}) AS upload_failures,
      (SELECT count(*)::int FROM system_logs WHERE level = 'error' AND category = 'api' AND created_at >= ${cur}) AS api_errors,
      (SELECT count(*)::int FROM scheduled_jobs WHERE enabled AND last_status = 'failed') AS jobs_failed,
      (SELECT count(*)::int FROM scheduled_jobs WHERE enabled) AS jobs_total,
      (SELECT count(*)::int FROM email_log WHERE status = 'sent' AND created_at >= ${cur}) AS mail_sent,
      (SELECT count(*)::int FROM email_log WHERE status = 'failed' AND created_at >= ${cur}) AS mail_failed,
      (SELECT count(*)::int FROM email_log WHERE status = 'skipped' AND created_at >= ${cur}) AS mail_skipped,
      (SELECT count(*)::int FROM subscriptions WHERE status = 'active') AS pro_active,
      (SELECT coalesce(sum(amount_cents),0)::bigint FROM payments WHERE status IN ('succeeded','partially_refunded') AND created_at >= ${cur})::float8 AS revenue_cents,
      (SELECT count(*)::int FROM payments) AS payments_total`);
  const m = (key: string, label: string, value: number | null, extra: Partial<Metric> = {}): Metric => ({ key, label, value, kind: value === null ? "unavailable" : "actual", ...extra });
  const metrics: Metric[] = [
    m("users_total", "Registered users", r.users_total!, { href: "/admin/users" }),
    m("users_new", "New registrations", r.users_new!, { previous: r.users_new_prev }),
    m("users_active", "Active users", r.users_active!, { previous: r.users_active_prev, note: "Users seen in the period (last-seen heartbeat)" }),
    m("users_verified", "Verified users", r.users_verified!, { href: "/admin/verification", note: `${r.users_email_verified} have a verified email` }),
    m("users_online", "Online now", presence ? r.users_online! : null, { href: "/admin/users/online", note: presence ? "Seen in the last 5 minutes" : "Presence is turned off in Chat settings" }),
    m("posts", "Posts published", r.posts!, { previous: r.posts_prev, href: "/admin/content/posts" }),
    m("trips", "Trips published", r.trips!, { previous: r.trips_prev, href: "/admin/content/trips" }),
    m("listings", "Products & services listed", r.listings!, { previous: r.listings_prev, href: "/admin/content/products" }),
    m("businesses", "Companies & shops created", r.businesses!, { previous: r.businesses_prev, href: "/admin/content/companies" }),
    m("messages", "Messages sent", r.messages!, { previous: r.messages_prev }),
    m("enquiries", "Listing enquiries", r.enquiries!, { previous: r.enquiries_prev }),
    m("engagement", "Likes & comments", r.engagement!, { previous: r.engagement_prev }),
    m("reports_open", "Open reports", r.reports_open!, { href: "/admin/reports", note: "Moderation backlog (all time)" }),
    m("users_suspended", "Restricted / suspended accounts", r.users_suspended!, { href: "/admin/users?status=suspended" }),
    m("verification_pending", "Pending verification requests", r.verification_pending!, { href: "/admin/verification" }),
    m("promos", "Active promotions", r.promos_active!, { href: "/admin/promotions", note: `${r.promos_pending} awaiting approval` }),
    m("impressions", "Promotion impressions", r.impressions!, { note: "Recorded events, de-duplicated per viewer per day" }),
    m("clicks", "Promotion clicks", r.clicks!, { note: r.impressions ? `${((r.clicks! / r.impressions!) * 100).toFixed(1)}% CTR (calculated)` : undefined }),
    m("storage", "Media storage used", r.storage_bytes!, { format: "bytes", note: "Sum of stored media sizes" }),
    m("upload_failures", "Upload / processing failures", r.upload_failures!),
    m("api_errors", "API errors logged", r.api_errors!, { href: "/admin/logs?level=error", note: "Count only. A rate is unavailable because successful requests are sampled, not counted." }),
    m("jobs_failed", "Failed scheduled jobs", r.jobs_failed!, { href: "/admin/cron", note: `${r.jobs_total} jobs enabled` }),
    m("mail_sent", "Emails sent", r.mail_sent!, { note: `${r.mail_failed} failed, ${r.mail_skipped} skipped (no provider)` }),
    m("pro_active", "Active Pro memberships", r.pro_active!, { href: "/admin/pro/members" }),
    m("revenue", "Revenue (confirmed payments)", r.payments_total! > 0 ? r.revenue_cents! / 100 : null, { note: r.payments_total! > 0 ? "From payment-provider webhooks only" : "No payment records exist" }),
  ];
  const growth = rowsOf<{ day: string; n: number }>(await (await useDb()).execute(sql`
    SELECT to_char(g.d, 'YYYY-MM-DD') AS day, count(u.id)::int AS n FROM generate_series((now() - make_interval(days => ${d - 1}))::date, now()::date, '1 day') g(d)
    LEFT JOIN users u ON u.created_at::date = g.d::date AND u.deleted_at IS NULL GROUP BY g.d ORDER BY g.d`));
  const postsSeries = rowsOf<{ day: string; n: number }>(await (await useDb()).execute(sql`
    SELECT to_char(g.d, 'YYYY-MM-DD') AS day, count(p.id)::int AS n FROM generate_series((now() - make_interval(days => ${d - 1}))::date, now()::date, '1 day') g(d)
    LEFT JOIN posts p ON p.created_at::date = g.d::date AND p.status = 'published' GROUP BY g.d ORDER BY g.d`));
  return { metrics, growth, postsSeries, days: d };
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
