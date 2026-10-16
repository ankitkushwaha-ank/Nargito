import { NextResponse, type NextRequest } from "next/server";
import { handleStripeEvent, paymentsStatus, verifyStripeSignature } from "@/server/services/pro";
import { logSystem } from "@/server/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe webhook. Rejects everything unless STRIPE_WEBHOOK_SECRET is set and the signature verifies. */
export async function POST(req: NextRequest) {
  if (!paymentsStatus().stripe) return NextResponse.json({ ok: false, error: "Payments are not configured." }, { status: 501 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET!)) {
    await logSystem("warn", "api", "billing-webhook", "Invalid webhook signature");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(JSON.parse(payload));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await logSystem("error", "api", "billing-webhook", e instanceof Error ? e.message : "webhook failure");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
