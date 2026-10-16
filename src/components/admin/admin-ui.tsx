import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, BarChart3, Building2, CalendarClock, CircleDot, Clock, CloudOff, Crown, Database, FileText, Flag, Heart, IndianRupee, Mail, Megaphone, MessageSquare, Minus, MousePointerClick, Plane, ShieldCheck, ShoppingBag, UserPlus, Users, Zap, LayoutGrid, Rows3, type LucideIcon } from "lucide-react";
import type { Metric } from "@/server/services/metrics";
import { Badge } from "@/components/ui/kit";
import { cn } from "@/lib/cn";

export function AdminTitle({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function formatMetric(m: Metric, locale = "en-IN") {
  if (m.value === null) return "n/a";
  if (m.format === "bytes") {
    const v = m.value; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; let x = v;
    while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
    return `${x.toFixed(i ? 1 : 0)} ${u[i]}`;
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(m.value);
}

const METRIC_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  users_total: { icon: Users, tone: "bg-blue-50 text-blue-600" }, users_new: { icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" }, users_active: { icon: Zap, tone: "bg-violet-50 text-violet-600" },
  users_verified: { icon: ShieldCheck, tone: "bg-sky-50 text-sky-600" }, users_online: { icon: CircleDot, tone: "bg-green-50 text-green-600" }, posts: { icon: FileText, tone: "bg-indigo-50 text-indigo-600" },
  trips: { icon: Plane, tone: "bg-blue-50 text-blue-600" }, listings: { icon: ShoppingBag, tone: "bg-orange-50 text-orange-500" }, businesses: { icon: Building2, tone: "bg-rose-50 text-rose-500" },
  messages: { icon: MessageSquare, tone: "bg-blue-50 text-blue-600" }, enquiries: { icon: Mail, tone: "bg-emerald-50 text-emerald-600" }, engagement: { icon: Heart, tone: "bg-pink-50 text-pink-500" },
  reports_open: { icon: Flag, tone: "bg-rose-50 text-rose-500" }, users_suspended: { icon: Ban, tone: "bg-red-50 text-red-500" }, verification_pending: { icon: Clock, tone: "bg-amber-50 text-amber-600" },
  promos: { icon: Megaphone, tone: "bg-slate-100 text-slate-600" }, impressions: { icon: BarChart3, tone: "bg-violet-50 text-violet-600" }, clicks: { icon: MousePointerClick, tone: "bg-blue-50 text-blue-600" },
  storage: { icon: Database, tone: "bg-slate-100 text-slate-600" }, upload_failures: { icon: CloudOff, tone: "bg-amber-50 text-amber-600" }, api_errors: { icon: AlertTriangle, tone: "bg-orange-50 text-orange-500" },
  jobs_failed: { icon: CalendarClock, tone: "bg-indigo-50 text-indigo-600" }, mail_sent: { icon: Mail, tone: "bg-amber-50 text-amber-600" }, pro_active: { icon: Crown, tone: "bg-amber-50 text-amber-500" }, revenue: { icon: IndianRupee, tone: "bg-emerald-50 text-emerald-600" },
};
export function MetricCard({ m }: { m: Metric }) {
  const delta = m.previous != null && m.value != null ? m.value - m.previous : null;
  const pct = delta !== null && m.previous ? Math.round((delta / m.previous) * 100) : null;
  const ic = METRIC_ICON[m.key] ?? { icon: BarChart3, tone: "bg-slate-100 text-slate-600" };
  const body = (
    <div className="card h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ic.tone)}><ic.icon size={20} aria-hidden /></span>
        <p className="min-w-0 text-sm font-semibold leading-tight text-ink/80">{m.label}</p>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{formatMetric(m)}</p>
      {delta !== null && (
        <p className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", delta > 0 ? "bg-emerald-50 text-emerald-700" : delta < 0 ? "bg-rose-50 text-rose-600" : "bg-bg text-muted")}>
          {delta > 0 ? <ArrowUpRight size={13} aria-hidden /> : delta < 0 ? <ArrowDownRight size={13} aria-hidden /> : <Minus size={13} aria-hidden />}
          {delta > 0 ? "+" : ""}{delta}{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""} vs before
        </p>
      )}
      {m.note && <p className="mt-1.5 text-xs text-muted">{m.note}</p>}
      {m.kind === "unavailable" && <p className="mt-1.5 text-xs text-muted">Not available yet</p>}
    </div>
  );
  return m.href ? <Link href={m.href} className="block h-full">{body}</Link> : body;
}
/** Smooth area chart with gridlines and hover tooltips, plus a hidden data table for screen readers. */
export function TrendChart({ title, subtitle, data, color = "var(--c-primary)" }: { title: string; subtitle?: string; data: { day: string; n: number }[]; color?: string }) {
  const W = 640; const H = 220; const L = 34; const B = 26; const T = 12; const R = 8;
  const max = Math.max(4, ...data.map((d) => d.n)); const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const pts = data.map((d, i) => [x(i), y(d.n)] as const);
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${pts[pts.length - 1]![0]},${H - B} L${pts[0]![0]},${H - B} Z` : "";
  const total = data.reduce((s, d) => s + d.n, 0);
  const gid = `g-${title.replace(/\W+/g, "")}`;
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const label = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
  return (
    <figure className="card p-4 sm:p-5">
      <figcaption className="mb-2 flex items-start justify-between gap-3">
        <span><span className="block font-bold">{title}</span>{subtitle && <span className="text-xs text-muted">{subtitle}</span>}</span>
        <span className="rounded-full bg-primary-tint px-3 py-1 text-sm font-bold text-primary">{total}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${total} in ${data.length} days`} className="w-full">
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={`rgb(${color} / 0.28)`} /><stop offset="100%" stopColor={`rgb(${color} / 0)`} /></linearGradient></defs>
        {ticks.map((tk) => <g key={tk}><line x1={L} x2={W - R} y1={y(tk)} y2={y(tk)} stroke="rgb(var(--c-border))" strokeDasharray={tk ? "3 4" : undefined} /><text x={L - 6} y={y(tk) + 3} fontSize="10" textAnchor="end" fill="rgb(var(--c-muted))">{Math.round(tk)}</text></g>)}
        {area && <path d={area} fill={`url(#${gid})`} />}
        {line && <path d={line} fill="none" stroke={`rgb(${color})`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map(([a, b], i) => (data[i]!.n > 0 || i === pts.length - 1) ? <circle key={data[i]!.day} cx={a} cy={b} r="3.5" fill="rgb(var(--c-surface))" stroke={`rgb(${color})`} strokeWidth="2"><title>{`${label(data[i]!.day)}: ${data[i]!.n}`}</title></circle> : null)}
        <text x={L} y={H - 6} fontSize="10" fill="rgb(var(--c-muted))">{label(data[0]?.day)}</text>
        <text x={W - R} y={H - 6} fontSize="10" textAnchor="end" fill="rgb(var(--c-muted))">{label(data[data.length - 1]?.day)}</text>
      </svg>
      <table className="sr-only"><caption>{title} by day</caption><thead><tr><th scope="col">Day</th><th scope="col">Count</th></tr></thead><tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.n}</td></tr>)}</tbody></table>
    </figure>
  );
}
export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return <div className="mb-3 mt-8 first:mt-0"><h2 className="text-lg font-extrabold">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>;
}/** Accessible SVG bar chart with a visually-hidden data table for screen readers. */
export function BarChart({ title, data, unit = "" }: { title: string; data: { day: string; n: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const w = 600; const h = 160; const bw = w / Math.max(1, data.length);
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 flex items-baseline justify-between"><span className="font-medium">{title}</span><span className="text-xs text-muted">Total {total}{unit}</span></figcaption>
      <svg viewBox={`0 0 ${w} ${h + 20}`} role="img" aria-label={`${title}: ${total} in ${data.length} days`} className="w-full">
        <line x1="0" x2={w} y1={h} y2={h} stroke="rgb(var(--c-border))" />
        {data.map((d, i) => { const bh = (d.n / max) * (h - 10); return <rect key={d.day} x={i * bw + 1} y={h - bh} width={Math.max(1, bw - 2)} height={bh} rx="2" fill="rgb(var(--c-primary))"><title>{`${d.day}: ${d.n}`}</title></rect>; })}
        <text x="0" y={h + 14} fontSize="10" fill="rgb(var(--c-muted))">{data[0]?.day}</text>
        <text x={w} y={h + 14} fontSize="10" textAnchor="end" fill="rgb(var(--c-muted))">{data[data.length - 1]?.day}</text>
      </svg>
      <table className="sr-only"><caption>{title} by day</caption><thead><tr><th scope="col">Day</th><th scope="col">Count</th></tr></thead><tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.n}</td></tr>)}</tbody></table>
    </figure>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="card overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-muted">{head.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-muted">{empty}</p>}
    </div>
  );
}
export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={cn("px-3 py-2 align-top", className)}>{children}</td>;

/** Grid / list switch. Keeps the current filters; the choice lives in the URL (?view=grid|list). */
export function ViewToggle({ basePath, params, view }: { basePath: string; params: Record<string, string | undefined>; view: "grid" | "list" }) {
  const href = (v: string) => { const q = new URLSearchParams(); for (const [k, val] of Object.entries(params)) if (val && k !== "page" && k !== "view") q.set(k, val); q.set("view", v); return `${basePath}?${q}`; };
  const base = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors";
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      <Link href={href("list")} scroll={false} aria-current={view === "list" ? "true" : undefined} className={cn(base, view === "list" ? "bg-primary text-white" : "text-muted hover:text-ink")}><Rows3 size={16} aria-hidden />List</Link>
      <Link href={href("grid")} scroll={false} aria-current={view === "grid" ? "true" : undefined} className={cn(base, view === "grid" ? "bg-primary text-white" : "text-muted hover:text-ink")}><LayoutGrid size={16} aria-hidden />Grid</Link>
    </div>
  );
}
