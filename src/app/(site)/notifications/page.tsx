import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { listNotifications } from "@/server/services/notify";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/kit";
import { MarkAllRead } from "./mark-all";
import { getT, getLocale } from "@/i18n/server";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { openNotificationAction } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/notifications");
  const sp = await searchParams;
  const t = await getT();
  const locale = await getLocale();
  const { items, nextCursor } = await listNotifications(user.id, sp.cursor);
  return (
    <FeatureGate feature="notifications">
      <ThreeColumn user={user} right={false}>
        <PageHeader title={t("notif.title")} actions={<><MarkAllRead label={t("notif.markAll")} /><Link href="/settings/notifications" className="btn-secondary">Preferences</Link></>} />
        {items.length === 0 ? <EmptyState title={t("notif.empty")} /> : (
          <ul className="card divide-y divide-line">
            {items.map(({ n, actorName, actorAvatar }) => (
              <li key={n.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={n.id} /><input type="hidden" name="link" value={n.link ?? ""} />
                  <button type="submit" className={cn("flex w-full items-start gap-3 p-4 text-left hover:bg-primary-tint", !n.readAt && "bg-primary-tint/50")}>
                    <Avatar name={actorName ?? "Nargito"} src={actorAvatar} size={40} />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span>{n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}<span className="text-xs text-muted">{timeAgo(n.createdAt, locale)}</span></span>
                    {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && <Link href={`/notifications?cursor=${encodeURIComponent(nextCursor)}`} className="btn-secondary mx-auto">{t("common.loadMore")}</Link>}
      </ThreeColumn>
    </FeatureGate>
  );
}
