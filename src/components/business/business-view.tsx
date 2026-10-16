import Link from "next/link";
import { Globe, Mail, MapPin, Pencil, Phone, Clock } from "lucide-react";
import { Avatar, Badge, CoverImage, VerifiedBadge } from "@/components/ui/kit";
import { EnquireButton } from "@/components/messaging/enquire-button";
import { EntityFollowButton } from "@/components/social/entity-follow-button";
import { ReportButton } from "@/components/social/report-button";
import { SaveButton } from "@/components/social/save-button";
import { ShareButton } from "@/components/social/share-button";
import { CardGrid, ListingCard } from "@/components/ui/listing-card";
import { RichText } from "@/components/social/rich-text";
import { formatMoney } from "@/lib/format";

type Team = { role: string; id: string; username: string; displayName: string; avatarUrl: string | null }[];

export function BusinessView({ kind, entity, role, followers, following, team, viewerId, products, services, locale, saved, editHref }: {
  kind: "company" | "shop";
  entity: { id: string; name: string; slug: string; description: string | null; logoUrl: string | null; coverUrl: string | null; verified: boolean; locationLabel: string | null; status: string; tagline?: string | null; industry?: string | null; website?: string | null; publicEmail?: string | null; publicPhone?: string | null; category?: string | null; hours?: string | null; serviceArea?: string | null; contactPreference?: string };
  role: string | null; followers: number; following: boolean; team: Team; viewerId: string | null;
  products: { id: string; title: string; price: string | null; currency: string; images: string[]; locationLabel: string | null }[];
  services: { id: string; title: string; startingPrice: string | null; currency: string; images: string[]; category: string | null; serviceArea: string | null }[];
  locale: string; saved: boolean; editHref: string;
}) {
  const e = entity;
  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <CoverImage src={e.coverUrl} ratio="aspect-[21/6]" className="rounded-none" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <Avatar name={e.name} src={e.logoUrl} size={88} className="!rounded-xl border-4 border-surface bg-surface" />
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {role ? <Link href={editHref} className="btn-secondary"><Pencil size={16} aria-hidden />Manage</Link> : <>
                <EntityFollowButton type={kind} id={e.id} initial={following} signedIn={!!viewerId} />
                <EnquireButton listingType={kind} listingId={e.id} title={e.name} signedIn={!!viewerId} label="Send enquiry" />
              </>}
              {viewerId && <SaveButton entityType={kind} entityId={e.id} initial={saved} />}
              <ShareButton path={`/${kind === "company" ? "companies" : "shops"}/${e.slug}`} title={e.name} />
              {viewerId && !role && <ReportButton entityType={kind} entityId={e.id} />}
            </div>
          </div>
          <h1 className="mt-3 flex items-center gap-2 text-2xl">{e.name}{e.verified && <VerifiedBadge />}{e.status !== "active" && <Badge tone="warn">{e.status}</Badge>}</h1>
          {(e.tagline) && <p className="text-muted">{e.tagline}</p>}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {(e.industry || e.category) && <Badge>{e.industry ?? e.category}</Badge>}
            {e.locationLabel && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{e.locationLabel}</span>}
            <span>{followers} follower{followers === 1 ? "" : "s"}</span>
          </p>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {e.description && <section className="card p-5"><h2 className="text-lg">About</h2><div className="mt-2 text-sm"><RichText text={e.description} /></div></section>}
          {products.length > 0 && <section aria-labelledby="bp-h"><h2 id="bp-h" className="mb-3 text-lg">{kind === "shop" ? "Catalogue" : "Products"}</h2><CardGrid>{products.map((p) => <ListingCard key={p.id} href={`/products/${p.id}`} title={p.title} image={p.images[0]} subtitle={p.locationLabel} meta={p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"} />)}</CardGrid></section>}
          {services.length > 0 && <section aria-labelledby="bs-h"><h2 id="bs-h" className="mb-3 text-lg">Services</h2><CardGrid>{services.map((s) => <ListingCard key={s.id} href={`/services/${s.id}`} title={s.title} image={s.images[0]} subtitle={s.serviceArea ?? s.category} meta={s.startingPrice ? `From ${formatMoney(s.startingPrice, s.currency, locale)}` : "Quote on request"} />)}</CardGrid></section>}
        </div>
        <aside className="space-y-4">
          <section className="card space-y-2 p-4 text-sm" aria-label="Contact">
            <h2 className="text-base">Contact</h2>
            {e.website && <p className="flex items-center gap-2"><Globe size={14} aria-hidden /><a className="link break-all" href={e.website} target="_blank" rel="noopener noreferrer nofollow">{e.website.replace(/^https?:\/\//, "")}</a></p>}
            {e.publicEmail && <p className="flex items-center gap-2"><Mail size={14} aria-hidden /><a className="link" href={`mailto:${e.publicEmail}`}>{e.publicEmail}</a></p>}
            {e.publicPhone && <p className="flex items-center gap-2"><Phone size={14} aria-hidden />{e.publicPhone}</p>}
            {e.hours && <p className="flex items-start gap-2"><Clock size={14} className="mt-1" aria-hidden /><span className="whitespace-pre-wrap">{e.hours}</span></p>}
            {e.serviceArea && <p className="flex items-center gap-2"><MapPin size={14} aria-hidden />Serves {e.serviceArea}</p>}
            {!e.website && !e.publicEmail && !e.publicPhone && !e.hours && <p className="text-muted">Use the enquiry button to get in touch.</p>}
          </section>
          {team.length > 0 && (
            <section className="card p-4" aria-label="Team"><h2 className="text-base">Team</h2>
              <ul className="mt-2 space-y-2">{team.map((m) => <li key={m.id}><Link href={`/profile/${m.username}`} className="flex items-center gap-2 hover:underline"><Avatar name={m.displayName} src={m.avatarUrl} size={32} /><span className="text-sm">{m.displayName}</span><Badge tone="muted">{m.role}</Badge></Link></li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
