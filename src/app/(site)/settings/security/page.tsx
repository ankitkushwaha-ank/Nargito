import { and, desc, eq, isNull } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Badge, Notice } from "@/components/ui/kit";
import { enableMfaAction, disableMfaAction, startMfaAction, revokeSessionAction, revokeOtherSessionsAction } from "../actions";
import { useDb, schema } from "@/server/db";
import { otpauthUrl } from "@/server/auth/totp";
import { providerStatus } from "@/server/auth/oauth";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Security settings" };

export default async function SecuritySettings() {
  const u = await requireUserPage("/settings/security");
  const db = await useDb();
  const locale = await getLocale();
  const [sessions, linked, events, g, f] = await Promise.all([
    db.select().from(schema.sessions).where(and(eq(schema.sessions.userId, u.id), isNull(schema.sessions.revokedAt))).orderBy(desc(schema.sessions.lastUsedAt)).limit(20),
    db.select().from(schema.authAccounts).where(eq(schema.authAccounts.userId, u.id)),
    db.select().from(schema.securityEvents).where(eq(schema.securityEvents.userId, u.id)).orderBy(desc(schema.securityEvents.createdAt)).limit(8),
    providerStatus("google"), providerStatus("facebook"),
  ]);
  const active = sessions.filter((s) => s.expiresAt > new Date());
  return (
    <>
      <section className="card space-y-3 p-5" aria-labelledby="mfa-h">
        <h2 id="mfa-h" className="text-lg">Two-factor authentication</h2>
        {u.mfaEnabled ? (
          <ActionForm action={disableMfaAction} className="space-y-3"><p className="text-sm"><Badge tone="success">On</Badge> An authenticator code is required when you sign in.</p><Field label="Confirm with your password to turn off" name="password" type="password" required autoComplete="current-password" /><SubmitButton variant="danger">Turn off</SubmitButton></ActionForm>
        ) : u.mfaSecret ? (
          <div className="space-y-3">
            <p className="text-sm">Add this account to an authenticator app (Google Authenticator, Authy, 1Password…) then enter the 6-digit code.</p>
            <p className="rounded-lg bg-bg p-3 text-sm">Setup key: <code className="select-all break-all font-mono tracking-wider">{u.mfaSecret}</code><br /><a className="link text-xs" href={otpauthUrl(u.mfaSecret, u.email)}>Open in authenticator app</a></p>
            <ActionForm action={enableMfaAction} className="flex items-end gap-3"><Field className="w-40" label="6-digit code" name="code" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" /><SubmitButton>Verify & enable</SubmitButton></ActionForm>
          </div>
        ) : (
          <form action={startMfaAction}><p className="mb-3 text-sm text-muted">Protect your account with a time-based one-time code. Recommended for administrators.</p><button className="btn-primary">Set up two-factor authentication</button></form>
        )}
      </section>
      <section className="card space-y-3 p-5" aria-labelledby="link-h"><h2 id="link-h" className="text-lg">Linked sign-in accounts</h2>
        {!g.available && !f.available && !linked.length && <p className="text-sm text-muted">No social sign-in methods are available.</p>}
        <ul className="space-y-2 text-sm">
          {([["google", g], ["facebook", f]] as const).filter(([p, st]) => st.available || linked.some((l) => l.provider === p)).map(([p]) => {
            const isLinked = linked.some((l) => l.provider === p);
            return <li key={p} className="flex items-center justify-between gap-3"><span className="capitalize">{p}</span>{isLinked ? <Badge tone="success">linked</Badge> : <a className="btn-secondary !min-h-[32px]" href={`/api/auth/oauth/${p}?link=1`}>Link</a>}</li>;
          })}
        </ul>
      </section>
      <section className="card space-y-3 p-5" aria-labelledby="ses-h">
        <div className="flex items-center justify-between"><h2 id="ses-h" className="text-lg">Active sessions</h2><form action={revokeOtherSessionsAction}><button className="btn-secondary !min-h-[32px]">Sign out other sessions</button></form></div>
        <ul className="divide-y divide-line text-sm">{active.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><div><p>{s.userAgent?.slice(0, 70) ?? "Unknown device"}{s.id === u.sessionId && <> <Badge>this device</Badge></>}</p><p className="text-xs text-muted">Last active {s.lastUsedAt ? formatDate(s.lastUsedAt, locale, { dateStyle: "medium", timeStyle: "short" }) : "-"}</p></div>{s.id !== u.sessionId && <form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost !min-h-[32px] text-danger">Revoke</button></form>}</li>
        ))}</ul>
      </section>
      <section className="card p-5" aria-labelledby="ev-h"><h2 id="ev-h" className="text-lg">Recent security activity</h2>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing to show.</p> : <ul className="mt-2 divide-y divide-line text-sm">{events.map((e) => <li key={e.id} className="flex justify-between py-2"><span>{e.type.replaceAll(".", " ")}</span><span className="text-muted">{formatDate(e.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ul>}
        <div className="mt-3"><Notice>If you see activity you do not recognise, change your password and sign out other sessions.</Notice></div>
      </section>
    </>
  );
}
