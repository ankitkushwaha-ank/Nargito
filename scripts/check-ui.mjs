// Quick UI/behaviour probe: logs in, exercises post buttons, takes desktop + mobile screenshots.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const base = process.argv[2] ?? "http://localhost:3100";
const out = ".data/shots";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
async function login(ctx, email, pw) {
  const p = await ctx.newPage();
  await p.goto(base + "/login");
  await p.getByLabel(/email/i).fill(email);
  await p.getByLabel(/^password/i).fill(pw);
  await p.getByRole("button", { name: /sign in/i }).last().click();
  await p.waitForURL(/\/(home|admin|onboarding)/, { timeout: 20000 });
  return p;
}
const log = (m) => console.log(m);
// ---- desktop member
const d = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await login(d, "demo@nargito.local", "Demo@12345");
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
await page.goto(base + "/home"); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/home-desktop.png` });
const card = page.locator("article").first();
await card.getByRole("button", { name: "Like" }).click(); await page.waitForTimeout(600);
log("like pressed: " + (await card.getByRole("button", { name: "Like" }).getAttribute("aria-pressed")));
await card.getByRole("button", { name: "Comment" }).click(); await page.waitForTimeout(800);
const cm = card.getByLabel("Write a comment…");
if (await cm.count()) { await cm.fill("Nice one"); await cm.press("Enter"); await page.waitForTimeout(800); log("comment visible: " + (await card.getByText("Nice one").count())); } else log("comment box missing");
await card.getByRole("button", { name: /^Save/ }).click(); await page.waitForTimeout(600);
log("save pressed: " + (await card.getByRole("button", { name: /Saved|Save/ }).first().getAttribute("aria-pressed")));
await card.getByRole("button", { name: /copy link/i }).click(); await page.waitForTimeout(500);
log("copy msg: " + (await card.getByRole("status").allTextContents()).join("|"));
const sh = card.getByRole("button", { name: "Share" });
if (await sh.count()) { await sh.click(); await page.waitForTimeout(300); log("share panel: " + (await card.getByText("Share to my profile").count())); }
const rep = card.getByRole("button", { name: "Report" });
log("report buttons: " + (await rep.count()));
if (await rep.count()) { await rep.first().click(); await page.waitForTimeout(400); log("report dialog: " + (await page.getByRole("dialog").count())); await page.keyboard.press("Escape"); }
log("api/console errors: " + JSON.stringify(errors, null, 1));
await page.goto(base + "/profile/aarav_sharma"); await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/profile-desktop.png` });
await page.getByRole("link", { name: "Trips" }).first().click(); await page.waitForTimeout(1200);
log("profile tab url: " + page.url() + " scrollY=" + (await page.evaluate(() => scrollY)));
await page.goto(base + "/trips"); await page.waitForTimeout(1000); await page.screenshot({ path: `${out}/trips-desktop.png` });
await page.goto(base + "/shops/ananyas-bakehouse"); await page.waitForTimeout(1000); await page.screenshot({ path: `${out}/shop-desktop.png`, fullPage: true });
await d.close();
// ---- admin desktop + mobile
const a = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const ap = await login(a, "admin@nargito.local", "Admin-Nargito-2026");
await ap.goto(base + "/admin"); await ap.waitForTimeout(1500); await ap.screenshot({ path: `${out}/admin-desktop.png`, fullPage: true });
await ap.goto(base + "/admin/branding"); await ap.waitForTimeout(800); await ap.screenshot({ path: `${out}/admin-branding.png` });
await ap.goto(base + "/admin/users?view=grid"); await ap.waitForTimeout(800); await ap.screenshot({ path: `${out}/admin-users-grid.png` });
await a.close();
const am = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const amp = await login(am, "admin@nargito.local", "Admin-Nargito-2026");
await amp.goto(base + "/admin"); await amp.waitForTimeout(1200); await amp.screenshot({ path: `${out}/admin-mobile.png` });
await amp.getByRole("button", { name: "Open admin menu" }).click(); await amp.waitForTimeout(400); await amp.screenshot({ path: `${out}/admin-mobile-menu.png` });
await am.close();
// ---- mobile member + guest
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const g = await m.newPage();
for (const [n, u] of [["landing", "/"], ["login", "/login"], ["register", "/register"], ["trips", "/trips"]]) { await g.goto(base + u); await g.waitForTimeout(900); await g.screenshot({ path: `${out}/m-${n}.png`, fullPage: n === "landing" }); }
const mp = await login(m, "demo@nargito.local", "Demo@12345");
for (const [n, u] of [["home", "/home"], ["profile", "/profile/aarav_sharma"], ["settings-profile", "/settings/profile"]]) { await mp.goto(base + u); await mp.waitForTimeout(1200); await mp.screenshot({ path: `${out}/m-${n}.png` }); }
await mp.goto(base + "/home"); await mp.getByRole("button", { name: "Create" }).click(); await mp.waitForTimeout(400); await mp.screenshot({ path: `${out}/m-create-sheet.png` });
await browser.close();
console.log("done");
