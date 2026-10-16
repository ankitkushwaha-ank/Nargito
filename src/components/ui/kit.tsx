import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Inbox, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const AVATAR_TONES = [
  ["#E3ECFF", "#2447C7"], ["#DFF6F1", "#0F766E"], ["#FFF0DD", "#B45309"], ["#F3E8FF", "#7E22CE"], ["#FFE4EC", "#BE185D"], ["#E4F4FF", "#0369A1"], ["#EAF8DC", "#3F7D14"],
] as const;
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length]!;

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size / 2.8) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} style={style} className={cn("shrink-0 rounded-full border border-line object-cover", className)} loading="lazy" />
    );
  }
  const [bg, fg] = toneFor(name);
  return (
    <span aria-hidden style={{ ...style, background: bg, color: fg }} className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", className)}>
      {initials(name)}
    </span>
  );
}

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return <BadgeCheck size={16} className="inline shrink-0 text-primary" aria-label={label} role="img" />;
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-muted">{icon ?? <Inbox size={28} aria-hidden />}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-2 border-danger/40 px-6 py-10 text-center">
      <AlertTriangle size={28} className="text-danger" aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "success"; children: React.ReactNode }) {
  const t = { info: "bg-primary-tint text-ink", warn: "bg-warn/10 text-warn", danger: "bg-danger/10 text-danger", success: "bg-success/10 text-success" }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Badge({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "muted" | "success" | "warn" | "danger" }) {
  const t = { primary: "bg-primary-tint text-primary", muted: "bg-line/60 text-muted", success: "bg-success/10 text-success", warn: "bg-warn/10 text-warn", danger: "bg-danger/10 text-danger" }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 p-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/4" /></div></div>
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />)}
    </div>
  );
}

export function Pager({ page, hasMore, basePath, params = {} }: { page: number; hasMore: boolean; basePath: string; params?: Record<string, string | undefined> }) {
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q}`;
  };
  if (page <= 1 && !hasMore) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      {page > 1 ? <Link className="btn-secondary" href={href(page - 1)}>Previous</Link> : <span />}
      <span className="text-sm text-muted">Page {page}</span>
      {hasMore ? <Link className="btn-secondary" href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function CoverImage({ src, alt = "", className, ratio = "aspect-[16/9]", zoom, zoomGroup }: { src?: string | null; alt?: string; className?: string; ratio?: string; zoom?: boolean; zoomGroup?: string }) {
  if (!src) return <div className={cn(ratio, "w-full rounded-lg bg-gradient-to-br from-primary-tint to-line/60", className)} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" {...(zoom ? { "data-zoom": src, "data-zoom-group": zoomGroup } : {})} className={cn(ratio, "w-full rounded-lg object-cover", zoom && "cursor-zoom-in", className)} />;
}

export { Image };
