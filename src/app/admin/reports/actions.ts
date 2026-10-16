"use server";
import { revalidatePath } from "next/cache";
import { run, type SAResult } from "@/server/action";
import { adminUser, adminUserStepUp } from "@/server/admin";
import { moderateContent, moderateUser, reportTargetOwner, resolveReport, type ContentType, type UserAction } from "@/server/services/moderation";
import { useDb, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { fail, ok, isUuid } from "@/server/util";
import { hasPermission } from "@/server/auth/guard";

const CONTENT: ContentType[] = ["post", "comment", "trip", "product", "service", "company", "shop", "group"];

export async function reportAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    let admin = await adminUser("reports.manage");
    const id = String(fd.get("id"));
    if (!isUuid(id)) return fail("Invalid report.");
    const db = await useDb();
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
    if (!rep) return fail("Report not found.");
    const action = String(fd.get("action"));
    const notes = String(fd.get("notes") ?? "").trim();
    const reason = notes || String(fd.get("reason") ?? "") || rep.reason;
    if (action === "remove_content") {
      if (!CONTENT.includes(rep.entityType as ContentType)) return fail("This item type cannot be removed from here.");
      if (!(await hasPermission(admin, "content.moderate"))) return fail("You need content moderation access.");
      await moderateContent(admin.id, rep.entityType as ContentType, rep.entityId, "remove", reason);
      await resolveReport(admin.id, id, { status: "resolved", resolution: "Content removed", notes, action });
    } else if (["warn", "restrict", "suspend", "ban"].includes(action)) {
      if (!(await hasPermission(admin, "users.suspend"))) return fail("You need user suspension access.");
      if (action === "ban") admin = await adminUserStepUp("users.suspend", `/admin/reports/${id}`);
      const owner = await reportTargetOwner(rep.entityType, rep.entityId);
      if (!owner) return fail("The reported item no longer exists.");
      await moderateUser(admin.id, owner, action as UserAction, reason, 7);
      await resolveReport(admin.id, id, { status: "resolved", resolution: `User ${action}`, notes, action });
    } else if (action === "dismiss") {
      await resolveReport(admin.id, id, { status: "dismissed", resolution: "No violation found", notes, action });
    } else if (action === "reviewing" || action === "appealed") {
      await resolveReport(admin.id, id, { status: action, notes, assignToMe: true, action });
    } else if (action === "note") {
      await resolveReport(admin.id, id, { status: rep.status as "reviewing", notes, action: "note" });
    } else return fail("Choose an action.");
    revalidatePath("/admin/reports"); revalidatePath(`/admin/reports/${id}`);
    return ok(undefined, "Report updated.");
  });
}
