import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser, requireUser } from "@/server/auth/guard";
import { deleteComment, editComment } from "@/server/services/posts";

export const dynamic = "force-dynamic";

export const PATCH = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const { body } = await readJson(req, z.object({ body: z.string().max(10000) }));
  const r = await editComment(user.id, id, body);
  return r.ok ? { ok: true } : Response.json({ ok: false, error: r.error }, { status: 400 });
});

export const DELETE = api<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await deleteComment(user.id, id);
  return { ok: true };
});
