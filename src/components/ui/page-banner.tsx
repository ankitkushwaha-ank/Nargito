import type { BrandKind } from "@/server/brand";

/** Page header with an admin-changeable banner photo (Admin > Logo & images). Works with no database or uploads: bundled images are the default. */
export function PageBanner({ kind, eyebrow, title, accent, description, children, actions }: { kind: BrandKind; eyebrow?: string; title: string; accent?: string; description?: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="relative isolate mb-5 overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/brand/${kind}`} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10 sm:via-white/70 md:to-transparent" aria-hidden />
      <div className="flex flex-col gap-4 px-5 py-6 sm:px-8 sm:py-9 md:min-h-[260px] md:max-w-[640px] md:justify-center">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-[2.6rem]">{title} {accent && <span className="text-primary">{accent}</span>}</h1>
        {description && <p className="max-w-md text-[15px] leading-relaxed text-slate-600">{description}</p>}
        {children}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}
