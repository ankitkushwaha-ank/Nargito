"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellOff, Bell, Ban } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { ReportButton } from "@/components/social/report-button";

export function ConversationTools({ conversationId, otherId, muted: m0, enquiryId, enquiryStatus }: { conversationId: string; otherId: string; muted: boolean; enquiryId?: string; enquiryStatus?: string }) {
  const router = useRouter();
  const [muted, setMuted] = useState(m0);
  const [status, setStatus] = useState(enquiryStatus);
  return (
    <div className="flex items-center gap-1">
      {enquiryId && (
        <label className="hidden text-xs sm:block"><span className="sr-only">Enquiry status</span>
          <select className="input !w-auto !py-1 text-xs" value={status} onChange={async (e) => { const v = e.target.value; setStatus(v); await callApi(`/api/enquiries/${enquiryId}`, "PATCH", { status: v }); router.refresh(); }}>
            <option value="new">New</option><option value="responded">Responded</option><option value="closed">Closed</option>
          </select>
        </label>
      )}
      <button type="button" className="btn-ghost !px-2" aria-label={muted ? "Unmute conversation" : "Mute conversation"} onClick={async () => { const r = await callApi<{ muted: boolean }>(`/api/conversations/${conversationId}/mute`); if (r.ok) setMuted(r.muted); }}>{muted ? <BellOff size={16} /> : <Bell size={16} />}</button>
      <button type="button" className="btn-ghost !px-2" aria-label="Block user" onClick={async () => { if (confirm("Block this person? You will no longer be able to message each other.")) { await callApi("/api/relationships", "POST", { action: "block", userId: otherId }); router.refresh(); } }}><Ban size={16} /></button>
      <ReportButton entityType="user" entityId={otherId} label="" className="btn-ghost !px-2" />
    </div>
  );
}
