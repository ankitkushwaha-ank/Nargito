import Link from "next/link";
import { Compass, Plane, SlidersHorizontal, Tag, UserRoundCheck } from "lucide-react";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { Composer } from "@/components/social/composer";
import { FeedList } from "@/components/social/feed-list";
import { FeatureGate } from "@/components/ui/feature-gate";
import { getFeed, type FeedTab } from "@/server/services/posts";
import { getSponsored } from "@/server/services/promotions";
import { getSettings } from "@/server/settings";
import { isFeatureEnabled } from "@/server/features";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/ui/kit";

export const metadata = { title: "Home" };
const TABS: { id: FeedTab; key: string; icon?: typeof Compass }[] = [{ id: "all", key: "feed.all" }, { id: "following", key: "feed.following", icon: UserRoundCheck }, { id: "discover", key: "feed.discover", icon: Compass }, { id: "trips", key: "feed.trips", icon: Plane }, { id: "listings", key: "feed.listings", icon: Tag }];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/home");
  const sp = await searchParams;
  const tab = (TABS.some((x) => x.id === sp.tab) ? sp.tab : "all") as FeedTab;
  const sort = sp.sort === "relevant" ? "relevant" : "recent";
  const t = await getT();
  const s = await getSettings();
  const [trips, products, services, companies] = await Promise.all(["trips", "products", "services", "companies"].map(isFeatureEnabled));
  let feed: Awaited<ReturnType<typeof getFeed>> | null = null;
  let failed = false;
  try { feed = await getFeed(user.id, { tab, sort }); } catch { failed = true; }
  const sponsored = await getSponsored(user.id, "feed", 3);
  const query = `tab=${tab}&sort=${sort}`;
  return (
    <FeatureGate feature="posts">
      <ThreeColumn user={user}>
        {sp.denied && <div role="alert" className="card border-danger/40 p-3 text-sm text-danger">You do not have access to that area.</div>}
        <div id="composer">
          <Composer user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }} enabled={{ trips, products, services, companies }}
            limits={{ maxLength: Number(s["posts.maxLength"]), maxMedia: Math.min(Number(s["posts.maxMediaPerPost"]), Number(s["upload.maxFilesPerPost"])), allowPolls: Boolean(s["posts.allowPolls"]) && (await isFeatureEnabled("polls")), allowVideo: Boolean(s["posts.allowVideo"]), allowDocs: Boolean(s["posts.allowDocuments"]), defaultVisibility: String(s["posts.defaultVisibility"]) }} />
        </div>
        <nav aria-label="Feed filters" className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {TABS.map((x) => { const I = x.icon; return <Link key={x.id} href={`/home?tab=${x.id}&sort=${sort}`} aria-current={tab === x.id ? "page" : undefined} className={cn("chip", tab === x.id && "chip-active")}>{I && <I size={18} aria-hidden />}{t(x.key)}</Link>; })}
        </nav>
        <div className="flex items-center justify-between border-b border-line" role="group" aria-label="Sort">
          <div className="flex gap-6">
            <Link href={`/home?tab=${tab}&sort=recent`} aria-current={sort === "recent" ? "true" : undefined} className={cn("-mb-px border-b-2 px-1 py-3 text-[15px] font-semibold", sort === "recent" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>{t("feed.recent")}</Link>
            <Link href={`/home?tab=${tab}&sort=relevant`} aria-current={sort === "relevant" ? "true" : undefined} className={cn("-mb-px border-b-2 px-1 py-3 text-[15px] font-semibold", sort === "relevant" ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>{t("feed.relevant")}</Link>
          </div>
          <Link href="/search" aria-label="Filters" className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink/70 hover:text-primary"><SlidersHorizontal size={18} aria-hidden /></Link>
        </div>        {failed || !feed ? (
          <ErrorState title="We couldn't load your feed" description="Please try again in a moment." action={<Link href={`/home?tab=${tab}`} className="btn-secondary">{t("common.retry")}</Link>} />
        ) : (
          <FeedList key={`${query}:${feed.items[0]?.id ?? "none"}:${feed.items.length}`} initialItems={feed.items} initialCursor={feed.nextCursor} query={query} sponsored={sponsored} sponsoredEvery={Number(s["feed.sponsoredEvery"])} />
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
