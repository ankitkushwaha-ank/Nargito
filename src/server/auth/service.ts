import "server-only";
import { and, eq, gt, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { useDb, schema } from "../db";
import { hashPassword, verifyPassword, DUMMY_HASH, passwordProblem } from "./password";
import { createSession, revokeAllSessions } from "./session";
import { verifyTotp } from "./totp";
import { randomCode, randomToken, sha256, slugify, uniqueSuffix, ok, fail, type ActionResult } from "../util";
import { enforceRateLimit } from "../ratelimit";
import { getSetting } from "../settings";
import { audit, securityEvent } from "../log";
import { sendEmail, appUrl, emailDeliveryAvailable } from "../mail";
import { parseInput } from "../validation";
import { devOutboxEnabled } from "../devbox";
import { AppError } from "../util";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const RESERVED = new Set(["admin", "administrator", "root", "support", "nargito", "api", "login", "register", "settings", "help", "system", "moderator"]);

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, "3-30 characters: letters, numbers, underscore."),
  displayName: z.string().trim().min(2, "Enter your name.").max(60),
  password: z.string().max(128),
  accountType: z.enum(["personal", "business"]).default("personal"),
  acceptTerms: z.preprocess((v) => v === "on" || v === "true" || v === true, z.literal(true, { message: "Accept the terms to continue." })),
});

async function issueVerification(userId: string, email: string, type: "email_verify" | "password_reset") {
  const db = await useDb();
  const expiryMin = await getSetting<number>("otp.expiryMinutes");
  const token = randomToken(24);
  const code: string | undefined = type === "email_verify" ? randomCode() : undefined;
  await db.update(schema.verificationTokens).set({ usedAt: new Date() }).where(and(eq(schema.verificationTokens.userId, userId), eq(schema.verificationTokens.type, type), isNull(schema.verificationTokens.usedAt)));
  await db.insert(schema.verificationTokens).values({
    userId, type, tokenHash: sha256(token), codeHash: code ? sha256(`${userId}:${code}`) : null,
    expiresAt: new Date(Date.now() + expiryMin * 60_000),
  });
  const base = await appUrl();
  if (type === "email_verify") {
    const link = `${base}/verify-otp?token=${token}`;
    const text = `Your Nargito verification code is ${code}. It expires in ${expiryMin} minutes.\nOr open: ${link}`;
    const res = await sendEmail(email, "Verify your Nargito account", `<p>Your Nargito verification code is <b style="font-size:20px;letter-spacing:3px">${code}</b>.</p><p>It expires in ${expiryMin} minutes.</p><p><a href="${link}">Verify my email</a></p>`, text);
    return { res, devCode: devOutboxEnabled() && !res.delivered ? code : undefined };
  }
  const link = `${base}/reset-password?token=${token}`;
  const res = await sendEmail(email, "Reset your Nargito password", `<p>Use the link below to choose a new password. It expires in ${expiryMin} minutes.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this you can ignore this email.</p>`, `Reset your Nargito password: ${link}`);
  return { res, devLink: devOutboxEnabled() && !res.delivered ? link : undefined };
}

