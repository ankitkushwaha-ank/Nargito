import "server-only";
import { useDb, schema } from "./db";
import { getSetting } from "./settings";
import { logSystem } from "./log";

export function mailConfigStatus() {
  return {
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    resend: !!process.env.RESEND_API_KEY,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
  };
}

async function record(to: string, subject: string, kind: "email" | "sms", status: "sent" | "skipped" | "failed", provider: string | null, error?: string) {
  const db = await useDb();
  await db.insert(schema.emailLog).values({ toAddress: to, subject, kind, status, provider, error: error?.slice(0, 300) ?? null });
}

/** True when verification emails can really be delivered (a provider is selected AND its credentials exist). */
export async function emailDeliveryAvailable() {
  const provider = await getSetting<string>("mail.provider");
  const st = mailConfigStatus();
  return (provider === "smtp" && st.smtp) || (provider === "resend" && st.resend);
}

export type SendResult = { delivered: boolean; reason?: string };

/** Sends through the configured provider only. Without a provider the message is logged as "skipped". */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  const provider = await getSetting<string>("mail.provider");
  const fromName = await getSetting<string>("mail.fromName");
  const fromAddr = await getSetting<string>("mail.fromAddress");
  const from = `${fromName} <${fromAddr}>`;
  const status = mailConfigStatus();
  try {
    if (provider === "resend" && status.resend) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html, text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
      await record(to, subject, "email", "sent", "resend");
      return { delivered: true };
    }
    if (provider === "smtp" && status.smtp) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({ from, to, subject, html, text });
      await record(to, subject, "email", "sent", "smtp");
      return { delivered: true };
    }
    await record(to, subject, "email", "skipped", provider === "none" ? null : provider, "provider not configured");
    if (process.env.NODE_ENV !== "production") console.log(`\n[mail:skipped] to=${to} subject=${subject}\n${text}\n`);
    return { delivered: false, reason: "Email provider is not configured." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await record(to, subject, "email", "failed", provider, msg);
    await logSystem("error", "mail", "sendEmail", "Email delivery failed", { provider, error: msg });
    return { delivered: false, reason: "Email delivery failed." };
  }
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const provider = await getSetting<string>("sms.provider");
  const status = mailConfigStatus();
  if (provider !== "twilio" || !status.twilio) {
    await record(to, "sms", "sms", "skipped", provider === "none" ? null : provider, "provider not configured");
    return { delivered: false, reason: "SMS provider is not configured." };
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
    await record(to, "sms", "sms", "sent", "twilio");
    return { delivered: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    await record(to, "sms", "sms", "failed", "twilio", msg);
    return { delivered: false, reason: "SMS delivery failed." };
  }
}

export async function appUrl() {
  return (process.env.APP_URL || (await getSetting<string>("site.baseUrl")) || "http://localhost:3000").replace(/\/$/, "");
}
