"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Shield, Settings, LogOut, User as UserIcon, FileText, Plane, ShoppingBag, Briefcase, Building2, Users, Megaphone, Bookmark, Crown, HelpCircle, Sun, Moon, Monitor, Check, Languages } from "lucide-react";
import { Avatar } from "@/components/ui/kit";
import { logoutAction } from "@/app/(auth)/actions";
import { callApi } from "@/lib/client-api";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/85 transition-colors hover:bg-primary-tint hover:text-primary";

/** Segmented control for theme + language, used inside the account menu (no native <select>). */
function Preferences({ locales, theme }: { locales: { code: string; nativeName: string }[]; theme: "light" | "dark" | "system" }) {
  const t = useT();
  const router = useRouter();
  const locale = useLocale();
  const [cur, setCur] = useState(theme);
  const [pending, start] = useTransition();
  const applyTheme = (v: "light" | "dark" | "system") => {
    setCur(v);
    const dark = v === "dark" || (v === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.cookie = `nargito_theme=${v}; path=/; max-age=31536000; samesite=lax`;
    void callApi("/api/preferences", "POST", { theme: v });
  };
  const themes = [{ v: "light" as const, icon: Sun, label: t("theme.light") }, { v: "dark" as const, icon: Moon, label: t("theme.dark") }, { v: "system" as const, icon: Monitor, label: t("theme.system") }];
  return (
    <div className="space-y-3 border-t border-line px-2 py-3">
      <div>
        <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("nav.theme")}</p>
        <div role="radiogroup" aria-label={t("nav.theme")} className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
          {themes.map(({ v, icon: I, label }) => (
            <button key={v} type="button" role="radio" aria-checked={cur === v} aria-label={label} title={label} data-theme-btn={v} onClick={() => applyTheme(v)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-muted transition-colors aria-checked:bg-surface aria-checked:text-primary aria-checked:shadow-sm"><I size={15} aria-hidden />{label}</button>
          ))}
        </div>
      </div>
      {locales.length > 1 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted"><Languages size={13} aria-hidden />{t("nav.language")}</p>
          <div role="radiogroup" aria-label={t("nav.language")} className="flex flex-wrap gap-1.5">
            {locales.map((l) => (
              <button key={l.code} type="button" role="radio" aria-checked={locale === l.code} disabled={pending}
                onClick={() => start(async () => { await callApi("/api/preferences", "POST", { locale: l.code }); router.refresh(); })}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", locale === l.code ? "border-primary bg-primary-tint text-primary" : "border-line text-ink/80 hover:border-primary/40")}>
                {locale === l.code && <Check size={14} aria-hidden />}{l.nativeName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountMenu({ user, isAdmin, locales, theme }: { user: { displayName: string; username: string; avatarUrl: string | null; headline: string | null }; isAdmin: boolean; locales: { code: string; nativeName: string }[]; theme: "light" | "dark" | "system" }) {
  const { open, setOpen, ref } = useDropdown();
  const t = useT();
  const L = ({ href, icon: I, children }: { href: string; icon: typeof UserIcon; children: React.ReactNode }) => (
    <Link role="menuitem" onClick={() => setOpen(false)} href={href} className={item}><I size={18} className="text-muted" aria-hidden />{children}</Link>
  );
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-primary-tint">
        <Avatar name={user.displayName} src={user.avatarUrl} size={40} /><ChevronDown size={14} className={cn("hidden text-muted transition-transform md:block", open && "rotate-180")} aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] p-2 shadow-2xl">
          <Link href={`/profile/${user.username}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-primary-tint/60">
            <Avatar name={user.displayName} src={user.avatarUrl} size={48} />
            <span className="min-w-0"><span className="block truncate font-bold">{user.displayName}</span><span className="block truncate text-xs text-muted">{user.headline ?? `@${user.username}`}</span></span>
          </Link>
          <div className="my-1 border-t border-line" />
          <L href={`/profile/${user.username}`} icon={UserIcon}>{t("nav.profile")}</L>
          <L href="/my/trips" icon={Plane}>My trips</L>
          <L href="/saved" icon={Bookmark}>Saved</L>
          <L href="/pricing" icon={Crown}>Nargito Plus</L>
          <L href="/settings/profile" icon={Settings}>{t("nav.settings")}</L>
          <L href="/help" icon={HelpCircle}>Help &amp; support</L>
          {isAdmin && <L href="/admin" icon={Shield}>{t("nav.admin")}</L>}
          <Preferences locales={locales} theme={theme} />
          <form action={logoutAction} className="border-t border-line pt-1"><button role="menuitem" type="submit" className={cn(item, "w-full hover:!bg-rose-50 hover:!text-rose-600")}><LogOut size={18} aria-hidden />{t("nav.signOut")}</button></form>
        </div>
      )}
    </div>
  );
}

export type CreateEnabled = { trips: boolean; products: boolean; services: boolean; companies: boolean; groups: boolean; promotions: boolean };

export function createOptions(enabled: CreateEnabled, t: (k: string) => string) {
  return [
    { href: "/home#composer", icon: FileText, label: t("composer.start"), tone: "bg-rose-50 text-rose-500" },
    enabled.trips && { href: "/my/trips/new", icon: Plane, label: t("composer.trip"), tone: "bg-blue-50 text-primary" },
    enabled.products && { href: "/my/listings/product/new", icon: ShoppingBag, label: t("composer.product"), tone: "bg-emerald-50 text-emerald-600" },
    enabled.services && { href: "/my/listings/service/new", icon: Briefcase, label: t("composer.service"), tone: "bg-orange-50 text-orange-500" },
    enabled.companies && { href: "/my/businesses", icon: Building2, label: t("composer.business"), tone: "bg-violet-50 text-violet-600" },
    enabled.groups && { href: "/groups/new", icon: Users, label: "Create a group", tone: "bg-cyan-50 text-cyan-600" },
    enabled.promotions && { href: "/my/ads", icon: Megaphone, label: "Promote something", tone: "bg-amber-50 text-amber-600" },
  ].filter(Boolean) as { href: string; icon: typeof FileText; label: string; tone: string }[];
}

export function CreateMenu({ enabled }: { enabled: CreateEnabled }) {
  const { open, setOpen, ref } = useDropdown();
  const t = useT();
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn-primary !min-h-[42px] !px-4"><Plus size={20} aria-hidden /><span>{t("nav.create")}</span></button>
      {open && (
        <div role="menu" className="card absolute right-0 top-full z-50 mt-2 w-64 p-2 shadow-2xl">
          {createOptions(enabled, t).map((o) => (
            <Link key={o.href} role="menuitem" href={o.href} onClick={() => setOpen(false)} className={item}><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", o.tone)}><o.icon size={18} aria-hidden /></span>{o.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
