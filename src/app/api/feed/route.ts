import { api } from "@/server/api";
import { getSessionUser } from "@/server/auth/session";
import { getFeed, type FeedTab } from "@/server/services/posts";
import { requireFeature } from "@/server/features";
import { getSponsored } from "@/server/services/promotions";

export const dynamic = "force-dynamic";
const TABS = ["all", "following", "discover", "trips", "listings"];

export const GET = api(async (req) => {
  await requireFeature("posts");
  const user = await getSessionUser();
  const sp = req.nextUrl.searchParams;
  const tab = (TABS.includes(sp.get("tab") ?? "") ? sp.get("tab") : "all") as FeedTab;
  const sort = sp.get("sort") === "relevant" ? "relevant" : "recent";
  const authorId = sp.get("author") ?? undefined;
  const groupId = sp.get("group") ?? undefined;
  const companyId = sp.get("company") ?? undefined;
  const shopId = sp.get("shop") ?? undefined;
  const feed = await getFeed(user?.id ?? null, { tab, sort, cursor: sp.get("cursor"), authorId, groupId, companyId, shopId });
  const sponsored = !sp.get("cursor") && !authorId && !groupId && !companyId && !shopId ? await getSponsored(user?.id ?? null, "feed", 1) : [];
  return { ok: true, items: feed.items, nextCursor: feed.nextCursor, sponsored };
});
