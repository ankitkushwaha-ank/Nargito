import { MessageSquare } from "lucide-react";

export const metadata = { title: "Messages" };

export default function MessagesIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted">
      <MessageSquare size={32} aria-hidden />
      <p className="font-medium text-ink">Select a conversation</p>
      <p className="text-sm">Enquiries about listings and direct messages appear here.</p>
    </div>
  );
}
