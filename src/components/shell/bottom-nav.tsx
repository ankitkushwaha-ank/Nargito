"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, Home, MessageSquare, Plus, User, X } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { createOptions, type CreateEnabled } from "./menus";

type Counts = { notifications: number; messages: number; requests: number };

/** Floating tab bar for phones: Home, Explore, centre "+" (create sheet), Messages, Profile. */
export function MobileBottomNav({ counts, username, enabled }: { counts: Counts; username: string; enabled: CreateEnabled }) {
  const path = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  const is = (m: string[]) => m.some((x) => path === x || path.startsWith(x + "/"));
  const tab = (href: string, label: string, Icon: typeof Home, active: boolean, badge = 0) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-colors", active ? "bg-primary-tint text-primary" : "text-muted")}>
      <span className="relative"><Icon size={23} strokeWidth={active ? 2.4 : 1.9} aria-hidden />{badge > 0 && <span className="absolute -right-2.5 -top-2 min-w-[17px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[17px] text-white ring-2 ring-surface"><span className="sr-only">{badge} unread</span><span aria-hidden>{badge > 99 ? "99+" : badge}</span></span>}</span>
      {label}
    </Link>
  );
  return (
    <>
      <nav aria-label="Primary mobile" className="fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-line bg-surface/95 px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_12px_40px_-12px_rgb(18_40_110/0.4)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5 items-end">
          <li>{tab("/home", t("nav.home"), Home, is(["/home", "/feed"]))}</li>
          <li>{tab("/explore", t("nav.explore"), Compass, is(["/explore", "/search", "/trips", "/products", "/services", "/shops"]))}</li>
          <li className="flex justify-center">
            <button type="button" onClick={() => setOpen(true)} aria-label={t("nav.create")} aria-haspopup="dialog" className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_24px_-6px_rgb(var(--c-primary)/0.7)] ring-4 ring-surface transition-transform active:scale-95"><Plus size={28} aria-hidden /></button>
          </li>
          <li>{tab("/messages", t("nav.messages"), MessageSquare, is(["/messages"]), counts.messages)}</li>
          <li>{tab(`/profile/${username}`, "Me", User, is([`/profile/${username}`, "/settings", "/my"]))}</li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t("nav.create")}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{t("nav.create")}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"><X size={18} aria-hidden /></button></div>
            <ul className="grid grid-cols-3 gap-3">
              {createOptions(enabled, t).map((o) => (
                <li key={o.href}><Link href={o.href} onClick={() => setOpen(false)} className="flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-center text-[12px] font-semibold leading-tight"><span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", o.tone)}><o.icon size={22} aria-hidden /></span>{o.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
