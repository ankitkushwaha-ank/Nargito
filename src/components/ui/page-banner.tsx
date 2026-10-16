import type { BrandKind } from "@/server/brand";

/** Full-width page banner (same look as Trips) with an admin-changeable photo (Admin > Logo & images). Bundled images are the default, so it shows even with no database or uploads. */
export function PageBanner({ kind, eyebrow, title, accent, description, children, actions }: { kind: BrandKind; eyebrow?: string; title: string; accent?: string; description?: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-b-[1.75rem] bg-white sm:rounded-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/brand/${kind}`} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[75%_30%] opacity-90 saturate-[.85] sm:opacity-100 sm:saturate-100" fetchPriority="high" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/90 via-white/60 to-white/85 sm:bg-gradient-to-r sm:from-white sm:via-white/60 sm:to-transparent md:from-white/95" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 md:pb-16 md:pt-12">
        <div className="max-w-[560px] space-y-4">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">{title}<br />{accent && <span className="text-primary">{accent}</span>}</h1>
          {description && <p className="max-w-md text-[15px] leading-relaxed text-slate-600">{description}</p>}
          {children}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
