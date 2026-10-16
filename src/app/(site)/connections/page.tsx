import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { listConnections, pendingRequests, listFollowers } from "@/server/services/social";
import { Avatar, EmptyState, Pager, VerifiedBadge } from "@/components/ui/kit";
import { ConnectionRow } from "@/components/social/relationship-buttons";
import { timeAgo } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Connections" };

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/connections");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const view = sp.view === "followers" ? "followers" : "connections";
  const locale = await getLocale();
  const [pending, conns, followers] = await Promise.all([pendingRequests(user.id), view === "connections" ? listConnections(user.id, page) : null, view === "followers" ? listFollowers(user.id, page) : null]);
  const Person = ({ u, right }: { u: { username: string; displayName: string; headline: string | null; avatarUrl: string | null; verified: boolean }; right?: React.ReactNode }) => (
    <li className="flex items-center gap-3 py-3">
      <Link href={`/profile/${u.username}`}><Avatar name={u.displayName} src={u.avatarUrl} size={48} /></Link>
      <div className="min-w-0 flex-1"><Link href={`/profile/${u.username}`} className="flex items-center gap-1 font-medium hover:underline">{u.displayName}{u.verified && <VerifiedBadge />}</Link><p className="truncate text-sm text-muted">{u.headline}</p></div>
      {right}
    </li>
  );
  return (
    <FeatureGate feature="connections">
      <ThreeColumn user={user} right={false}>
        {pending.incoming.length > 0 && (
          <section className="card p-4" aria-labelledby="inc-h">
            <h2 id="inc-h" className="text-lg">Invitations ({pending.incoming.length})</h2>
            <ul className="divide-y divide-line">{pending.incoming.map((r) => <Person key={r.id} u={r.user} right={<div className="text-right"><ConnectionRow connectionId={r.id} mode="incoming" /><p className="mt-1 text-xs text-muted">{timeAgo(r.at, locale)}</p></div>} />)}</ul>
          </section>
        )}
        {pending.outgoing.length > 0 && (
          <section className="card p-4" aria-labelledby="out-h">
            <h2 id="out-h" className="text-lg">Sent invitations</h2>
            <ul className="divide-y divide-line">{pending.outgoing.map((r) => <Person key={r.id} u={r.user} right={<ConnectionRow connectionId={r.id} mode="outgoing" />} />)}</ul>
          </section>
        )}
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg">{view === "connections" ? "Your connections" : "Your followers"}</h2>
            <nav className="flex gap-2 text-sm" aria-label="Connection views">
              <Link href="/connections" aria-current={view === "connections" ? "page" : undefined} className={view === "connections" ? "font-semibold text-primary" : "text-muted"}>Connections</Link>
              <Link href="/connections?view=followers" aria-current={view === "followers" ? "page" : undefined} className={view === "followers" ? "font-semibold text-primary" : "text-muted"}>Followers</Link>
              <Link href="/people" className="text-muted hover:text-ink">Find people</Link>
            </nav>
          </div>
          {conns && (conns.items.length ? <><ul className="divide-y divide-line">{conns.items.map((c) => <Person key={c.id} u={c.other} right={<ConnectionRow connectionId={c.id} mode="connected" />} />)}</ul><Pager page={page} hasMore={conns.hasMore} basePath="/connections" /></> : <EmptyState title="No connections yet" description="Find people you know and send an invitation." action={<Link href="/people" className="btn-primary">Find people</Link>} />)}
          {followers && (followers.items.length ? <><ul className="divide-y divide-line">{followers.items.map((f) => <Person key={f.user.id} u={f.user} />)}</ul><Pager page={page} hasMore={followers.hasMore} basePath="/connections" params={{ view: "followers" }} /></> : <EmptyState title="No followers yet" />)}
        </section>
      </ThreeColumn>
    </FeatureGate>
  );
}
