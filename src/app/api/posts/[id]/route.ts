import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser, requireUser } from "@/server/auth/guard";
import { deletePost, updatePost } from "@/server/services/posts";

export const dynamic = "force-dynamic";
const patch = z.object({ body: z.string().max(20000), visibility: z.string().optional(), commentsEnabled: z.boolean().optional(), publish: z.boolean().optional() });

export const PATCH = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const r = await updatePost(user.id, id, await readJson(req, patch));
  return r.ok ? { ok: true, message: r.message } : Response.json({ ok: false, error: r.error }, { status: 400 });
});

export const DELETE = api<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deletePost(user, id);
  return { ok: true };
});
