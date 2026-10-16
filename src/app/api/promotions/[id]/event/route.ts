import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { getSessionUser } from "@/server/auth/session";
import { recordPromotionEvent } from "@/server/services/promotions";
import { requestMeta } from "@/server/log";
import { sha256, isUuid, AppError } from "@/server/util";

export const dynamic = "force-dynamic";

export const POST = api<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new AppError(404, "Not found");
  const { type } = await readJson(req, z.object({ type: z.enum(["impression", "click"]) }));
  const u = await getSessionUser();
  const rm = await requestMeta();
  // De-duplicated per viewer per day; the viewer key is a hash, never a raw IP.
  await recordPromotionEvent(id, type, u ? `u:${u.id}` : `ip:${sha256(rm.ip + (rm.userAgent ?? "")).slice(0, 24)}`);
  return { ok: true };
}, { limitPerMinute: 120 });
