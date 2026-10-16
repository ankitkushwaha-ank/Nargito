import Link from "next/link";
import { Bookmark, Crown, FileText, Users, Plane, ShoppingBag, Building2, UsersRound, Settings, User as UserIcon, Megaphone, Check } from "lucide-react";
import type { SessionUser } from "@/server/auth/session";
import { profileCompletion } from "@/server/services/social";
import { Avatar, VerifiedBadge } from "@/components/ui/kit";
import { getT } from "@/i18n/server";
import { isFeatureEnabled } from "@/server/features";
import { activeSubscription } from "@/server/services/pro";
import { SideLinks, type SideLink } from "./side-links";

export async function LeftSidebar({ user }: { user: SessionUser }) {
  const t = await getT();
  const [saved, trips, products, companies, groups, promos, pro] = await Promise.all([
    isFeatureEnabled("saved"), isFeatureEnabled("trips"), isFeatureEnabled("products"), isFeatureEnabled("companies"), isFeatureEnabled("groups"), isFeatureEnabled("promotions"), isFeatureEnabled("pro"),
  ]);
  const pct = profileCompletion(user);
  const isPro = pro ? !!(await activeSubscription(user.id)) : false;
  const i = 20;
  const links: (SideLink & { show: boolean })[] = [
    { href: `/profile/${user.username}`, icon: <UserIcon size={i} />, label: t("side.myProfile"), show: true },
    { href: "/my/trips", icon: <Plane size={i} />, label: t("side.trips"), show: trips },
    { href: "/my/posts", icon: <FileText size={i} />, label: t("side.posts"), show: true },
    { href: "/my/listings", icon: <ShoppingBag size={i} />, label: t("side.listings"), show: products },
    { href: "/my/businesses", icon: <Building2 size={i} />, label: t("side.businesses"), show: companies },
    { href: "/my/groups", icon: <UsersRound size={i} />, label: t("side.groups"), show: groups },
    { href: "/saved", icon: <Bookmark size={i} />, label: t("side.saved"), show: saved },
    { href: "/connections", icon: <Users size={i} />, label: t("side.connections"), show: true },
    { href: "/my/ads", icon: <Megaphone size={i} />, label: t("side.ads"), show: promos },
    { href: "/settings/profile", icon: <Settings size={i} />, label: t("nav.settings"), match: ["/settings"], show: true },
  ];
  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary to-sky-400" aria-hidden style={user.coverUrl ? { backgroundImage: `url(${user.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundImage: "url(/api/brand/cover)", backgroundSize: "cover", backgroundPosition: "70% 40%" }} />
        <div className="relative px-5 pb-5">
          <Link href={`/profile/${user.username}`} className="-mt-11 block w-fit rounded-full ring-4 ring-surface"><Avatar name={user.displayName} src={user.avatarUrl} size={80} /></Link>
          <Link href={`/profile/${user.username}`} className="mt-2.5 flex items-center gap-1.5 text-lg font-bold hover:underline">{user.displayName}{user.verified && <VerifiedBadge />}</Link>
          <p className="text-sm text-muted">@{user.username}</p>
          {user.headline && <p className="mt-1 text-sm text-ink/70">{user.headline}</p>}
          {pct < 100 ? (
            <div className="mt-4 rounded-xl bg-bg p-3">
              <div className="flex justify-between text-xs font-medium text-muted"><span>{t("side.completion")}</span><span className="font-semibold text-ink">{pct}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("side.completion")}><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              <Link href="/settings/profile" className="link mt-2 inline-block text-xs font-semibold">Complete your profile</Link>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-success"><Check size={14} aria-hidden />Profile complete</p>
          )}
        </div>
      </section>
      <nav aria-label="Your Nargito" className="card p-2.5">
        <SideLinks links={links.filter((l) => l.show).map(({ show: _s, ...l }) => l)} />
      </nav>
      {pro && !isPro && (
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-500"><Crown size={24} aria-hidden /></span>
            <div><h2 className="text-[15px] font-bold leading-tight">Unlock more with Nargito Plus</h2>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                <li className="flex items-center gap-1.5"><Check size={12} className="text-primary" aria-hidden />Boost your profile</li>
                <li className="flex items-center gap-1.5"><Check size={12} className="text-primary" aria-hidden />Get verified badge</li>
                <li className="flex items-center gap-1.5"><Check size={12} className="text-primary" aria-hidden />More visibility</li>
              </ul>
            </div>
          </div>
          <Link href="/pricing" className="btn-primary mt-4 w-full">Upgrade now</Link>
        </section>
      )}
    </div>
  );
}
