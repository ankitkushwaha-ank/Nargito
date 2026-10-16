"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/kit";
import { ThemeToggle } from "@/components/shell/prefs-switchers";
import { AdminNavLinks } from "./nav-links";

type Groups = { label: string; items: { label: string; href: string }[] }[];

/** Responsive admin frame: sticky sidebar on desktop, slide-in drawer on phones, footer pinned to the bottom. */
export function AdminShell({ groups, user, siteName, children }: { groups: Groups; user: { displayName: string; avatarUrl: string | null }; siteName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <aside className="hidden border-r border-line bg-surface lg:block" aria-label="Admin navigation">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4"><Logo size={34} href="/admin" /><span className="rounded-md bg-primary-tint px-2 py-0.5 text-xs font-bold text-primary">Admin</span></div>
          <div className="flex-1 overflow-y-auto p-3"><AdminNavLinks groups={groups} /></div>
          <div className="border-t border-line p-3"><Link href="/home" className="btn-secondary w-full"><ArrowLeft size={16} aria-hidden />Back to website</Link></div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><Logo size={30} href="/admin" /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-bg"><X size={20} aria-hidden /></button></div>
            <div className="flex-1 overflow-y-auto p-3"><AdminNavLinks groups={groups} onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"><Link href="/home" className="btn-secondary w-full"><ArrowLeft size={16} aria-hidden />Back to website</Link></div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line lg:hidden"><Menu size={20} aria-hidden /></button>
          <div className="lg:hidden"><Logo size={30} withWordmark={false} href="/admin" /></div>
          <p className="hidden text-sm font-semibold text-muted sm:block lg:hidden">Admin</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/home" className="btn-ghost btn-sm hidden sm:inline-flex lg:hidden"><ArrowLeft size={15} aria-hidden />Site</Link>
            <span className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm font-semibold"><Avatar name={user.displayName} src={user.avatarUrl} size={30} /><span className="hidden max-w-[10rem] truncate sm:inline">{user.displayName}</span></span>
          </div>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[1320px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="border-t border-line bg-surface px-4 py-4 text-xs text-muted sm:px-6">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2">
            <p>© {new Date().getFullYear()} {siteName} Admin</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1"><Link className="hover:text-primary" href="/admin/branding">Logo &amp; images</Link><Link className="hover:text-primary" href="/admin/settings/general">Settings</Link><Link className="hover:text-primary" href="/admin/health">System health</Link><Link className="hover:text-primary" href="/help">Help</Link></p>
          </div>
        </footer>
      </div>
    </div>
  );
}
