import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { useDb, schema } from "../db";
import { AppError, ok, fail, type ActionResult } from "../util";
import { getSetting } from "../settings";
import { isFeatureEnabled } from "../features";
import { appUrl } from "../mail";
import { audit, logSystem } from "../log";
import { notify } from "./notify";

export function paymentsStatus() {
  return { stripe: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) };
}
export async function paymentsAvailable() {
  return (await getSetting<string>("payments.provider")) === "stripe" && paymentsStatus().stripe && (await isFeatureEnabled("pro")) && (await getSetting<boolean>("pro.enabled"));
}

export async function activeSubscription(userId: string) {
  const db = await useDb();
  const [row] = await db.select({ s: schema.subscriptions, p: schema.subscriptionPlans }).from(schema.subscriptions).innerJoin(schema.subscriptionPlans, eq(schema.subscriptionPlans.id, schema.subscriptions.planId))
    .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, "active"), or(isNull(schema.subscriptions.expiresAt), gt(schema.subscriptions.expiresAt, new Date())))).orderBy(desc(schema.subscriptions.startedAt)).limit(1);
  return row ?? null;
}

/** Server-side entitlement check. UI hints are never trusted for premium functionality. */
export async function hasEntitlement(userId: string, key: string) {
  if (!(await isFeatureEnabled("pro"))) return false;
  const sub = await activeSubscription(userId);
  return !!sub && sub.p.features.includes(key);
}

export async function createCheckout(userId: string, email: string, planKey: string): Promise<ActionResult<{ url: string }>> {
  if (!(await paymentsAvailable())) return fail("Payments are not configured on this server.");
  const db = await useDb();
  const [plan] = await db.select().from(schema.subscriptionPlans).where(and(eq(schema.subscriptionPlans.key, planKey), eq(schema.subscriptionPlans.active, true)));
  if (!plan || plan.priceCents <= 0) return fail("That plan is not available for purchase.");
  const base = await appUrl();
  const body = new URLSearchParams({
    mode: "subscription", "success_url": `${base}/pricing?status=success`, "cancel_url": `${base}/pricing?status=cancelled`, customer_email: email, client_reference_id: userId,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": plan.currency.toLowerCase(), "line_items[0][price_data][unit_amount]": String(plan.priceCents),
    "line_items[0][price_data][recurring][interval]": plan.interval, "line_items[0][price_data][product_data][name]": `Nargito ${plan.name}`,
    "metadata[userId]": userId, "metadata[planKey]": plan.key,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) { await logSystem("error", "app", "billing", "Stripe checkout creation failed", { status: res.status }); return fail("Could not start checkout. Please try again later."); }
  const json = (await res.json()) as { url?: string };
  if (!json.url) return fail("Could not start checkout.");
  return ok({ url: json.url });
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts["t"]);
  const sig = parts["v1"];
  if (!t || !sig || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** Idempotent webhook processing: every provider event id is recorded once. */
export async function handleStripeEvent(ev: StripeEvent) {
  const db = await useDb();
  const seen = await db.insert(schema.billingEvents).values({ provider: "stripe", eventId: ev.id, type: ev.type }).onConflictDoNothing().returning();
  if (!seen.length) return { duplicate: true };
  const o = ev.data.object as Record<string, unknown> & { metadata?: Record<string, string> };
  if (ev.type === "checkout.session.completed") {
    const userId = o.metadata?.userId ?? (o.client_reference_id as string | undefined);
    const planKey = o.metadata?.planKey;
    if (!userId || !planKey) return { ignored: true };
    const [plan] = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.key, planKey));
    if (!plan) return { ignored: true };
    const [sub] = await db.insert(schema.subscriptions).values({ userId, planId: plan.id, status: "active", provider: "stripe", providerRef: String(o.subscription ?? o.id), expiresAt: new Date(Date.now() + (plan.interval === "year" ? 366 : 32) * 86400_000) }).returning();
    if (o.payment_status === "paid") {
      await db.insert(schema.payments).values({ userId, subscriptionId: sub!.id, amountCents: Number(o.amount_total ?? plan.priceCents), currency: String(o.currency ?? plan.currency).toUpperCase(), status: "succeeded", provider: "stripe", providerRef: String(o.payment_intent ?? o.id) }).onConflictDoNothing();
    }
    await notify({ userId, type: "announcement", title: `Welcome to Nargito ${plan.name}`, link: "/pricing", dedupeKey: `pro:${sub!.id}` });
  } else if (ev.type === "invoice.payment_succeeded") {
    const subRef = String(o.subscription ?? "");
    if (subRef) {
      const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerRef, subRef));
      if (sub) {
        await db.update(schema.subscriptions).set({ status: "active", expiresAt: new Date(Date.now() + 32 * 86400_000) }).where(eq(schema.subscriptions.id, sub.id));
        await db.insert(schema.payments).values({ userId: sub.userId, subscriptionId: sub.id, amountCents: Number(o.amount_paid ?? 0), currency: String(o.currency ?? "inr").toUpperCase(), status: "succeeded", provider: "stripe", providerRef: String(o.payment_intent ?? o.id) }).onConflictDoNothing();
      }
    }
  } else if (ev.type === "invoice.payment_failed") {
    const subRef = String(o.subscription ?? "");
    if (subRef) await db.update(schema.subscriptions).set({ status: "past_due" }).where(eq(schema.subscriptions.providerRef, subRef));
  } else if (ev.type === "customer.subscription.deleted") {
    await db.update(schema.subscriptions).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(schema.subscriptions.providerRef, String(o.id)));
  } else if (ev.type === "charge.refunded") {
    const pi = String(o.payment_intent ?? "");
    const [pay] = pi ? await db.select().from(schema.payments).where(eq(schema.payments.providerRef, pi)) : [];
    if (pay) {
      await db.insert(schema.refunds).values({ paymentId: pay.id, amountCents: Number(o.amount_refunded ?? 0), status: "processed", reason: "Refunded in payment provider", processedAt: new Date() });
      await db.update(schema.payments).set({ status: Number(o.amount_refunded) >= pay.amountCents ? "refunded" : "partially_refunded" }).where(eq(schema.payments.id, pay.id));
    }
  }
  return { processed: true };
}

/** Admin: request a refund through the provider. Only records "processed" after the provider confirms. */
export async function issueRefund(adminId: string, refundId: string): Promise<ActionResult> {
  const db = await useDb();
  const [r] = await db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId));
  if (!r || r.status !== "approved") throw new AppError(400, "Only approved refunds can be processed.");
  const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.id, r.paymentId));
  if (!pay) throw new AppError(404, "Payment not found.");
  if (pay.provider !== "stripe" || !paymentsStatus().stripe) return fail("The payment provider is not configured, so this refund cannot be processed automatically.");
  const res = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ payment_intent: pay.providerRef, amount: String(r.amountCents) }) });
  if (!res.ok) return fail(`The provider rejected the refund (HTTP ${res.status}).`);
  await db.update(schema.refunds).set({ status: "processed", processedAt: new Date() }).where(eq(schema.refunds.id, refundId));
  await db.update(schema.payments).set({ status: r.amountCents >= pay.amountCents ? "refunded" : "partially_refunded" }).where(eq(schema.payments.id, pay.id));
  await audit(adminId, "refund.process", "refund", refundId, { amountCents: r.amountCents });
  return ok(undefined, "Refund processed.");
}
