import { api } from "@/server/api";
import { getSessionUser } from "@/server/auth/session";
import { search, SEARCH_TYPES, type SearchType } from "@/server/services/search";
import { requireFeature } from "@/server/features";
import { intParam } from "@/server/api-helpers";

export const dynamic = "force-dynamic";

export const GET = api(async (req) => {
  await requireFeature("search");
  const u = await getSessionUser();
  const sp = req.nextUrl.searchParams;
  const t = sp.get("type");
  const type = (SEARCH_TYPES as readonly string[]).includes(t ?? "") ? (t as SearchType) : "all";
  const r = await search(u?.id ?? null, { q: sp.get("q") ?? "", type, sort: sp.get("sort") === "newest" ? "newest" : "relevance", category: sp.get("category") ?? undefined, near: sp.get("near") === "1", page: intParam(req, "page", 1) });
  return { ok: true, ...r };
}, { limitPerMinute: 90 });
