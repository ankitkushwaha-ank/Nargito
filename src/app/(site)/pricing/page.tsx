import { eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { useDb, schema } from "@/server/db";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Badge, Notice, PageHeader } from "@/components/ui/kit";
import { activeSubscription, paymentsAvailable } from "@/server/services/pro";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { CheckoutButton } from "./checkout-button";

export const metadata = { title: "Pricing", description: "Nargito plans" };

const LABELS: Record<string, string> = { "pro.badge": "Pro badge on your profile", "pro.analytics": "Extended listing analytics", "pro.extra_listings": "Higher listing limits", "pro.priority_support": "Priority support", "pro.team_seats": "Extra team seats" };

export default async function Pricing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getSessionUser();
  const db = await useDb();
  const plans = await db.select().from(schema.subscriptionPlans).where(eq(schema.subscriptionPlans.active, true)).orderBy(schema.subscriptionPlans.priceCents);
  const [sub, payOn, locale] = await Promise.all([viewer ? activeSubscription(viewer.id) : null, paymentsAvailable(), getLocale()]);
  return (
    <FeatureGate feature="pro">
      <Container width="max-w-5xl">
        <PageHeader title="Plans & pricing" description="Everything essential is free. Paid plans add tools for creators and businesses." />
        {sp.status === "success" && <div className="mb-4"><Notice tone="success">Thanks! Your membership activates as soon as the payment provider confirms it.</Notice></div>}
        {sp.status === "cancelled" && <div className="mb-4"><Notice>Checkout was cancelled. You have not been charged.</Notice></div>}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = sub?.p.id === p.id || (!sub && p.key === "free");
            return (
              <section key={p.id} className="card flex flex-col p-5" aria-labelledby={`plan-${p.key}`}>
                <h2 id={`plan-${p.key}`} className="text-xl">{p.name} {current && <Badge tone="success">Current</Badge>}</h2>
                <p className="mt-1 text-sm text-muted">{p.description}</p>
                <p className="mt-4 text-3xl font-semibold">{p.priceCents ? formatMoney(p.priceCents / 100, p.currency, locale) : "Free"}{p.priceCents ? <span className="text-sm font-normal text-muted"> / {p.interval}</span> : null}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 text-success" aria-hidden />Profile, posts, trips, messaging</li>
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 text-success" aria-hidden />{LABELS[f] ?? f}</li>)}
                </ul>
                <div className="mt-5">{p.priceCents === 0 ? null : current ? null : viewer ? (payOn ? <CheckoutButton plan={p.key} /> : <a className="btn-secondary w-full" href="/contact">Contact us to upgrade</a>) : <a className="btn-primary w-full" href="/login?next=/pricing">Sign in to upgrade</a>}</div>
              </section>
            );
          })}
        </div>
      </Container>
    </FeatureGate>
  );
}
