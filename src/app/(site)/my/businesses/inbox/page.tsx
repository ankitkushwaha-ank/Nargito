import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { listEnquiries } from "@/server/services/messaging";
import { Avatar, Badge, EmptyState, PageHeader, Pager } from "@/components/ui/kit";
import { timeAgo } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Business inbox" };

export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/my/businesses/inbox");
  const sp = await searchParams;
  const role = sp.role === "sent" ? "enquirer" : "recipient";
  const status = ["new", "responded", "closed"].includes(sp.status ?? "") ? sp.status : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const locale = await getLocale();
  const { items, hasMore } = await listEnquiries(user.id, role, status, page);
  return (
    <FeatureGate feature="messaging">
      <ThreeColumn user={user} right={false}>
        <PageHeader title="Enquiries" description="Questions about your listings, and the enquiries you have sent." />
        <nav className="flex flex-wrap gap-2" aria-label="Enquiry filters">
          {[["Received", "/my/businesses/inbox"], ["Sent", "/my/businesses/inbox?role=sent"]].map(([l, h]) => <Link key={h} href={h!} className={cn("rounded-full border border-line px-3 py-1.5 text-sm", (h!.includes("sent") ? role === "enquirer" : role === "recipient") ? "bg-primary text-white" : "bg-surface text-muted")}>{l}</Link>)}
          <span className="mx-1 w-px bg-line" aria-hidden />
          {["new", "responded", "closed"].map((s) => <Link key={s} href={`/my/businesses/inbox?${sp.role ? `role=${sp.role}&` : ""}status=${s}`} className={cn("rounded-full border border-line px-3 py-1.5 text-sm capitalize", status === s ? "bg-primary-tint text-primary" : "bg-surface text-muted")}>{s}</Link>)}
        </nav>
        {items.length === 0 ? <EmptyState title="No enquiries" /> : (
          <ul className="card divide-y divide-line">{items.map(({ e, u }) => (
            <li key={e.id}><Link href={`/messages/${e.conversationId}`} className="flex items-center gap-3 p-3 hover:bg-primary-tint"><Avatar name={u.displayName} src={u.avatarUrl} size={40} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.displayName}</p><p className="truncate text-sm text-muted">{e.listingType}: {e.titleSnapshot}</p></div><Badge tone={e.status === "new" ? "warn" : e.status === "responded" ? "success" : "muted"}>{e.status}</Badge><span className="text-xs text-muted">{timeAgo(e.updatedAt, locale)}</span></Link></li>
          ))}</ul>
        )}
        <Pager page={page} hasMore={hasMore} basePath="/my/businesses/inbox" params={{ role: sp.role, status }} />
      </ThreeColumn>
    </FeatureGate>
  );
}
