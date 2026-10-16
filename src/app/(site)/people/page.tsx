import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { useDb, schema } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { Avatar, EmptyState, PageHeader, Pager, VerifiedBadge } from "@/components/ui/kit";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FollowButton } from "@/components/social/relationship-buttons";
import { likeEscape } from "@/server/util";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const db = await useDb();
  const conds = [eq(schema.users.status, "active"), eq(schema.users.profileVisibility, "public"), eq(schema.users.discoverable, true), sql`${schema.users.deletedAt} is null`];
  if (q) conds.push(sql`(${schema.users.displayName} ilike ${"%" + likeEscape(q) + "%"} or ${schema.users.username} ilike ${"%" + likeEscape(q) + "%"} or ${schema.users.headline} ilike ${"%" + likeEscape(q) + "%"})`);
  if (viewer) conds.push(sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewer.id}::uuid and b.blocked_id = ${schema.users.id}) or (b.blocker_id = ${schema.users.id} and b.blocked_id = ${viewer.id}::uuid))`);
  const rows = await db.select().from(schema.users).where(and(...conds)).orderBy(desc(schema.users.createdAt)).limit(25).offset((page - 1) * 24);
  const followed = viewer ? new Set((await db.select({ id: schema.follows.followingId }).from(schema.follows).where(eq(schema.follows.followerId, viewer.id))).map((r) => r.id)) : new Set<string>();
  return (
    <FeatureGate feature="profiles">
      <Container>
        <PageHeader title="People" description="Members who have chosen to be discoverable." />
        <form className="mb-4 flex gap-2" role="search"><label className="sr-only" htmlFor="pq">Search people</label><input id="pq" name="q" defaultValue={q} className="input" placeholder="Search by name, username or headline" /><button className="btn-primary">Search</button></form>
        {rows.length === 0 ? <EmptyState title="No people found" /> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.slice(0, 24).map((u) => (
              <li key={u.id} className="card flex items-center gap-3 p-4">
                <Link href={`/profile/${u.username}`}><Avatar name={u.displayName} src={u.avatarUrl} size={56} /></Link>
                <div className="min-w-0 flex-1"><Link href={`/profile/${u.username}`} className="flex items-center gap-1 font-medium hover:underline">{u.displayName}{u.verified && <VerifiedBadge />}</Link><p className="truncate text-sm text-muted">{u.headline}</p><p className="truncate text-xs text-muted">{u.locationLabel}</p></div>
                {viewer && viewer.id !== u.id && <FollowButton userId={u.id} initialFollowing={followed.has(u.id)} size="sm" />}
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} hasMore={rows.length > 24} basePath="/people" params={{ q }} />
      </Container>
    </FeatureGate>
  );
}
