import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireUser } from "@/server/auth/guard";
import { reportEntity } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireUser();
  const b = await readJson(req, z.object({ entityType: z.string(), entityId: z.string(), reason: z.string(), details: z.string().max(1000).optional() }));
  const r = await reportEntity(user.id, b.entityType, b.entityId, b.reason, b.details);
  return r.ok ? { ok: true, message: r.message } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
