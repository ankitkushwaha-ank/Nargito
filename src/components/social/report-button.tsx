"use client";
import { useState } from "react";
import { Flag } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { REPORT_REASON_LIST } from "@/lib/constants";

export function ReportButton({ entityType, entityId, label = "Report", className }: { entityType: string; entityId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASON_LIST[0]!);
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await callApi<{ message?: string }>("/api/report", "POST", { entityType, entityId, reason, details });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.message ?? "Report sent." } : { ok: false, text: r.error });
    if (r.ok) setTimeout(() => setOpen(false), 1500);
  }
  return (
    <>
      <button type="button" aria-label={label ? undefined : "Report"} title="Report" onClick={() => { setOpen(true); setMsg(null); }} className={className ?? "btn-ghost text-xs"}><Flag size={14} aria-hidden />{label ? ` ${label}` : ""}</button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <form onSubmit={submit} className="card w-full max-w-md space-y-3 p-5">
            <h2 id="report-title" className="text-lg">Report this content</h2>
            <div>
              <label className="label" htmlFor="rp-reason">Reason</label>
              <select id="rp-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASON_LIST.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rp-details">Details (optional)</label>
              <textarea id="rp-details" className="input" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            {msg && <p role="status" className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={busy} className="btn-primary">Send report</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
