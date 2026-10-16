import { api } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { toggleLike } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const POST = api<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return { ok: true, ...(await toggleLike(user.id, id)) };
});
