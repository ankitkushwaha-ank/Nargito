import "server-only";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { useDb, schema } from "../db";
import { randomToken } from "../util";
import { appUrl } from "../mail";
import { getSetting } from "../settings";
import { generateUsername } from "./service";
import { createSession } from "./session";
import { audit, securityEvent } from "../log";

export type Provider = "google" | "facebook";
const STATE_COOKIE = "nargito_oauth";

export function providerCredentials(p: Provider) {
  if (p === "google") return { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET };
  return { id: process.env.FACEBOOK_APP_ID, secret: process.env.FACEBOOK_APP_SECRET };
}
export async function providerStatus(p: Provider) {
  const c = providerCredentials(p);
  const enabled = await getSetting<boolean>(`oauth.${p}.enabled`);
  return { configured: !!(c.id && c.secret), enabled, available: !!(c.id && c.secret) && enabled };
}
export async function redirectUri() {
  return `${await appUrl()}/auth/callback`;
}

export async function beginOAuth(p: Provider, mode: { link?: string; next?: string }) {
  const c = providerCredentials(p);
  const state = randomToken(24);
  const jar = await cookies();
  jar.set(STATE_COOKIE, JSON.stringify({ state, p, link: mode.link ?? null, next: mode.next ?? "/home" }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600,
  });
  const redirect = await redirectUri();
  if (p === "google") {
    const q = new URLSearchParams({ client_id: c.id!, redirect_uri: redirect, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({ client_id: c.id!, redirect_uri: redirect, response_type: "code", scope: "email,public_profile", state });
  return `https://www.facebook.com/v19.0/dialog/oauth?${q}`;
}

type Profile = { id: string; email?: string; emailVerified: boolean; name: string; picture?: string };

async function fetchProfile(p: Provider, code: string): Promise<Profile> {
  const c = providerCredentials(p);
  const redirect = await redirectUri();
  if (p === "google") {
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: c.id!, client_secret: c.secret!, redirect_uri: redirect, grant_type: "authorization_code" }),
    });
    if (!tok.ok) throw new Error("token exchange failed");
    const { access_token } = (await tok.json()) as { access_token: string };
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
    if (!info.ok) throw new Error("userinfo failed");
    const j = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    return { id: j.sub, email: j.email?.toLowerCase(), emailVerified: !!j.email_verified, name: j.name ?? "Google user", picture: j.picture };
  }
  const tok = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({ client_id: c.id!, client_secret: c.secret!, redirect_uri: redirect, code })}`);
  if (!tok.ok) throw new Error("token exchange failed");
  const { access_token } = (await tok.json()) as { access_token: string };
  const me = await fetch(`https://graph.facebook.com/v19.0/me?${new URLSearchParams({ fields: "id,name,email,picture.type(large)", access_token })}`);
  if (!me.ok) throw new Error("profile fetch failed");
  const j = (await me.json()) as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
  // Facebook does not expose an email_verified claim, so its email is never treated as verified.
  return { id: j.id, email: j.email?.toLowerCase(), emailVerified: false, name: j.name ?? "Facebook user", picture: j.picture?.data?.url };
}

export type OAuthOutcome = { ok: true; next: string } | { ok: false; error: string };

export async function finishOAuth(code: string | null, state: string | null, errorParam: string | null): Promise<OAuthOutcome> {
  const jar = await cookies();
  const raw = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (errorParam) return { ok: false, error: "Sign-in was cancelled or denied." };
  if (!raw || !code || !state) return { ok: false, error: "Invalid sign-in response." };
  let saved: { state: string; p: Provider; link: string | null; next: string };
  try { saved = JSON.parse(raw); } catch { return { ok: false, error: "Invalid sign-in response." }; }
  if (saved.state !== state) {
    await securityEvent("oauth.bad_state", null);
    return { ok: false, error: "Sign-in could not be verified. Please try again." };
  }
  const status = await providerStatus(saved.p);
  if (!status.available) return { ok: false, error: "This sign-in method is not available." };
  let profile: Profile;
  try { profile = await fetchProfile(saved.p, code); } catch { return { ok: false, error: "The provider rejected the sign-in. Please try again." }; }
  const db = await useDb();
  const [linked] = await db.select().from(schema.authAccounts).where(and(eq(schema.authAccounts.provider, saved.p), eq(schema.authAccounts.providerAccountId, profile.id))).limit(1);

  if (saved.link) { // linking from settings while signed in
    if (linked && linked.userId !== saved.link) return { ok: false, error: "That account is already linked to another Nargito user." };
    if (!linked) await db.insert(schema.authAccounts).values({ userId: saved.link, provider: saved.p, providerAccountId: profile.id });
    await audit(saved.link, "oauth.link", "user", saved.link, { provider: saved.p });
    return { ok: true, next: "/settings/security" };
  }
  if (linked) {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, linked.userId)).limit(1);
    if (!u || u.status === "banned" || u.deletedAt) return { ok: false, error: "This account is unavailable." };
    await createSession(u.id);
    await securityEvent("login.oauth", u.id, { provider: saved.p });
    return { ok: true, next: saved.next };
  }
  if (!profile.email) return { ok: false, error: "The provider did not share an email address. Register with email instead." };
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, profile.email)).limit(1);
  if (existing) {
    const autoLink = await getSetting<boolean>("oauth.autoLinkVerifiedEmail");
    if (!(autoLink && profile.emailVerified && existing.emailVerifiedAt)) {
      await securityEvent("oauth.link_refused", existing.id, { provider: saved.p });
      return { ok: false, error: "An account with this email already exists. Sign in with your password, then link the provider in Settings > Security." };
    }
    await db.insert(schema.authAccounts).values({ userId: existing.id, provider: saved.p, providerAccountId: profile.id });
    await createSession(existing.id);
    await securityEvent("login.oauth_linked", existing.id, { provider: saved.p });
    return { ok: true, next: saved.next };
  }
  if (!(await getSetting<boolean>("registration.enabled"))) return { ok: false, error: "Registration is currently closed." };
  const username = await generateUsername(profile.name);
  const [u] = await db.insert(schema.users).values({
    email: profile.email, username, displayName: profile.name.slice(0, 60), avatarUrl: profile.picture ?? null,
    emailVerifiedAt: profile.emailVerified ? new Date() : null,
    locale: await getSetting<string>("site.defaultLocale"),
  }).returning({ id: schema.users.id });
  await db.insert(schema.authAccounts).values({ userId: u!.id, provider: saved.p, providerAccountId: profile.id });
  await createSession(u!.id);
  await audit(u!.id, "user.register.oauth", "user", u!.id, { provider: saved.p });
  return { ok: true, next: "/onboarding" };
}
