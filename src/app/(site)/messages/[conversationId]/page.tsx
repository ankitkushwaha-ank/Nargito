import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, PackageX } from "lucide-react";
import { requireUserPage } from "@/server/auth/guard";
import { getConversationView, getMessages, markConversationRead } from "@/server/services/messaging";
import { AppError } from "@/server/util";
import { getSetting } from "@/server/settings";
import { Avatar, Badge } from "@/components/ui/kit";
import { ChatPane } from "@/components/messaging/chat-pane";
import { ConversationTools } from "@/components/messaging/conversation-tools";

export const metadata = { title: "Conversation", robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const user = await requireUserPage(`/messages/${conversationId}`);
  let view, msgs;
  try {
    view = await getConversationView(user.id, conversationId);
    msgs = await getMessages(user.id, conversationId);
    await markConversationRead(user.id, conversationId);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const pollMs = await getSetting<number>("realtime.pollIntervalMs");
  const maxLen = await getSetting<number>("chat.maxMessageLength");
  const attachments = await getSetting<boolean>("chat.allowAttachments");
  const o = view.other;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line p-3">
        <Link href="/messages" className="btn-ghost !px-2 md:hidden" aria-label="Back to conversations"><ArrowLeft size={18} /></Link>
        {o && <Link href={`/profile/${o.username}`}><Avatar name={o.displayName} src={o.avatarUrl} size={40} /></Link>}
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{o?.displayName ?? "Unknown user"}</p>{o && <p className="truncate text-xs text-muted">@{o.username}</p>}</div>
        {view.enquiry && <Badge tone={view.enquiry.status === "closed" ? "muted" : view.enquiry.status === "responded" ? "success" : "warn"}>Enquiry: {view.enquiry.status}</Badge>}
        {o && <ConversationTools conversationId={conversationId} otherId={o.id} muted={view.muted} enquiryId={view.isRecipient ? view.enquiry?.id : undefined} enquiryStatus={view.enquiry?.status} />}
      </header>
      {view.listing && (
        <div className="border-b border-line bg-bg p-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {view.listing.image ? <img src={view.listing.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-tint text-muted" aria-hidden><PackageX size={18} /></div>}
            <div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-wide text-muted">{view.enquiry?.listingType}</p><p className="truncate text-sm font-medium">{view.listing.title}</p>{view.listing.subtitle && <p className="truncate text-xs text-muted">{view.listing.subtitle}</p>}</div>
            {view.listing.href && view.listing.available ? <Link href={view.listing.href} className="btn-secondary !min-h-[34px]"><ExternalLink size={14} aria-hidden />View</Link> : <Badge tone="muted">No longer available</Badge>}
          </div>
        </div>
      )}
      <ChatPane conversationId={conversationId} initial={msgs.items} initialHasMore={msgs.hasMore} pollMs={pollMs} maxLen={maxLen} allowAttachments={attachments} disabled={view.blocked || !o} disabledReason={view.blocked ? "You can't message this person." : "This user is no longer available."} />
    </div>
  );
}
