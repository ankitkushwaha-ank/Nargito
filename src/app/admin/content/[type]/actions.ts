"use server";
import { revalidatePath } from "next/cache";
import { adminUser } from "@/server/admin";
import { moderateContent, type ContentType } from "@/server/services/moderation";

const TYPES = ["post", "trip", "product", "service", "company", "shop", "group", "comment"];

export async function contentAction(fd: FormData) {
  const admin = await adminUser("content.moderate");
  const type = String(fd.get("type")); const op = String(fd.get("op")) === "restore" ? "restore" : "remove";
  if (!TYPES.includes(type)) return;
  await moderateContent(admin.id, type as ContentType, String(fd.get("id")), op, String(fd.get("reason") ?? ""));
  revalidatePath("/admin/content", "layout");
}
