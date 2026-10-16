"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserPlus, UserCheck, UserMinus, MessageSquare, Ban, Check, X, BellOff } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { useT } from "@/i18n/client";
import type { Relationship } from "@/server/services/social";
import { ReportButton } from "./report-button";

export function FollowButton({ userId, initialFollowing, size = "md" }: { userId: string; initialFollowing: boolean; size?: "sm" | "md" }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const t = useT();
  return (
    <>
      <button type="button" disabled={pending} aria-pressed={following} className={`${following ? "btn-secondary" : "btn-primary"} ${size === "sm" ? "!min-h-[32px] !px-3 !py-1" : ""}`}
        onClick={() => start(async () => {
          const r = await callApi("/api/relationships", "POST", { action: following ? "unfollow" : "follow", userId });
          if (r.ok) setFollowing(!following); else setErr(r.error);
        })}>
        {following ? <UserCheck size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}{following ? t("common.following") : t("common.follow")}
      </button>
      {err && <span role="alert" className="text-xs text-danger">{err}</span>}
    </>
  );
}

export function ProfileActions({ userId, rel, canMessage }: { userId: string; rel: Relationship; canMessage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const act = (action: string, extra: Record<string, unknown> = {}) => start(async () => {
    const r = await callApi("/api/relationships", "POST", { action, userId, ...extra });
    if (r.ok) router.refresh(); else setErr(r.error);
  });
  async function message() {
    const r = await callApi<{ conversationId: string }>("/api/conversations", "POST", { userId });
    if (r.ok) router.push(`/messages/${r.conversationId}`); else setErr(r.error);
  }
  if (rel.blocked) return <button className="btn-secondary" disabled={pending} onClick={() => act("unblock")}><Ban size={16} aria-hidden />Unblock</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {rel.connection === "none" && <button className="btn-primary" disabled={pending} onClick={() => act("connect")}><UserPlus size={16} aria-hidden />Connect</button>}
      {rel.connection === "pending_out" && <button className="btn-secondary" disabled={pending} onClick={() => act("remove", { connectionId: rel.connectionId })}><X size={16} aria-hidden />Withdraw request</button>}
      {rel.connection === "pending_in" && <><button className="btn-primary" disabled={pending} onClick={() => act("accept", { connectionId: rel.connectionId })}><Check size={16} aria-hidden />Accept</button><button className="btn-secondary" disabled={pending} onClick={() => act("remove", { connectionId: rel.connectionId })}>Decline</button></>}
      {rel.connection === "accepted" && <button className="btn-secondary" disabled={pending} onClick={() => confirm("Remove this connection?") && act("remove", { connectionId: rel.connectionId })}><UserMinus size={16} aria-hidden />Connected</button>}
      <FollowButton userId={userId} initialFollowing={rel.following} />
      {canMessage && <button className="btn-secondary" onClick={message}><MessageSquare size={16} aria-hidden />Message</button>}
      <button className="btn-ghost !px-2.5" title={rel.muted ? "Unmute" : "Mute"} aria-label={rel.muted ? "Unmute" : "Mute"} disabled={pending} onClick={() => act("mute")}><BellOff size={18} aria-hidden /><span className="hidden 2xl:inline">{rel.muted ? "Unmute" : "Mute"}</span></button>
      <button className="btn-ghost !px-2.5" title="Block" aria-label="Block" disabled={pending} onClick={() => confirm("Block this person? They won't be able to see your profile or contact you.") && act("block")}><Ban size={18} aria-hidden /><span className="hidden 2xl:inline">Block</span></button>
      <ReportButton entityType="user" entityId={userId} label="" className="btn-ghost !px-2.5" />
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </div>
  );
}

export function ConnectionRow({ connectionId, mode }: { connectionId: string; mode: "incoming" | "outgoing" | "connected" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (action: string) => start(async () => { await callApi("/api/relationships", "POST", { action, connectionId }); router.refresh(); });
  return (
    <div className="flex gap-2">
      {mode === "incoming" && <button disabled={pending} className="btn-primary !min-h-[34px]" onClick={() => act("accept")}>Accept</button>}
      <button disabled={pending} className="btn-secondary !min-h-[34px]" onClick={() => (mode === "connected" ? confirm("Remove this connection?") && act("remove") : act("remove"))}>{mode === "incoming" ? "Decline" : mode === "outgoing" ? "Withdraw" : "Remove"}</button>
    </div>
  );
}
