import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { startEnquiry } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireActiveUser();
  const b = await readJson(req, z.object({ listingType: z.string(), listingId: z.string().uuid(), message: z.string().max(2000).optional() }));
  const r = await startEnquiry(user.id, b);
  return r.ok ? { ok: true, conversationId: r.data?.conversationId, message: r.message } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