export async function registerUser(input: unknown): Promise<ActionResult<{ email: string; devCode?: string; instant?: boolean; business?: boolean }>> {
  await enforceRateLimit("register", 8, 3600);
  if (!(await getSetting<boolean>("registration.enabled"))) return fail("Registration is currently closed.");
  const p = parseInput(registerSchema, input);
  if (!p.ok) return p.result;
  const { email, username, displayName, password, accountType } = p.data;
  const pwProblem = passwordProblem(password);
  if (pwProblem) return fail(pwProblem, { password: pwProblem });
  if (RESERVED.has(username)) return fail("That username is not available.", { username: "That username is not available." });
  const db = await useDb();
  const mailReady = await emailDeliveryAvailable();
  const existingEmail = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const takenName = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).limit(1);
  if (takenName[0] && !existingEmail[0]) return fail("That username is taken.", { username: "That username is taken." });
  if (existingEmail[0] && !mailReady) return fail("An account with this email already exists. Try signing in instead.", { email: "Already registered" });
  if (existingEmail[0]) {
    // Neutral response: never reveal that the address is registered.
    await sendEmail(email, "Nargito account notice", "<p>Someone tried to register with this address. If it was you, sign in or reset your password.</p>", "Someone tried to register with this address. If it was you, sign in or reset your password.");
    await securityEvent("register.duplicate_email", existingEmail[0].id);
    return ok({ email }, "If this address can be used, a verification code has been sent.");
  }
  const defaultVis = await getSetting<string>("defaults.profileVisibility");
  const [user] = await db.insert(schema.users).values({
    email, username, displayName, accountType, passwordHash: await hashPassword(password), profileVisibility: defaultVis, locale: await getSetting<string>("site.defaultLocale"),
  }).returning({ id: schema.users.id });
  if (!mailReady) {
    // No email provider: there is no way to deliver a code, so the address is accepted as-is and the member signs straight in.
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user!.id));
    await createSession(user!.id);
    await audit(user!.id, "user.register", "user", user!.id);
    return ok({ email, instant: true, business: accountType === "business" }, "Welcome to Nargito.");
  }
  const v = await issueVerification(user!.id, email, "email_verify");
  await audit(user!.id, "user.register", "user", user!.id);
  return ok({ email, devCode: v.devCode }, "Account created. Enter the code we sent to verify your email.");
}

export async function verifyEmailCode(emailRaw: string, code: string): Promise<ActionResult> {
  const email = emailRaw.trim().toLowerCase();
  await enforceRateLimit("verify-otp", 10, 900, email);
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const maxAttempts = await getSetting<number>("otp.maxAttempts");
  if (!u) return fail("Invalid or expired code.");
  const [t] = await db.select().from(schema.verificationTokens)
    .where(and(eq(schema.verificationTokens.userId, u.id), eq(schema.verificationTokens.type, "email_verify"), isNull(schema.verificationTokens.usedAt), gt(schema.verificationTokens.expiresAt, new Date())))
    .orderBy(desc(schema.verificationTokens.createdAt)).limit(1);
  if (!t || t.attempts >= maxAttempts) return fail("Invalid or expired code. Request a new one.");
  if (!t.codeHash || t.codeHash !== sha256(`${u.id}:${code.trim()}`)) {
    await db.update(schema.verificationTokens).set({ attempts: sql`${schema.verificationTokens.attempts} + 1` }).where(eq(schema.verificationTokens.id, t.id));
    await securityEvent("verify.bad_code", u.id);
    return fail("Invalid or expired code.");
  }
  await completeVerification(t.id, u.id);
  return ok(undefined, "Email verified.");
}

export async function verifyEmailToken(token: string): Promise<ActionResult> {
  await enforceRateLimit("verify-token", 20, 900);
  const db = await useDb();
  const [t] = await db.select().from(schema.verificationTokens)
    .where(and(eq(schema.verificationTokens.tokenHash, sha256(token)), eq(schema.verificationTokens.type, "email_verify"), isNull(schema.verificationTokens.usedAt), gt(schema.verificationTokens.expiresAt, new Date()))).limit(1);
  if (!t) return fail("This verification link is invalid or has expired.");
  await completeVerification(t.id, t.userId);
  return ok(undefined, "Email verified.");
}

async function completeVerification(tokenId: string, userId: string) {
  const db = await useDb();
  await db.update(schema.verificationTokens).set({ usedAt: new Date() }).where(eq(schema.verificationTokens.id, tokenId));
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
  await createSession(userId); // fresh session after proving mailbox ownership
  await audit(userId, "user.email_verified", "user", userId);
}

export async function resendVerification(emailRaw: string): Promise<ActionResult<{ devCode?: string }>> {
  const email = emailRaw.trim().toLowerCase();
  await enforceRateLimit("resend", await getSetting<number>("otp.rateLimitPerHour"), 3600, email);
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  let devCode: string | undefined;
  if (u && !u.emailVerifiedAt) devCode = (await issueVerification(u.id, u.email, "email_verify")).devCode;
  return ok({ devCode }, "If the address is awaiting verification, a new code has been sent.");
}

