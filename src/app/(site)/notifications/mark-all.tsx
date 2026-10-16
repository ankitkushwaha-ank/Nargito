"use client";
import { CheckCheck } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllReadAction } from "./actions";

export function MarkAllRead({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" disabled={pending} className="btn-secondary" onClick={() => start(async () => { await markAllReadAction(); router.refresh(); })}><CheckCheck size={16} aria-hidden />{label}</button>;
}
