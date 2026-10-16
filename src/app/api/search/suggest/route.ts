import { api } from "@/server/api";
import { getSessionUser } from "@/server/auth/session";
import { suggest } from "@/server/services/search";
import { requireFeature } from "@/server/features";

export const dynamic = "force-dynamic";

export const GET = api(async (req) => {
  await requireFeature("search");
  const u = await getSessionUser();
  const items = await suggest(u?.id ?? null, req.nextUrl.searchParams.get("q") ?? "");
  return { ok: true, items };
}, { limitPerMinute: 120 });
