import Link from "next/link";
import { CheckCircle2, Download, Flag, Image as ImageIcon, Settings, Users, FileText, ChevronRight } from "lucide-react";
import { adminPage } from "@/server/admin";
import { hasPermission } from "@/server/auth/guard";
import { getDashboard, RANGES, type Metric } from "@/server/services/metrics";
import { AdminTitle, MetricCard, SectionHeading, TrendChart } from "@/components/admin/admin-ui";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/ui/kit";
import { AdminOptionGrid } from "@/components/admin/option-grid";
import { visibleAdminGroups } from "@/server/admin-nav";

export const metadata = { title: "Dashboard" };

const GROUPS: { title: string; hint: string; keys: string[] }[] = [
  { title: "People", hint: "Who is joining and using Nargito.", keys: ["users_new", "users_verified", "pro_active"] },
  { title: "What people are doing", hint: "Content and conversations created in this period.", keys: ["posts", "trips", "listings", "businesses", "engagement", "messages", "enquiries"] },
  { title: "Promotions & money", hint: "Ads, memberships and payments.", keys: ["promos", "impressions", "clicks", "revenue"] },
  { title: "Technical health", hint: "Mostly for your developer. Zeros here are good.", keys: ["storage", "upload_failures", "api_errors", "jobs_failed", "mail_sent"] },
];
const ATTENTION = ["reports_open", "users_suspended", "verification_pending"];
const GLANCE = ["users_total", "users_active", "users_online", "posts"];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await adminPage("admin.access");
  const sp = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;
  const canExport = await hasPermission(user, "analytics.export");
  let data: Awaited<ReturnType<typeof getDashboard>>;
  try { data = await getDashboard(days); } catch { return <ErrorState title="Dashboard unavailable" description="Metrics could not be loaded from the database." action={<Link href="/admin" className="btn-secondary mt-2">Retry</Link>} />; }
  const by = new Map<string, Metric>(data.metrics.map((m) => [m.key, m]));
  const pick = (keys: string[]) => keys.map((k) => by.get(k)).filter(Boolean) as Metric[];
  const navGroups = await visibleAdminGroups(user.id);
  const attention = pick(ATTENTION);
  const allClear = attention.every((m) => !m.value);
  const grid = "grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4";
  return (
    <>
      <AdminTitle title="Dashboard" description={`A simple summary of your site over the last ${days} days, compared with the ${days} days before.`}
        actions={<>
          <nav className="flex gap-1 rounded-full border border-line bg-surface p-1" aria-label="Date range">{RANGES.map((r) => <Link key={r} href={`/admin?days=${r}`} aria-current={days === r ? "page" : undefined} className={cn("rounded-full px-3.5 py-1 text-sm font-semibold", days === r ? "bg-primary text-white" : "text-muted hover:text-ink")}>{r} days</Link>)}</nav>
          {canExport && <a className="btn-secondary btn-sm" href={`/api/admin/export?metric=summary&days=${days}`}><Download size={15} aria-hidden />Export CSV</a>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title="New members per day" subtitle={`Last ${days} days`} data={data.growth} />
        <TrendChart title="Posts per day" subtitle={`Last ${days} days`} data={data.postsSeries} color="14 165 233" />
      </div>

      <AdminOptionGrid groups={navGroups} />

      <SectionHeading title="At a glance" />
      <div className={grid}>{pick(GLANCE).map((m) => <MetricCard key={m.key} m={m} />)}</div>

      <SectionHeading title="Needs your attention" hint="Things waiting for a decision from you." />
      {allClear ? (
        <div className="card flex items-center gap-3 p-4 text-sm"><CheckCircle2 className="text-emerald-500" size={22} aria-hidden /><span><b>All clear.</b> No open reports, restricted accounts or verification requests.</span></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">{attention.map((m) => <MetricCard key={m.key} m={m} />)}</div>
      )}

      <SectionHeading title="Quick actions" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/admin/users", icon: Users, title: "Manage members", text: "Search, verify or restrict accounts." },
          { href: "/admin/reports", icon: Flag, title: "Review reports", text: "Handle content people flagged." },
          { href: "/admin/content/posts", icon: FileText, title: "Browse content", text: "Posts, trips, products and more." },
          { href: "/admin/branding", icon: ImageIcon, title: "Logo & images", text: "Change logo, icon and banners." },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="card group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary"><q.icon size={20} aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="block font-bold">{q.title}</span><span className="block text-xs text-muted">{q.text}</span></span>
            <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted"><Settings size={12} className="mr-1 inline" aria-hidden />All site options are in the menu on the left (or the ☰ button on mobile).</p>

      {GROUPS.map((g) => {
        const ms = pick(g.keys);
        return ms.length ? (
          <section key={g.title}>
            <SectionHeading title={g.title} hint={g.hint} />
            <div className={grid}>{ms.map((m) => <MetricCard key={m.key} m={m} />)}</div>
          </section>
        ) : null;
      })}
    </>
  );
}
