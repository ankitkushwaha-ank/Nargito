"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type SideLink = { href: string; label: string; icon: React.ReactNode; match?: string[] };

export function SideLinks({ links }: { links: SideLink[] }) {
  const path = usePathname();
  return (
    <ul className="space-y-0.5">
      {links.map((l) => {
        const roots = l.match ?? [l.href];
        const active = roots.some((m) => path === m || path.startsWith(m + "/"));
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors",
                active ? "bg-primary-tint font-semibold text-primary" : "text-ink/75 hover:bg-primary-tint/60 hover:text-ink",
              )}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden />}
              <span className="shrink-0" aria-hidden>{l.icon}</span>
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
