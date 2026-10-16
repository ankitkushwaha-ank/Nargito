"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = { head: string; dot: string; active: string };
// Literal class names so Tailwind keeps them. One colour per section.
const TONES: Record<string, Tone> = {
  Overview: { head: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", dot: "bg-blue-500", active: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  Content: { head: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300", dot: "bg-violet-500", active: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  Users: { head: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500", active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  Communication: { head: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300", dot: "bg-sky-500", active: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  Monetization: { head: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500", active: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  Configuration: { head: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300", dot: "bg-indigo-500", active: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  Operations: { head: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300", dot: "bg-orange-500", active: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  Security: { head: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", dot: "bg-rose-500", active: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};
const FALLBACK: Tone = { head: "bg-bg text-muted", dot: "bg-slate-400", active: "bg-primary-tint text-primary" };

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
        const tone = TONES[g.label] ?? FALLBACK;
        const isOpen = open === g.label;
        const id = `admin-nav-${g.label.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <div key={g.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={id}
              onClick={() => setOpen(isOpen ? null : g.label)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors", tone.head, !isOpen && "opacity-80 hover:opacity-100")}
            >
              <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", tone.dot)} aria-hidden />{g.label}</span>
              <ChevronRight size={16} aria-hidden className={cn("transition-transform duration-200", isOpen && "rotate-90")} />
            </button>
            {isOpen && (
              <ul id={id} className="mb-2 mt-1 space-y-0.5 border-l-2 border-line pl-2 ml-3">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} onClick={onNavigate} aria-current={active(i.href) ? "page" : undefined}
                      className={cn("block rounded-lg px-3 py-2 text-[14px] transition-colors", active(i.href) ? cn("font-semibold", tone.active) : "text-ink/75 hover:bg-bg hover:text-ink")}>
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