export async function loginUser(input: { email: string; password: string; totp?: string }): Promise<ActionResult<{ mfaRequired?: boolean }>> {
  const email = String(input.email ?? "").trim().toLowerCase();
  await enforceRateLimit("login-ip", 20, 900);
  await enforceRateLimit("login-acct", 8, 900, email);
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt))).limit(1);
  const valid = await verifyPassword(String(input.password ?? ""), u?.passwordHash ?? DUMMY_HASH);
  if (!u || !u.passwordHash || !valid || u.status === "banned") {
    await securityEvent("login.failed", u?.id ?? null, { email_hash: sha256(email).slice(0, 12) });
    return fail("Incorrect email or password.");
  }
  if (u.mfaEnabled && u.mfaSecret) {
    if (!input.totp) return { ok: true, data: { mfaRequired: true } };
    if (!verifyTotp(u.mfaSecret, input.totp)) {
      await securityEvent("login.bad_totp", u.id);
      return fail("Invalid authentication code.");
    }
  }
  await createSession(u.id);
  await securityEvent("login.success", u.id);
  return ok({});
}

export async function requestPasswordReset(emailRaw: string): Promise<ActionResult<{ devLink?: string }>> {
  const email = emailRaw.trim().toLowerCase();
  await enforceRateLimit("pw-reset-ip", 10, 3600);
  await enforceRateLimit("pw-reset", await getSetting<number>("otp.rateLimitPerHour"), 3600, email);
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt))).limit(1);
  let devLink: string | undefined;
  if (u && u.status !== "banned") devLink = (await issueVerification(u.id, u.email, "password_reset")).devLink;
  return ok({ devLink }, "If an account exists for that address, a reset link has been sent.");
}

export async function resetPassword(token: string, password: string): Promise<ActionResult> {
  await enforceRateLimit("pw-reset-use", 10, 900);
  const problem = passwordProblem(password);
  if (problem) return fail(problem, { password: problem });
  const db = await useDb();
  const [t] = await db.select().from(schema.verificationTokens)
    .where(and(eq(schema.verificationTokens.tokenHash, sha256(token)), eq(schema.verificationTokens.type, "password_reset"), isNull(schema.verificationTokens.usedAt), gt(schema.verificationTokens.expiresAt, new Date()))).limit(1);
  if (!t) return fail("This reset link is invalid or has expired.");
  await db.update(schema.verificationTokens).set({ usedAt: new Date() }).where(eq(schema.verificationTokens.id, t.id));
  await db.update(schema.users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(schema.users.id, t.userId));
  await revokeAllSessions(t.userId);
  await securityEvent("password.reset", t.userId);
  return ok(undefined, "Password updated. You can sign in now.");
}

export async function changePassword(userId: string, current: string, next: string, keepHash: string): Promise<ActionResult> {
  const problem = passwordProblem(next);
  if (problem) return fail(problem, { password: problem });
  await enforceRateLimit("pw-change", 6, 900, userId);
  const db = await useDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u?.passwordHash || !(await verifyPassword(current, u.passwordHash))) return fail("Current password is incorrect.", { current: "Current password is incorrect." });
  await db.update(schema.users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(schema.users.id, userId));
  await revokeAllSessions(userId, keepHash);
  await securityEvent("password.changed", userId);
  return ok(undefined, "Password changed. Other sessions were signed out.");
}

/** Unique username derived from a display name, used by OAuth sign-ups. */
export async function generateUsername(base: string) {
  const db = await useDb();
  let candidate = slugify(base, 20).replace(/-/g, "_");
  if (candidate.length < 3) candidate = `user_${candidate}`;
  for (let i = 0; i < 6; i++) {
    const name = i === 0 ? candidate : `${candidate}_${uniqueSuffix()}`;
    if (RESERVED.has(name)) continue;
    const r = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, name)).limit(1);
    if (!r[0]) return name;
  }
  return `user_${uniqueSuffix()}${uniqueSuffix()}`;
}

export function assertOk<T>(r: ActionResult<T>): T | undefined {
  if (!r.ok) throw new AppError(400, r.error);
  return r.data;
}
