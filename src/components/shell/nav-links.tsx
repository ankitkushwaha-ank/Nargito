"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, MessageSquare, Plane, Store, Users } from "lucide-react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

type Counts = { notifications: number; messages: number; requests: number };
type Item = { href: string; key: string; fallback?: string; icon: typeof Home; match: string[]; count?: keyof Counts };

const TOP: Item[] = [
  { href: "/home", key: "nav.home", icon: Home, match: ["/home", "/feed"] },
  { href: "/explore", key: "nav.explore", icon: Compass, match: ["/explore", "/search"] },
  { href: "/trips", key: "nav.trips", fallback: "Trips", icon: Plane, match: ["/trips", "/my/trips"] },
  { href: "/products", key: "nav.marketplace", fallback: "Marketplace", icon: Store, match: ["/products", "/services", "/shops", "/companies", "/my/listings", "/my/businesses"] },
  { href: "/messages", key: "nav.messages", icon: MessageSquare, match: ["/messages"], count: "messages" },
  { href: "/notifications", key: "nav.notifications", icon: Bell, match: ["/notifications"], count: "notifications" },
];
const BOTTOM: Item[] = [
  { href: "/home", key: "nav.home", icon: Home, match: ["/home", "/feed"] },
  { href: "/explore", key: "nav.explore", icon: Compass, match: ["/explore", "/search", "/trips", "/products", "/services"] },
  { href: "/connections", key: "nav.connections", icon: Users, match: ["/connections", "/people"], count: "requests" },
  { href: "/messages", key: "nav.messages", icon: MessageSquare, match: ["/messages"], count: "messages" },
  { href: "/notifications", key: "nav.notifications", icon: Bell, match: ["/notifications"], count: "notifications" },
];

function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-2.5 -top-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white ring-2 ring-surface">
      <span className="sr-only">{n} unread</span>
      <span aria-hidden>{n > 99 ? "99+" : n}</span>
    </span>
  );
}

export function NavLinks({ counts, mobile }: { counts: Counts; mobile?: boolean }) {
  const path = usePathname();
  const t = useT();
  const items = mobile ? BOTTOM : TOP;
  const label = (i: Item) => { const v = t(i.key); return v === i.key ? (i.fallback ?? v) : v; };
  return (
    <ul className={cn("flex items-center", mobile ? "justify-between gap-1" : "gap-0.5")}>
      {items.map((it) => {
        const active = it.match.some((m) => path === m || path.startsWith(m + "/"));
        const Icon = it.icon;
        return (
          <li key={it.href} className={mobile ? "flex-1" : undefined}>
            <Link
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 font-medium transition-colors",
                mobile
                  ? cn("rounded-2xl px-1 py-2 text-[12px]", active ? "bg-primary-tint text-primary" : "text-muted")
                  : cn("rounded-lg px-3 pb-2.5 pt-1.5 text-[12px]", active ? "text-primary" : "text-muted hover:text-ink"),
              )}
            >
              <span className="relative"><Icon size={mobile ? 24 : 22} strokeWidth={active ? 2.4 : 1.9} aria-hidden /><CountBadge n={it.count ? counts[it.count] : 0} /></span>
              <span className={mobile ? "" : "hidden xl:block"}>{label(it)}</span>
              {active && !mobile && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-primary" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const GUEST: { href: string; label: string }[] = [
  { href: "/explore", label: "Explore" },
  { href: "/trips", label: "Trips" },
  { href: "/products", label: "Marketplace" },
  { href: "/groups", label: "Groups" },
  { href: "/services", label: "Services" },
];

export function GuestLinks() {
  const path = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {GUEST.map((g) => {
        const active = path === g.href || path.startsWith(g.href + "/");
        return (
          <li key={g.href}>
            <Link href={g.href} aria-current={active ? "page" : undefined} className={cn("relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors", active ? "text-primary" : "text-ink/80 hover:text-primary")}>
              {g.label}
              {active && <span className="absolute inset-x-3 -bottom-[15px] h-[3px] rounded-t-full bg-primary" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
