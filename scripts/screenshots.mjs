// Captures review screenshots: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? ".data/shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function login(ctx, email, password) {
  const page = await ctx.newPage();
  await page.goto(base + "/login");
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(home|admin|onboarding)/);
  return page;
}
const shot = async (page, path, name, opts = {}) => { await page.goto(base + path, { waitUntil: "networkidle" }); await page.waitForTimeout(3200); await page.screenshot({ path: `${out}/${name}.png`, fullPage: opts.full ?? false }); console.log("saved", name); };

const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const g = await guest.newPage();
await shot(g, "/", "01-landing", { full: true });
await shot(g, "/login", "02-login");
await shot(g, "/register", "03-register");
await shot(g, "/trips", "04-trips");
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await shot(await mob.newPage(), "/", "05-landing-mobile");

const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const m = await login(memberCtx, "demo@nargito.local", "Demo@12345");
await shot(m, "/home", "10-home");
await shot(m, "/profile/demo", "11-profile");
await shot(m, "/messages", "12-messages");
const link = await m.locator('a[href^="/messages/"]').first().getAttribute("href").catch(() => null);
if (link) await shot(m, link, "13-conversation");
await shot(m, "/connections", "14-connections");
await shot(m, "/notifications", "15-notifications");
await shot(m, "/explore", "16-explore", { full: true });
await shot(m, "/shops/ananyas-bakehouse", "17-shop", { full: true });
const trip = await m.request.get(base + "/trips").then((r) => r.text()).then((t) => t.match(/\/trips\/[0-9a-f-]{36}/)?.[0]);
if (trip) await shot(m, trip, "18-trip", { full: true });
const mm = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await memberCtx.storageState() });
await shot(await mm.newPage(), "/home", "19-home-mobile");

const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await login(adminCtx, "admin@nargito.local", "Admin-Nargito-2026");
await shot(a, "/admin", "20-admin", { full: true });
await browser.close();
