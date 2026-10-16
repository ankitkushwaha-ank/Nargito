import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { sharePost } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const POST = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const { comment } = await readJson(req, z.object({ comment: z.string().max(1000).default("") }));
  const r = await sharePost(user.id, id, comment);
  return r.ok ? { ok: true, id: r.data?.id, message: r.message } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
