import { api } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { toggleConversationMute } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export const POST = api<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return { ok: true, muted: await toggleConversationMute(user.id, id) };
});
