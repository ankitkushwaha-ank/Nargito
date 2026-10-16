import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireUser } from "@/server/auth/guard";
import { setEnquiryStatus } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export const PATCH = api<{ id: string }>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { status } = await readJson(req, z.object({ status: z.enum(["new", "responded", "closed"]) }));
  await setEnquiryStatus(user.id, id, status);
  return { ok: true };
});
