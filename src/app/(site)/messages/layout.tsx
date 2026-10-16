import { headers } from "next/headers";
import { requireUserPage } from "@/server/auth/guard";
import { listConversations } from "@/server/services/messaging";
import { FeatureGate } from "@/components/ui/feature-gate";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ConversationList } from "@/components/messaging/conversation-list";

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/messages");
  const path = (await headers()).get("x-pathname") ?? "/messages";
  const detail = path.startsWith("/messages/") && path.length > 10;
  const activeId = detail ? path.split("/")[2]! : null;
  const [convs, t] = await Promise.all([listConversations(user.id), getT()]);
  const items = convs.map((c) => ({
    id: c.id, last_message_at: new Date(c.last_message_at).toISOString(), other_name: c.other_name, other_username: c.other_username, other_avatar: c.other_avatar,
    last_body: c.last_body, last_kind: c.last_kind, unread: c.unread, context_title: c.context_title,
  }));
  return (
    <FeatureGate feature="messaging">
      <div className="mx-auto max-w-shell px-0 pb-16 sm:px-4 sm:py-5 md:pb-5">
        <div className="card grid h-[calc(100vh-130px)] min-h-[480px] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)] md:rounded-card">
          <aside className={cn("flex min-h-0 flex-col border-r border-line", detail && "hidden md:flex")} aria-label="Conversations">
            <div className="border-b border-line px-3 pt-3"><h1 className="text-lg">{t("msg.title")}</h1></div>
            <ConversationList items={items} activeId={activeId} empty={t("msg.empty")} />
          </aside>
          <section className={cn("min-h-0", !detail && "hidden md:block")}>{children}</section>
        </div>
      </div>
    </FeatureGate>
  );
}
