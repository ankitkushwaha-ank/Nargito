"use client";
import { useState, useTransition } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { callApi } from "@/lib/client-api";

export function EntityFollowButton({ type, id, initial, signedIn }: { type: "company" | "shop"; id: string; initial: boolean; signedIn: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  if (!signedIn) return <a className="btn-primary" href="/login"><UserPlus size={16} aria-hidden />Sign in to follow</a>;
  return (
    <button type="button" aria-pressed={following} disabled={pending} className={following ? "btn-secondary" : "btn-primary"}
      onClick={() => start(async () => { const r = await callApi<{ following: boolean }>("/api/entity-follow", "POST", { type, id }); if (r.ok) setFollowing(r.following); })}>
      {following ? <UserCheck size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}{following ? "Following" : "Follow"}
    </button>
  );
}
