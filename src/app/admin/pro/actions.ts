"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { checkApproval } from "@/server/approvals";
import { run, type SAResult } from "@/server/action";
import { adminUser, adminUserStepUp } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { fail, ok, isUuid, slugify } from "@/server/util";
import { audit } from "@/server/log";
import { issueRefund } from "@/server/services/pro";
import { PRO_FEATURES } from "@/lib/pro-features";
import { notify } from "@/server/services/notify";

export async function savePlanAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const admin = await adminUserStepUp("pro.manage", "/admin/pro/config");
    const id = String(fd.get("id") ?? "");
    const name = String(fd.get("name") ?? "").trim().slice(0, 60);
    if (!name) return fail("Enter a plan name.", { name: "Required" });
    const price = Math.round(Number(fd.get("price") ?? 0) * 100);
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) return fail("Invalid price.", { price: "Invalid" });
    const features = fd.getAll("features").map(String).filter((f) => PRO_FEATURES.some((x) => x.key === f));
    const vals = { name, description: String(fd.get("description") ?? "").slice(0, 300) || null, priceCents: price, currency: String(fd.get("currency") ?? "INR").slice(0, 3).toUpperCase(), interval: fd.get("interval") === "year" ? "year" : "month", features, active: fd.get("active") === "on" };
    const db = await useDb();
    if (isUuid(id)) await db.update(schema.subscriptionPlans).set(vals).where(eq(schema.subscriptionPlans.id, id));
    else await db.insert(schema.subscriptionPlans).values({ ...vals, key: slugify(name, 30) + "-" + Math.random().toString(36).slice(2, 5) });
    await audit(admin.id, isUuid(id) ? "plan.update" : "plan.create", "plan", id || name, { priceCents: price });
    revalidatePath("/admin/pro", "layout");
    return ok(undefined, "Plan saved.");
  });
}

export async function grantMembershipAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const admin = await adminUserStepUp("pro.manage", "/admin/pro/members");
    const username = String(fd.get("username") ?? "").trim().replace(/^@/, "").toLowerCase(); const planId = String(fd.get("planId")); const days = Math.min(365, Math.max(1, Number(fd.get("days")) || 30));
    const db = await useDb();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    if (!u || !isUuid(planId)) return fail("User or plan not found.");
    // Complimentary grant: no payment record is created and revenue is unaffected.
    await db.insert(schema.subscriptions).values({ userId: u.id, planId, status: "active", provider: "admin", providerRef: `grant:${admin.id}`, expiresAt: new Date(Date.now() + days * 86400_000) });
    await audit(admin.id, "membership.grant", "user", u.id, { planId, days });
    await notify({ userId: u.id, type: "announcement", title: "You were granted a Pro membership", link: "/pricing", dedupeKey: `grant:${u.id}:${Date.now()}` });
    revalidatePath("/admin/pro/members");
    return ok(undefined, `Granted for ${days} days (complimentary, no payment recorded).`);
  });
}

export async function cancelMembershipAction(fd: FormData) {
  const admin = await adminUserStepUp("pro.manage", "/admin/pro/members");
  const id = String(fd.get("id"));
  if (!isUuid(id)) return;
  const db = await useDb();
  await db.update(schema.subscriptions).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(schema.subscriptions.id, id));
  await audit(admin.id, "membership.cancel", "subscription", id);
  revalidatePath("/admin/pro/members");
}

export async function requestRefundAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const admin = await adminUser("pro.manage");
    const paymentId = String(fd.get("paymentId")); const reason = String(fd.get("reason") ?? "").slice(0, 300);
    const db = await useDb();
    const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId));
    if (!pay || pay.status === "refunded") return fail("This payment cannot be refunded.");
    const amount = Math.round(Number(fd.get("amount") ?? pay.amountCents / 100) * 100);
    if (!(amount > 0 && amount <= pay.amountCents)) return fail("Refund amount must be between 0 and the payment amount.");
    await db.insert(schema.refunds).values({ paymentId, amountCents: amount, reason, status: "requested" });
    await audit(admin.id, "refund.request", "payment", paymentId, { amount });
    revalidatePath("/admin/pro/refunds");
    return ok(undefined, "Refund requested. A second approver is required before it is processed.");
  });
}

export async function decideRefundAction(fd: FormData) {
  const admin = await adminUserStepUp("pro.manage", "/admin/pro/refunds");
  const id = String(fd.get("id")); const op = String(fd.get("op"));
  const db = await useDb();
  const [r] = await db.select().from(schema.refunds).where(eq(schema.refunds.id, id));
  if (!r) return;
  if (op === "reject" && r.status === "requested") await db.update(schema.refunds).set({ status: "rejected", decidedBy: admin.id }).where(eq(schema.refunds.id, id));
  if (op === "approve" && r.status === "requested") {
    // Two-person rule: another administrator must approve in Security > Approvals before this proceeds.
    if ((await checkApproval(admin.id, `refund:${id}`, { amountCents: r.amountCents })) === "pending") redirect("/admin/pro/refunds?notice=awaiting-approval");
    await db.update(schema.refunds).set({ status: "approved", decidedBy: admin.id }).where(eq(schema.refunds.id, id));
  }
  if (op === "process" && r.status === "approved") {
    const res = await issueRefund(admin.id, id);
    if (!res.ok) redirect(`/admin/pro/refunds?error=${encodeURIComponent(res.error)}`);
  }
  await audit(admin.id, `refund.${op}`, "refund", id);
  revalidatePath("/admin/pro/refunds");
}
