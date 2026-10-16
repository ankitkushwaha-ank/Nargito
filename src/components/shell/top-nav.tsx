import Link from "next/link";
import { cookies } from "next/headers";
import { Bell, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SearchBox } from "./search-box";
import { NavLinks, GuestLinks } from "./nav-links";
import { AccountMenu, CreateMenu } from "./menus";
import { LocaleSwitch, ThemeToggle } from "./prefs-switchers";
import { getSessionUser } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/guard";
import { unreadNotificationCount } from "@/server/services/notify";
import { unreadMessageCount } from "@/server/services/messaging";
import { enabledLocales, getT } from "@/i18n/server";
import { isFeatureEnabled } from "@/server/features";
import { getSetting } from "@/server/settings";
import { useDb, schema } from "@/server/db";
import { and, eq, sql } from "drizzle-orm";
import { MobileBottomNav } from "./bottom-nav";

async function counts(userId: string) {
  const db = await useDb();
  const [notifications, messages, [req]] = await Promise.all([
    unreadNotificationCount(userId), unreadMessageCount(userId),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.connections).where(and(eq(schema.connections.addresseeId, userId), eq(schema.connections.status, "pending"))),
  ]);
  return { notifications, messages, requests: req?.n ?? 0 };
}

export async function TopNav() {
  const [user, t, locales, jar, defTheme] = await Promise.all([getSessionUser(), getT(), enabledLocales(), cookies(), getSetting<string>("design.defaultTheme")]);
  const theme = (["light", "dark", "system"].includes(jar.get("nargito_theme")?.value ?? "") ? jar.get("nargito_theme")!.value : defTheme) as "light" | "dark" | "system";
  const isAdmin = user ? await hasPermission(user, "admin.access") : false;
  const c = user ? await counts(user.id) : { notifications: 0, messages: 0, requests: 0 };
  const [searchOn, trips, products, services, companies, shops, groups, promotions] = await Promise.all(
    ["search", "trips", "products", "services", "companies", "shops", "groups", "promotions"].map(isFeatureEnabled),
  );
  const enabled = { trips, products, services, companies: companies || shops, groups, promotions };
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-white">{t("nav.skip")}</a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-shell items-center gap-3 px-4 sm:px-6">
          <Logo size={40} href={user ? "/home" : "/"} />
          {searchOn && <SearchBox className="ml-2 hidden max-w-[420px] flex-1 md:block" />}
          <div className="flex-1" />
          <nav aria-label="Primary" className="hidden md:block">{user ? <NavLinks counts={c} /> : <GuestLinks />}</nav>
          <div className="flex items-center gap-2.5 md:ml-2">
            {searchOn && <Link href="/search" aria-label={t("common.search")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line md:hidden"><Search size={18} aria-hidden /></Link>}
            {user && <Link href="/notifications" aria-label={t("nav.notifications")} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line md:hidden"><Bell size={18} aria-hidden />{c.notifications > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-surface">{c.notifications > 99 ? "99+" : c.notifications}</span>}</Link>}
            <span className="hidden md:block"><ThemeToggle /></span>
            {user ? (
              <>
                <span className="hidden md:block"><CreateMenu enabled={enabled} /></span>
                <AccountMenu user={{ displayName: user.displayName, username: user.username, avatarUrl: user.avatarUrl, headline: user.headline }} isAdmin={isAdmin} locales={locales} theme={theme} />
              </>
            ) : (
              <>
                <span className="hidden lg:block"><LocaleSwitch locales={locales} /></span>
                <Link href="/login" className="btn-secondary hidden sm:inline-flex">{t("nav.signIn")}</Link>
                <Link href="/register" className="btn-primary">{t("nav.join")}</Link>
              </>
            )}
          </div>
        </div>
        {user && !user.emailVerifiedAt && (
          <div className="border-t border-line bg-warn/10 px-4 py-1.5 text-center text-sm text-warn">
            Verify your email to post and message. <Link className="underline" href={`/verify-otp?email=${encodeURIComponent(user.email)}`}>Enter your code</Link>
          </div>
        )}
        {user && user.status !== "active" && (
          <div className="border-t border-line bg-danger/10 px-4 py-1.5 text-center text-sm text-danger" role="status">
            Your account is {user.status}. Some actions are unavailable.{user.statusReason ? ` Reason: ${user.statusReason}` : ""}
          </div>
        )}
      </header>
      {user && <MobileBottomNav counts={c} username={user.username} enabled={enabled} />}
    </>
  );
}
