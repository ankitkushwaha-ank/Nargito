import { notFound } from "next/navigation";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { getSettings } from "@/server/settings";
import { SETTINGS, SETTING_GROUPS } from "@/server/settings-registry";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { SettingsForm, type FieldDef } from "@/components/admin/settings-form";
import { Badge, Notice } from "@/components/ui/kit";
import { providerCredentials, redirectUri } from "@/server/auth/oauth";
import { mailConfigStatus } from "@/server/mail";
import { useDb, schema } from "@/server/db";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { testEmailAction, testSmsAction } from "./actions";
import { formatDate } from "@/lib/format";
import { paymentsStatus } from "@/server/services/pro";
import { UPLOAD_ROOT } from "@/server/media";

const Status = ({ ok, yes = "Configured", no = "Not configured" }: { ok: boolean; yes?: string; no?: string }) => <Badge tone={ok ? "success" : "warn"}>{ok ? yes : no}</Badge>;

export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const def = SETTING_GROUPS.find((g) => g.id === group);
  if (!def) notFound();
  await adminPage(def.permission);
  const values = await getSettings();
  const fields: FieldDef[] = SETTINGS.filter((s) => s.group === group).map((s) => ({ key: s.key, label: s.label, help: s.help, type: s.type, value: values[s.key], options: s.options, min: s.min, max: s.max, sensitive: s.sensitive, readOnly: s.key === "chat.callsEnabled" }));
  const db = await useDb();
  const mail = mailConfigStatus();
  const logs = group === "email_sms" ? await db.select().from(schema.emailLog).orderBy(desc(schema.emailLog.createdAt)).limit(12) : [];
  const jobs = group === "runtime" ? await db.select().from(schema.scheduledJobs) : [];
  const dbMode = process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL) ? "PostgreSQL (node-postgres)" : "Embedded PostgreSQL (PGlite)";
  return (
    <>
      <AdminTitle title={def.label} description={def.description} />
      <div className="space-y-5">
        {group === "maintenance" && <Notice tone={values["maintenance.enabled"] ? "warn" : "info"}>{values["maintenance.enabled"] ? "Maintenance mode is ON. Visitors see the maintenance page; administrators can still sign in and use the site." : "Maintenance mode is off. The site is operating normally."}</Notice>}
        {group === "social" && (
          <section className="card space-y-3 p-5" aria-labelledby="oauth-h"><h2 id="oauth-h" className="text-lg">Provider status</h2>
            <p className="text-sm">Redirect URI to register with both providers: <code className="select-all rounded bg-bg px-1.5 py-0.5">{await redirectUri()}</code></p>
            <Table head={["Provider", "Credentials (env vars)", "Enabled in settings", "Ready"]}>
              {(["google", "facebook"] as const).map((p) => { const c = providerCredentials(p); const on = Boolean(values[`oauth.${p}.enabled`]); return (
                <tr key={p}><Td className="capitalize">{p}</Td><Td><Status ok={!!(c.id && c.secret)} /> <span className="text-xs text-muted">{p === "google" ? "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET" : "FACEBOOK_APP_ID / FACEBOOK_APP_SECRET"}</span></Td><Td>{on ? "Yes" : "No"}</Td><Td><Status ok={!!(c.id && c.secret) && on} yes="Sign-in available" no="Sign-in unavailable" /></Td></tr>
              ); })}
            </Table>
            <p className="text-xs text-muted">Secret values are never displayed. End-to-end sign-in can only be verified with real provider credentials: set the env vars, enable the provider here, then sign in from /login. Provider errors are written to System logs.</p>
          </section>
        )}
        {group === "email_sms" && (<>
          <section className="card space-y-3 p-5"><h2 className="text-lg">Provider status</h2>
            <ul className="space-y-1 text-sm"><li>SMTP: <Status ok={mail.smtp} /> <span className="text-xs text-muted">SMTP_HOST, SMTP_USER, SMTP_PASS</span></li><li>Resend: <Status ok={mail.resend} /> <span className="text-xs text-muted">RESEND_API_KEY</span></li><li>Twilio SMS: <Status ok={mail.twilio} /> <span className="text-xs text-muted">TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM</span></li></ul>
            <div className="grid gap-4 md:grid-cols-2">
              <ActionForm action={testEmailAction} className="space-y-2"><Field label="Send test email to" name="to" type="email" placeholder="you@example.com" /><SubmitButton variant="secondary">Send test email</SubmitButton></ActionForm>
              <ActionForm action={testSmsAction} className="space-y-2"><Field label="Send test SMS to" name="to" placeholder="+919876543210" /><SubmitButton variant="secondary">Send test SMS</SubmitButton></ActionForm>
            </div>
          </section>
          <section aria-labelledby="dl-h"><h2 id="dl-h" className="mb-2 text-lg">Delivery log</h2>
            <Table head={["When", "Type", "To", "Subject", "Status", "Detail"]} empty={logs.length ? undefined : "No messages yet."}>{logs.map((l) => <tr key={l.id}><Td>{formatDate(l.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</Td><Td>{l.kind}</Td><Td>{l.toAddress.replace(/(.{2}).+(@.*)?/, "$1***$2")}</Td><Td>{l.subject}</Td><Td><Badge tone={l.status === "sent" ? "success" : l.status === "failed" ? "danger" : "muted"}>{l.status}</Badge></Td><Td className="text-xs text-muted">{l.error}</Td></tr>)}</Table></section>
        </>)}
        {group === "uploads" && <section className="card space-y-1 p-5 text-sm"><h2 className="text-lg">Storage</h2><p>Provider: <b>Local disk</b> at <code className="rounded bg-bg px-1">{UPLOAD_ROOT.split(/[\\/]/).slice(-2).join("/")}</code> (set UPLOAD_DIR). Switch to Cloudflare R2 or change storage under <a className="underline" href="/admin/storage">Media storage</a>.</p><p className="text-muted">Limits and allowed types below are enforced on every upload on the server (type is detected from file contents, not the browser).</p></section>}
        {group === "chat" && <Notice>Voice/video calling is not implemented in this release, so no signalling, STUN or TURN settings exist. Realtime messaging uses polling with automatic reconnection.</Notice>}
        {group === "ai" && <Notice tone={process.env.AI_API_KEY ? "info" : "warn"}>{process.env.AI_API_KEY ? "AI_API_KEY is present. No AI feature is wired into the product in this release; these settings reserve limits for future integrations." : "AI_API_KEY is not set. AI features stay disabled regardless of the toggle below. No user content is sent to any AI provider."}</Notice>}
        {group === "pro" && <Notice tone={paymentsStatus().stripe ? "info" : "warn"}>{paymentsStatus().stripe ? "Stripe keys detected. Checkout and webhooks are live once the provider is set to stripe below." : "No payment provider keys are configured (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET). Paid plans cannot be purchased and no payment records can be created."}</Notice>}
        {group === "runtime" && (<>
          <section className="card space-y-2 p-5 text-sm"><h2 className="text-lg">Runtime status</h2>
            <p>Node.js {process.version} · Database driver: <b>{dbMode}</b> · Realtime transport: <b>HTTP polling</b></p>
            <p className="text-muted">This screen only tunes safe, validated settings. There is no way to run commands or code from the browser. To restart services use your process manager (e.g. systemd, PM2, Docker).</p>
          </section>
          <Table head={["Job", "Enabled", "Last run", "Status"]}>{jobs.map((j) => <tr key={j.key}><Td>{j.name}</Td><Td>{j.enabled ? "Yes" : "No"}</Td><Td>{j.lastRunAt ? formatDate(j.lastRunAt, "en", { dateStyle: "short", timeStyle: "short" }) : "never"}</Td><Td><Badge tone={j.lastStatus === "failed" ? "danger" : j.lastStatus === "success" ? "success" : "muted"}>{j.lastStatus ?? "pending"}</Badge></Td></tr>)}</Table>
          <p className="text-sm"><Link className="link" href="/admin/cron">Manage scheduled jobs</Link> · <Link className="link" href="/admin/debugger">Open debugger</Link></p>
        </>)}
        {group === "pwa" && <section className="card space-y-2 p-5 text-sm"><h2 className="text-lg">Manifest</h2><p>The live manifest is generated from the values below: <a className="link" href="/manifest.webmanifest" target="_blank">/manifest.webmanifest</a>. Icons are derived from the Nargito logo. The service worker caches only public static assets and the offline page, never API responses, messages or admin pages.</p></section>}
        {group === "mobile" && <Notice>Nargito is delivered as an installable Progressive Web App. No native iOS/Android applications are published, so no store buttons are shown unless you enter real URLs below.</Notice>}
        {group === "seo" && <p className="text-sm"><Link className="link" href="/admin/seo">Manage redirects and see sitemap status</Link></p>}
        <SettingsForm group={group} fields={fields} preview={group === "design"} />
        {group === "design" && <p className="text-xs text-muted">Custom CSS is stripped of @import, url(), expression() and HTML before it is stored. JavaScript cannot be added from this screen.</p>}
      </div>
    </>
  );
}
