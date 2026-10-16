import Link from "next/link";
import { sql } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, rowsOf } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { RANGES, getDashboard } from "@/server/services/metrics";
import { cn } from "@/lib/cn";
import { GrowthChart, PostsChart } from "./chart";

export const metadata = { title: "Analytics" };

export default async function Analytics({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("analytics.read");
  const sp = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;
  const db = await useDb();
  const since = sql`now() - make_interval(days => ${days})`;
  const [adopt] = rowsOf<Record<string, number>>(await db.execute(sql`select
    (select count(*)::int from users where deleted_at is null and status='active') as base,
    (select count(distinct author_id)::int from posts where created_at >= ${since}) as posting,
    (select count(distinct author_id)::int from comments where created_at >= ${since}) as commenting,
    (select count(distinct user_id)::int from post_reactions where created_at >= ${since}) as reacting,
    (select count(distinct owner_id)::int from trips where created_at >= ${since}) as trips,
    (select count(distinct u)::int from (select seller_id u from products where created_at >= ${since} union select provider_id from services where created_at >= ${since}) x) as listing,
    (select count(distinct sender_id)::int from messages where created_at >= ${since}) as messaging,
    (select count(distinct enquirer_id)::int from enquiries where created_at >= ${since}) as enquiring,
    (select count(distinct user_id)::int from saved_items where created_at >= ${since}) as saving,
    (select count(distinct follower_id)::int from follows where created_at >= ${since}) as following`));
  const rows: [string, number][] = [["Posted", adopt!.posting!], ["Commented", adopt!.commenting!], ["Liked posts", adopt!.reacting!], ["Published a trip", adopt!.trips!], ["Created a listing", adopt!.listing!], ["Sent a message", adopt!.messaging!], ["Sent an enquiry", adopt!.enquiring!], ["Saved an item", adopt!.saving!], ["Followed someone", adopt!.following!]];
  const topPosts = rowsOf<{ id: string; body: string; score: number; username: string }>(await db.execute(sql`select p.id::text id, left(p.body, 90) body, (p.like_count * 2 + p.comment_count * 3 + p.share_count * 4)::int score, u.username from posts p join users u on u.id = p.author_id where p.status = 'published' and p.visibility = 'public' and p.created_at >= ${since} order by score desc limit 8`));
  const topListings = rowsOf<{ id: string; title: string; views: number; kind: string }>(await db.execute(sql`(select id::text id, title, view_count views, 'product' kind from products where status='active' order by view_count desc limit 5) union all (select id::text, title, view_count, 'service' from services where status='active' order by view_count desc limit 5) order by views desc limit 8`));
  const dash = await getDashboard(days);
  return (
    <>
      <AdminTitle title="Analytics" description={`Feature adoption among ${adopt!.base} active members during the last ${days} days.`}
        actions={<div className="flex flex-wrap items-center gap-2">
          <nav className="flex gap-1" aria-label="Date range">{RANGES.map((r) => <Link key={r} href={`/admin/analytics?days=${r}`} className={cn("rounded-full border border-line px-3 py-1 text-sm", days === r ? "bg-primary text-white" : "bg-surface text-muted")}>{r}d</Link>)}</nav>
          <a className="btn-secondary btn-sm" href={`/api/admin/export?metric=growth&days=${days}`}>↓ Growth CSV</a>
          <a className="btn-secondary btn-sm" href={`/api/admin/export?metric=summary&days=${days}`}>↓ Summary CSV</a>
        </div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <GrowthChart growth={dash.growth} />
        <PostsChart posts={dash.postsSeries} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Table head={["Action", "Members", "Share of active"]}>{rows.map(([l, n]) => <tr key={l}><Td>{l}</Td><Td>{n}</Td><Td>{adopt!.base ? `${Math.round((n / adopt!.base!) * 100)}%` : "n/a"}</Td></tr>)}</Table>
        <div className="space-y-5">
          <section><h2 className="mb-2 text-lg">Top public posts</h2><Table head={["Post", "Author", "Score"]} empty={topPosts.length ? undefined : "No posts in this period."}>{topPosts.map((p) => <tr key={p.id}><Td><Link className="link" href={`/posts/${p.id}`}>{p.body || "(media)"}</Link></Td><Td>@{p.username}</Td><Td>{p.score}</Td></tr>)}</Table><p className="mt-1 text-xs text-muted">Score = likes×2 + comments×3 + shares×4.</p></section>
          <section><h2 className="mb-2 text-lg">Most viewed listings</h2><Table head={["Listing", "Type", "Views"]} empty={topListings.length ? undefined : "No listings."}>{topListings.map((p) => <tr key={p.kind + p.id}><Td><Link className="link" href={`/${p.kind}s/${p.id}`}>{p.title}</Link></Td><Td>{p.kind}</Td><Td>{p.views}</Td></tr>)}</Table></section>
        </div>
      </div>
    </>
  );
}
