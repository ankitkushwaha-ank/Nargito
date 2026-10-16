import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireUser } from "@/server/auth/guard";
import { toggleSave } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { entityType, entityId } = await readJson(req, z.object({ entityType: z.string(), entityId: z.string() }));
  return { ok: true, ...(await toggleSave(user.id, entityType, entityId)) };
});
