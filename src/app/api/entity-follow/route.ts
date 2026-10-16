import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { toggleEntityFollow } from "@/server/services/business";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireActiveUser();
  const b = await readJson(req, z.object({ type: z.enum(["company", "shop"]), id: z.string().uuid() }));
  return { ok: true, ...(await toggleEntityFollow(user.id, b.type, b.id)) };
});
