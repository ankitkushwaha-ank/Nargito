import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, ChevronRight, Image as ImageIcon, Lock, MapPin, Pencil, Route, ShieldCheck, Users, Wallet, XCircle } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { getTrip, listParticipants } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Avatar, Badge, CoverImage, Notice, VerifiedBadge } from "@/components/ui/kit";
import { EnquireButton } from "@/components/messaging/enquire-button";
import { SaveButton } from "@/components/social/save-button";
import { ReportButton } from "@/components/social/report-button";
import { ShareButton } from "@/components/social/share-button";
import { RichText } from "@/components/social/rich-text";
import { formatDate, formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { useDb, schema } from "@/server/db";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { joinTripAction, decideParticipantAction, setListingStatusAction } from "../../my/actions";

export async function generateMetadata({ params }: { params: Promise<{ tripId: string }> }): Promise<Metadata> {
  const { tripId } = await params;
  const db = await useDb();
  const [t] = /^[0-9a-f-]{36}$/i.test(tripId) ? await db.select().from(schema.trips).where(and(eq(schema.trips.id, tripId), eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"))) : [];
  if (!t) return { title: "Trip", robots: { index: false, follow: false } };
  return { title: t.title, description: (t.description ?? `${t.title} - ${t.destination}`).slice(0, 160), alternates: { canonical: `/trips/${t.id}` }, openGraph: { title: t.title, images: [t.coverUrl ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [t.coverUrl ?? "/api/brand/og"] } };
}

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const viewer = await getSessionUser();
  const r = await getTrip(tripId, viewer?.id ?? null);
  if (!r) notFound();
  const { t, organiser, items, owner, myPart, approvedCount, hiddenItems } = r;
  const locale = await getLocale();
  const saved = viewer ? !!(await (await useDb()).select().from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "trip"), eq(schema.savedItems.entityId, t.id))))[0] : false;
  const parts = owner ? await listParticipants(t.id) : [];
  const days = [...new Set(items.map((i) => i.day))];
  const full = !!t.slots && approvedCount >= t.slots;
  const statusTone = t.status === "published" ? "bg-emerald-50 text-emerald-700" : t.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
  return (
    <FeatureGate feature="trips">
      <Container width="max-w-shell">
        {t.status !== "published" && <div className="mb-4"><Notice tone="warn">This trip is {t.status}{owner ? " - only you can see it until you publish." : "."}</Notice></div>}
        <div className="relative overflow-hidden rounded-3xl">
          <CoverImage src={t.coverUrl} alt={t.title} ratio="aspect-[16/9] sm:aspect-[21/7]" className="!rounded-3xl" />
          {t.coverUrl && <button type="button" data-zoom={t.coverUrl} data-zoom-alt={t.title} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl bg-black/60 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/75"><ImageIcon size={16} aria-hidden />View photo</button>}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="card space-y-7 p-5 sm:p-7">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">{t.category && <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-bold text-primary">{t.category}</span>}<span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusTone}`}>{t.status}</span></div>
                  <h1 className="mt-3 text-3xl font-extrabold sm:text-[2rem]">{t.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {owner ? <Link href={`/my/trips/${t.id}`} className="btn-primary"><Pencil size={16} aria-hidden />Edit trip</Link> : t.status === "published" ? <EnquireButton listingType="trip" listingId={t.id} title={t.title} signedIn={!!viewer} label="Ask the organiser" /> : null}
                  {viewer && <SaveButton entityType="trip" entityId={t.id} initial={saved} className="btn-secondary" />}
                  <ShareButton path={`/trips/${t.id}`} title={t.title} />
                  {viewer && !owner && <ReportButton entityType="trip" entityId={t.id} label="" className="btn-secondary !px-3" />}
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-[15px] text-ink/75">
                <li className="flex items-center gap-2"><MapPin size={18} className="text-muted" aria-hidden />{t.originArea ? `${t.originArea} → ` : ""}{t.destination}</li>
                {t.startDate && <li className="flex items-center gap-2"><CalendarDays size={18} className="text-muted" aria-hidden />{formatDate(t.startDate, locale)}{t.endDate ? ` – ${formatDate(t.endDate, locale)}` : ""}</li>}
                {t.slots && <li className="flex items-center gap-2"><Users size={18} className="text-muted" aria-hidden />{approvedCount}/{t.slots} slots filled</li>}
                {(t.budgetMin || t.budgetMax) && <li className="flex items-center gap-2"><Wallet size={18} className="text-muted" aria-hidden />Approx. {t.budgetMin ? formatMoney(t.budgetMin, t.currency, locale) : ""}{t.budgetMax ? ` – ${formatMoney(t.budgetMax, t.currency, locale)}` : ""} per person</li>}
              </ul>
            </div>
            <hr className="border-line" />
            {t.description && <section><h2 className="text-lg font-bold">About this trip</h2><div className="mt-2 max-w-3xl text-[15px] text-ink/80"><RichText text={t.description} /></div></section>}
            {t.preferences && <section><h2 className="text-lg font-bold">Travel preferences</h2><p className="mt-2 text-[15px] text-muted">{t.preferences}</p></section>}
            <section aria-labelledby="it-h">
              <h2 id="it-h" className="text-lg font-bold">Itinerary</h2>
              {items.length === 0 ? (
                <div className="mt-3 flex items-center gap-5 rounded-2xl border border-line bg-bg p-5">
                  <span className="hidden h-16 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary sm:flex"><Route size={32} aria-hidden /></span>
                  <div><p className="font-bold">No itinerary added yet</p><p className="mt-0.5 text-sm text-muted">The organiser has not added an itinerary yet. Check back later for route details, stops and schedule.</p></div>
                </div>
              ) : (
                <ol className="mt-3 space-y-3">{days.map((d) => (
                  <li key={d} className="rounded-2xl border border-line p-4"><h3 className="text-base font-bold text-primary">Day {d}</h3><ul className="mt-2 space-y-2">{items.filter((i) => i.day === d).map((i) => <li key={i.id}><p className="flex items-center gap-1 font-semibold">{i.isPrivate && <Lock size={12} aria-label="Private" />}{i.title}</p>{i.details && <p className="text-sm text-muted">{i.details}</p>}</li>)}</ul></li>
                ))}</ol>
              )}
              {hiddenItems && <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Lock size={12} aria-hidden />Some details are shared only with confirmed participants.</p>}
            </section>
            {owner && (
              <section aria-labelledby="pp-h">
                <h2 id="pp-h" className="text-lg font-bold">Participants &amp; requests</h2>
                {parts.length === 0 ? (
                  <div className="mt-3 flex items-center gap-5 rounded-2xl border border-line bg-bg p-5">
                    <span className="hidden h-14 w-24 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary sm:flex"><Users size={30} aria-hidden /></span>
                    <div><p className="font-bold">No requests yet</p><p className="mt-0.5 text-sm text-muted">Be the first to request to join this trip.</p></div>
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-line rounded-2xl border border-line px-4">{parts.map(({ p, u }) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-3 py-3"><Avatar name={u.displayName} src={u.avatarUrl} size={40} /><div className="min-w-0 flex-1"><Link href={`/profile/${u.username}`} className="font-semibold hover:underline">{u.displayName}</Link>{p.message && <p className="truncate text-xs text-muted">“{p.message}”</p>}</div><Badge tone={p.status === "approved" ? "success" : p.status === "declined" ? "danger" : "warn"}>{p.status}</Badge>
                      {p.status === "pending" && (<form action={decideParticipantAction} className="flex gap-1"><input type="hidden" name="tripId" value={t.id} /><input type="hidden" name="userId" value={u.id} /><button name="decision" value="approved" className="btn-primary btn-sm">Approve</button><button name="decision" value="declined" className="btn-secondary btn-sm">Decline</button></form>)}</li>
                  ))}</ul>
                )}
              </section>
            )}
          </div>
          <aside className="space-y-4">
            {owner && (
              <form action={setListingStatusAction} className="card p-5"><input type="hidden" name="type" value="trip" /><input type="hidden" name="id" value={t.id} />
                <div className="flex items-center justify-between"><h2 className="font-bold">Trip status</h2><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize ${statusTone}`}><span className="h-2 w-2 rounded-full bg-current" />{t.status}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {t.status !== "published" && t.status !== "completed" && <button name="status" value="published" className="btn-primary col-span-2">Publish</button>}
                  {t.status === "published" && <button name="status" value="completed" className="btn-secondary"><CheckCircle2 size={16} aria-hidden />Mark completed</button>}
                  {t.status !== "cancelled" && t.status !== "completed" && <button name="status" value="cancelled" className="btn !border !border-rose-200 !bg-rose-50 !text-rose-600 hover:!bg-rose-100"><XCircle size={16} aria-hidden />Cancel trip</button>}
                </div>
              </form>
            )}
            {!owner && t.status === "published" && (
              <div className="card p-5">
                <h2 className="font-bold">Join this trip</h2>
                {myPart ? <p className="mt-2 text-sm">Your request is <Badge tone={myPart.status === "approved" ? "success" : myPart.status === "declined" ? "danger" : "warn"}>{myPart.status}</Badge></p> : full ? <p className="mt-2 text-sm text-muted">All slots are taken.</p> : viewer ? (
                  <ActionForm action={joinTripAction} className="mt-3 space-y-2"><input type="hidden" name="tripId" value={t.id} /><Field label="Message to the organiser (optional)" name="message" as="textarea" rows={2} maxLength={500} /><SubmitButton>{t.requireApproval ? "Request to join" : "Join trip"}</SubmitButton></ActionForm>
                ) : <Link href={`/login?next=/trips/${t.id}`} className="btn-primary mt-3 w-full">Sign in to join</Link>}
                <p className="mt-3 text-xs text-muted">{t.requireApproval ? "The organiser approves each request." : "Joining is instant while slots remain."}</p>
              </div>
            )}
            <div className="card p-5">
              <h2 className="font-bold">Organiser</h2>
              <Link href={`/profile/${organiser.username}`} className="mt-3 flex items-center gap-3 rounded-xl hover:bg-primary-tint/50">
                <Avatar name={organiser.displayName} src={organiser.avatarUrl} size={48} />
                <span className="flex min-w-0 flex-1 items-center gap-1 font-bold">{organiser.displayName}{organiser.verified && <VerifiedBadge />}</span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-primary/15 bg-primary-tint/70 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-surface"><ShieldCheck size={26} aria-hidden /></span>
              <div><p className="font-bold text-primary">A safe and trusted community</p><p className="mt-1 text-sm text-ink/70">Chat with the organiser, ask questions and get all details before joining.</p></div>
            </div>
          </aside>
        </div>
      </Container>
    </FeatureGate>
  );
}
