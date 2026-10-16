"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guard";
import { clearRecentSearches } from "@/server/services/search";

export async function clearRecentAction() {
  const u = await requireUser();
  await clearRecentSearches(u.id);
  revalidatePath("/search");
}
