"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function AdminNavLinks({ groups, onNavigate }: { groups: { label: string; items: { label: string; href: string }[] }[]; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const current = groups.find((g) => g.items.some((i) => active(i.href)))?.label ?? groups[0]?.label ?? null;
  // Accordion: only one section is open at a time. Navigating opens the section of the new page.
  const [open, setOpen] = useState<string | null>(current);
  useEffect(() => { setOpen(current); }, [current]);

  return (
    <nav className="space-y-1.5 text-sm" aria-label="Admin sections">
      {groups.map((g) => {
                const isOpen = open === g.label;
        const id = `admin-nav-${g.label.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <div key={g.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : g.label)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors", isOpen ? "bg-slate-900 text-white dark:bg-white/15 dark:text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10")}
            >
              <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", isOpen ? "bg-white" : "bg-slate-400")} aria-hidden />{g.label}</span>
              <ChevronRight size={16} aria-hidden className={cn("transition-transform duration-200", isOpen && "rotate-90")} />
            </button>
            {isOpen && (
              <ul id={id} className="mb-2 mt-1 space-y-0.5 border-l-2 border-line pl-2 ml-3">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} onClick={onNavigate} aria-current={active(i.href) ? "page" : undefined}
                      className={cn("block rounded-lg px-3 py-2 text-[14px] transition-colors", active(i.href) ? "bg-slate-900/[.07] font-semibold text-slate-900 dark:bg-white/10 dark:text-white" : "text-ink/75 hover:bg-slate-100 hover:text-ink dark:hover:bg-white/5")}>
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
