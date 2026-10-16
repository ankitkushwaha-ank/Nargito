"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guard";
import { markRead } from "@/server/services/notify";
import { safeRedirectPath, isUuid } from "@/server/util";

export async function openNotificationAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (isUuid(id)) await markRead(user.id, id);
  const link = safeRedirectPath(fd.get("link"), "/notifications");
  revalidatePath("/notifications");
  redirect(link);
}

export async function markAllReadAction() {
  const user = await requireUser();
  await markRead(user.id);
  revalidatePath("/notifications");
}
