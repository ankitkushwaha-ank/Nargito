import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { createCheckout } from "@/server/services/pro";
import { requireFeature } from "@/server/features";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  await requireFeature("pro");
  const user = await requireActiveUser();
  const { plan } = await readJson(req, z.object({ plan: z.string().max(40) }));
  const r = await createCheckout(user.id, user.email, plan);
  return r.ok ? { ok: true, url: r.data?.url } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
