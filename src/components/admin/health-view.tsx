import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { runHealthChecks } from "@/server/services/health";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";

const icon = { ok: <CheckCircle2 size={18} className="text-success" aria-label="OK" />, warn: <AlertTriangle size={18} className="text-warn" aria-label="Warning" />, fail: <XCircle size={18} className="text-danger" aria-label="Failed" />, unavailable: <HelpCircle size={18} className="text-muted" aria-label="Unavailable" /> };

export async function HealthView({ title }: { title: string }) {
  const { checks, recentErrors, info } = await runHealthChecks();
  const worst = checks.some((c) => c.status === "fail") ? "Some checks failed" : checks.some((c) => c.status === "warn") ? "Running with warnings" : "All systems operational";
  return (
    <>
      <AdminTitle title={title} description={`${worst}. Every row below is measured live when this page loads; values that cannot be measured say so.`} actions={<Link href="" className="btn-secondary">Re-run checks</Link>} />
      <dl className="card mb-5 grid gap-3 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">{Object.entries(info).map(([k, v]) => <div key={k}><dt className="text-xs uppercase text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
      <ul className="card divide-y divide-line">{checks.map((c) => <li key={c.key} className="flex items-start gap-3 p-3"><span className="mt-0.5">{icon[c.status]}</span><div><p className="font-medium">{c.label}</p><p className="text-sm text-muted">{c.detail}</p></div></li>)}</ul>
      <h2 className="mb-2 mt-6 text-lg">Recent errors</h2>
      <Table head={["When", "Component", "Message"]} empty={recentErrors.length ? undefined : "No errors logged."}>{recentErrors.map((e) => <tr key={e.id}><Td className="whitespace-nowrap">{formatDate(e.createdAt, "en", { dateStyle: "short", timeStyle: "medium" })}</Td><Td>{e.component}</Td><Td className="max-w-xl break-words text-xs">{e.message}</Td></tr>)}</Table>
      <p className="mt-2 text-xs text-muted">Messages are sanitised before they are stored: secrets, tokens and connection strings are redacted.</p>
    </>
  );
}
