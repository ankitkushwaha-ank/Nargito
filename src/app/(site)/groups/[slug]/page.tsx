import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { Lock } from "lucide-react";
import { getGroup } from "@/server/services/business";
import { getSessionUser } from "@/server/auth/session";
import { getFeed } from "@/server/services/posts";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Avatar, Badge, CoverImage, EmptyState } from "@/components/ui/kit";
import { FeedList } from "@/components/social/feed-list";
import { Composer } from "@/components/social/composer";
import { SaveButton } from "@/components/social/save-button";
import { ReportButton } from "@/components/social/report-button";
import { useDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { groupMembershipAction } from "../../my/actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const db = await useDb();
  const [g] = await db.select().from(schema.groups).where(and(eq(schema.groups.slug, slug), eq(schema.groups.status, "active")));
  if (!g || g.visibility !== "public") return { title: "Group", robots: { index: false, follow: false } };
  return { title: g.name, description: (g.description ?? g.name).slice(0, 160), alternates: { canonical: `/groups/${g.slug}` }, openGraph: { title: g.name, images: [g.coverUrl ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [g.coverUrl ?? "/api/brand/og"] } };
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getSessionUser();
  const r = await getGroup(slug, viewer?.id ?? null);
  if (!r) notFound();
  const { g, mem, isMember, memberCount, canView } = r;
  const db = await useDb();
  const feed = canView ? await getFeed(viewer?.id ?? null, { groupId: g.id }) : null;
  const isAdmin = isMember && (mem?.role === "owner" || mem?.role === "moderator");
  const pending = isAdmin ? await db.select({ u: schema.users }).from(schema.groupMembers).innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId)).where(and(eq(schema.groupMembers.groupId, g.id), eq(schema.groupMembers.status, "pending"))) : [];
  const members = canView ? await db.select({ u: schema.users, role: schema.groupMembers.role }).from(schema.groupMembers).innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId)).where(and(eq(schema.groupMembers.groupId, g.id), eq(schema.groupMembers.status, "active"))).limit(12) : [];
  const saved = viewer ? !!(await db.select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "group"), eq(schema.savedItems.entityId, g.id))))[0] : false;
  const s = await getSettings();
  return (
    <FeatureGate feature="groups">
      <ThreeColumn user={viewer} right={false}>
        <section className="card overflow-hidden">
          <CoverImage src={g.coverUrl} ratio="aspect-[21/6]" className="rounded-none" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><h1 className="flex items-center gap-2 text-2xl">{g.name}{g.visibility === "private" && <Lock size={16} aria-label="Private group" />}</h1><p className="text-sm text-muted">{memberCount} member{memberCount === 1 ? "" : "s"}{g.category ? ` · ${g.category}` : ""}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {viewer ? (
                <form action={groupMembershipAction}><input type="hidden" name="groupId" value={g.id} />
                  {isMember ? (mem?.role !== "owner" && <button name="intent" value="leave" className="btn-secondary">Leave group</button>) : mem?.status === "pending" ? <button name="intent" value="leave" className="btn-secondary">Cancel request</button> : <button name="intent" value="join" className="btn-primary">{g.visibility === "public" ? "Join group" : "Request to join"}</button>}
                </form>
              ) : <Link href={`/login?next=/groups/${g.slug}`} className="btn-primary">Sign in to join</Link>}
              {viewer && <SaveButton entityType="group" entityId={g.id} initial={saved} />}
              {viewer && !isAdmin && <ReportButton entityType="group" entityId={g.id} />}
            </div>
          </div>
          {g.description && <p className="border-t border-line px-5 py-3 text-sm">{g.description}</p>}
        </section>
        {pending.length > 0 && (
          <section className="card p-4" aria-label="Join requests"><h2 className="text-base">Join requests</h2>
            <ul className="mt-2 divide-y divide-line">{pending.map(({ u }) => (<li key={u.id} className="flex items-center gap-3 py-2"><Avatar name={u.displayName} src={u.avatarUrl} size={36} /><span className="flex-1 text-sm">{u.displayName}</span>
              <form action={groupMembershipAction} className="flex gap-1"><input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="userId" value={u.id} /><button name="intent" value="approve" className="btn-primary !min-h-[32px]">Approve</button><button name="intent" value="decline" className="btn-secondary !min-h-[32px]">Decline</button></form></li>))}</ul>
          </section>
        )}
        {!canView ? <EmptyState icon={<Lock size={28} />} title="This is a private group" description="Request to join to see its posts and members." /> : (
          <>
            {isMember && viewer && <Composer user={{ displayName: viewer.displayName, avatarUrl: viewer.avatarUrl }} groupId={g.id} limits={{ maxLength: Number(s["posts.maxLength"]), maxMedia: Number(s["posts.maxMediaPerPost"]), allowPolls: false, allowVideo: Boolean(s["posts.allowVideo"]), allowDocs: Boolean(s["posts.allowDocuments"]), defaultVisibility: "public" }} />}
            {feed && <FeedList initialItems={feed.items} initialCursor={feed.nextCursor} query={`group=${g.id}`} sponsoredEvery={0} emptyText="No posts yet. Start the conversation." />}
            {members.length > 0 && <section className="card p-4" aria-label="Members"><h2 className="text-base">Members</h2><ul className="mt-2 flex flex-wrap gap-3">{members.map(({ u, role }) => <li key={u.id}><Link href={`/profile/${u.username}`} className="flex items-center gap-2 hover:underline"><Avatar name={u.displayName} src={u.avatarUrl} size={32} /><span className="text-sm">{u.displayName}</span>{role !== "member" && <Badge>{role}</Badge>}</Link></li>)}</ul></section>}
          </>
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
