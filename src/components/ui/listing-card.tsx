import Link from "next/link";
import { Badge, CoverImage, VerifiedBadge } from "./kit";

export type CardProps = { href: string; title: string; subtitle?: string | null; image?: string | null; meta?: string | null; badge?: string | null; verified?: boolean; footer?: React.ReactNode; ratio?: string };

export function ListingCard({ href, title, subtitle, image, meta, badge, verified, footer, ratio }: CardProps) {
  return (
    <article className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link href={href} className="block" aria-label={title}><CoverImage src={image} ratio={ratio ?? "aspect-[4/3]"} className="rounded-none" /></Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {badge && <div><Badge>{badge}</Badge></div>}
        <h3 className="line-clamp-2 text-base font-medium"><Link href={href} className="hover:underline">{title}</Link>{verified && <> <VerifiedBadge /></>}</h3>
        {subtitle && <p className="line-clamp-2 text-sm text-muted">{subtitle}</p>}
        {meta && <p className="mt-auto pt-1 text-sm font-semibold">{meta}</p>}
        {footer}
      </div>
    </article>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
