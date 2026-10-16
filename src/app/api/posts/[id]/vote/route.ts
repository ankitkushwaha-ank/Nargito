import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { votePoll } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const POST = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const { option } = await readJson(req, z.object({ option: z.number().int().min(0).max(5) }));
  await votePoll(user.id, id, option);
  return { ok: true };
});
