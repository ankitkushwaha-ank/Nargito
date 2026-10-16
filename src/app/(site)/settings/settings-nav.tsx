"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

const ITEMS = ["profile", "account", "privacy", "security", "notifications", "appearance", "language", "location"];

export function SettingsNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav aria-label="Settings" className="min-w-0 md:sticky md:top-20 md:self-start">
      <ul className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {ITEMS.map((i) => (
          <li key={i}><Link href={`/settings/${i}`} aria-current={path === `/settings/${i}` ? "page" : undefined} className={cn("block whitespace-nowrap rounded-lg px-3 py-2 text-sm", path === `/settings/${i}` ? "bg-primary-tint font-medium text-primary" : "text-muted hover:bg-primary-tint hover:text-ink")}>{t(`settings.${i}`)}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
