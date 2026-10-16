"use client";
import { useState } from "react";
import { callApi } from "@/lib/client-api";

export function CheckoutButton({ plan, disabled }: { plan: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="btn-primary w-full" disabled={disabled || busy} onClick={async () => { setBusy(true); setErr(null); const r = await callApi<{ url: string }>("/api/billing/checkout", "POST", { plan }); setBusy(false); if (r.ok) window.location.href = r.url; else setErr(r.error); }}>{disabled ? "Unavailable" : "Upgrade"}</button>
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
