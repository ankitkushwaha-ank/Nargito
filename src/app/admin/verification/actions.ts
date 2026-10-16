"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { audit } from "@/server/log";
import { notify } from "@/server/services/notify";
import { isUuid } from "@/server/util";

const REASONS = ["document_unclear", "document_mismatch", "insufficient_evidence", "suspected_fraud", "other"];

export async function decideVerificationAction(fd: FormData) {
  const admin = await adminUser("verification.manage");
  const id = String(fd.get("id"));
  const decision = String(fd.get("decision"));
  if (!isUuid(id) || !["approved", "rejected", "more_info"].includes(decision)) return;
  const db = await useDb();
  const [r] = await db.select().from(schema.verificationRequests).where(eq(schema.verificationRequests.id, id));
  if (!r || !["pending", "more_info"].includes(r.status)) return;
  if (r.userId === admin.id) return; // reviewers cannot approve their own request
  const reasonCode = REASONS.includes(String(fd.get("reasonCode"))) ? String(fd.get("reasonCode")) : null;
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  if (decision !== "approved" && !note && !reasonCode) return;
  await db.update(schema.verificationRequests).set({ status: decision, reasonCode, reviewerNote: note || null, reviewerId: admin.id, decidedAt: decision === "more_info" ? null : new Date() }).where(eq(schema.verificationRequests.id, id));
  if (decision === "approved") {
    if (r.kind === "user") await db.update(schema.users).set({ verified: true }).where(eq(schema.users.id, r.userId));
    else if (r.kind === "company" && r.entityId) await db.update(schema.companies).set({ verified: true }).where(eq(schema.companies.id, r.entityId));
    else if (r.kind === "shop" && r.entityId) await db.update(schema.shops).set({ verified: true }).where(eq(schema.shops.id, r.entityId));
  }
  await audit(admin.id, `verification.${decision}`, "verification", id, { kind: r.kind, reasonCode });
  await notify({ userId: r.userId, type: "verification", title: decision === "approved" ? "Your verification was approved" : decision === "rejected" ? "Your verification request was not approved" : "More information needed for your verification", body: note || undefined, link: r.kind === "user" ? "/settings/profile" : "/my/businesses", dedupeKey: `ver:${id}:${decision}` });
  revalidatePath("/admin/verification");
}
