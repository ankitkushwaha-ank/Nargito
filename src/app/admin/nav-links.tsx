"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function AdminNavLinks({ groups, onNavigate }: { groups: { label: string; items: { label: string; href: string }[] }[]; onNavigate?: () => void }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav className="space-y-1 text-sm" aria-label="Admin sections">
      {groups.map((g) => {
        const hasActive = g.items.some((i) => active(i.href));
        return (
          <details key={g.label} open={hasActive || g.label === "Overview"} className="group rounded-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              {g.label}<span className="text-base leading-none transition-transform group-open:rotate-90" aria-hidden>›</span>
            </summary>
            <ul className="mb-2 space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}><Link href={i.href} onClick={onNavigate} aria-current={active(i.href) ? "page" : undefined} className={cn("block rounded-lg px-3 py-2 text-[14px] transition-colors", active(i.href) ? "bg-primary-tint font-semibold text-primary" : "text-ink/75 hover:bg-primary-tint/60 hover:text-ink")}>{i.label}</Link></li>
              ))}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}
