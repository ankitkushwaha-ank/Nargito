import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ADMIN, registerUser, signIn, PASSWORD } from "./helpers";

test.describe.configure({ mode: "serial" });

let ctxA: BrowserContext, ctxB: BrowserContext, ctxAdmin: BrowserContext;
let alice: Page, bob: Page, admin: Page;
let aliceUser: { email: string; username: string; name: string };
let bobUser: { email: string; username: string; name: string };
const run = Date.now().toString(36);
const productTitle = `Vintage camera ${run}`;
let productUrl = "";
let postText = "";

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  ctxA = await browser.newContext(); ctxB = await browser.newContext(); ctxAdmin = await browser.newContext();
  alice = await ctxA.newPage(); bob = await ctxB.newPage(); admin = await ctxAdmin.newPage();
});
test.afterAll(async () => { await ctxA.close(); await ctxB.close(); await ctxAdmin.close(); });

test("1. register, verify email, sign out and sign in", async () => {
  aliceUser = await registerUser(alice, "alice");
  await expect(alice.getByRole("button", { name: "Account menu" })).toBeVisible();
  await alice.getByRole("button", { name: "Account menu" }).click();
  await alice.getByRole("menuitem", { name: "Sign out" }).click();
  await alice.waitForURL(/\/login/);
  await signIn(alice, aliceUser.email, PASSWORD);
  await expect(alice.getByLabel("Start a post").or(alice.getByRole("button", { name: "Start a post" }))).toBeVisible();
  bobUser = await registerUser(bob, "bob");
});

test("2. wrong password is rejected with a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(aliceUser.email);
  await page.getByLabel(/^Password/).fill("Not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("3. edit profile", async () => {
  await alice.goto("/settings/profile");
  await alice.getByLabel("Headline").fill("QA engineer and trip organiser");
  await alice.getByLabel("About").fill("I test things for a living and travel when I can.");
  await alice.getByRole("button", { name: "Save profile" }).click();
  await expect(alice.getByText("Profile updated.")).toBeVisible();
  await alice.goto(`/profile/${aliceUser.username}`);
  await expect(alice.getByText("QA engineer and trip organiser").first()).toBeVisible();
});

test("4. publish a post, like, comment, save and share", async () => {
  postText = `Hello Nargito from e2e ${run}`;
  await alice.goto("/home");
  await alice.getByRole("button", { name: "Start a post" }).first().click();
  await alice.getByLabel("What would you like to share?").fill(postText);
  await alice.getByRole("button", { name: "Post", exact: true }).click();
  const card = alice.locator("article", { hasText: postText }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "Like" }).click();
  await expect(card.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Comment" }).click();
  await card.getByLabel("Write a comment…").fill("First comment!");
  await card.getByRole("button", { name: "Post", exact: true }).click();
  await expect(card.getByText("First comment!")).toBeVisible();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("button", { name: "Saved" })).toBeVisible();
  await alice.goto("/saved");
  await expect(alice.getByText(postText.slice(0, 20))).toBeVisible();
});

test("5. create a trip, product, service and shop", async () => {
  await alice.goto("/my/trips/new");
  await alice.getByLabel(/^Title/).fill(`Spiti valley road trip ${run}`);
  await alice.getByLabel(/^Destination/).fill("Spiti, Himachal Pradesh");
  await alice.getByLabel("Status").selectOption("published");
  await alice.getByRole("button", { name: "Save trip" }).click();
  await alice.waitForURL(/\/trips\/[0-9a-f-]{36}/);
  await expect(alice.getByRole("heading", { name: new RegExp(`Spiti valley road trip ${run}`) })).toBeVisible();

  await alice.goto("/my/listings/product/new");
  await alice.getByLabel(/^Title/).fill(productTitle);
  await alice.getByLabel("Description").fill("Fully working film camera with a leather case.");
  await alice.getByLabel("Price").fill("4500");
  await alice.getByRole("button", { name: "Create listing" }).click();
  await alice.waitForURL(/\/products\/[0-9a-f-]{36}/);
  productUrl = new URL(alice.url()).pathname;
  await expect(alice.getByRole("heading", { name: productTitle })).toBeVisible();

  await alice.goto("/my/listings/service/new");
  await alice.getByLabel(/^Title/).fill(`Portrait photography ${run}`);
  await alice.getByRole("button", { name: "Create service" }).click();
  await alice.waitForURL(/\/services\/[0-9a-f-]{36}/);

  await alice.goto("/my/businesses/shop/new");
  await alice.getByLabel(/^Shop name/).fill(`Alice Camera Shop ${run}`);
  await alice.getByRole("button", { name: "Open shop" }).click();
  await alice.waitForURL(/\/shops\/[a-z0-9-]+/);
  await expect(alice.getByRole("heading", { name: new RegExp(`Alice Camera Shop ${run}`) })).toBeVisible();
});

test("6. enquire about a listing and exchange messages", async () => {
  await bob.goto(productUrl);
  await bob.getByRole("button", { name: "Enquire with seller" }).click();
  await bob.getByRole("button", { name: "Send enquiry" }).click();
  await bob.waitForURL(/\/messages\/[0-9a-f-]{36}/);
  await expect(bob.getByText(productTitle).first()).toBeVisible();
  const convoUrl = new URL(bob.url()).pathname;

  // repeating the enquiry reuses the same conversation
  await bob.goto(productUrl);
  await bob.getByRole("button", { name: "Enquire with seller" }).click();
  await bob.getByRole("button", { name: "Send enquiry" }).click();
  await bob.waitForURL(/\/messages\/[0-9a-f-]{36}/);
  expect(new URL(bob.url()).pathname).toBe(convoUrl);

  await alice.goto("/notifications");
  await expect(alice.getByText(/New enquiry/).first()).toBeVisible();
  await alice.getByText(/New enquiry/).first().click();
  await alice.waitForURL(/\/messages\/[0-9a-f-]{36}/);
  await alice.getByLabel("Write a message…").fill("Yes, it is still available!");
  await alice.getByRole("button", { name: "Send" }).click();
  await expect(alice.getByRole("log").getByText("Yes, it is still available!")).toBeVisible();

  await bob.reload();
  await expect(bob.getByRole("log").getByText("Yes, it is still available!")).toBeVisible();
  await expect(alice.getByText("Enquiry: responded")).toBeVisible({ timeout: 15_000 }).catch(async () => { await alice.reload(); await expect(alice.getByText("Enquiry: responded")).toBeVisible(); });

  // a third party cannot read the conversation
  const outsider = await (await bob.context().browser()!.newContext()).newPage();
  const res = await outsider.goto(convoUrl);
  expect([307, 404, 200]).toContain(res!.status());
  await expect(outsider.getByText("Yes, it is still available!")).toHaveCount(0);
  await outsider.context().close();
});

test("7. search finds public content", async () => {
  await bob.goto(`/search?q=${encodeURIComponent("Vintage camera " + run)}`);
  await expect(bob.getByRole("link", { name: new RegExp(productTitle) }).first()).toBeVisible();
  await bob.goto(`/search?q=${encodeURIComponent(aliceUser.name.split(" ")[0]!)}&type=people`);
  await expect(bob.getByText(aliceUser.name).first()).toBeVisible();
});

test("8. admin panel: authorised admin allowed, ordinary member denied", async () => {
  await signIn(admin, ADMIN.email, ADMIN.password);
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(admin.getByText("Registered users")).toBeVisible();
  await expect(admin.getByRole("link", { name: "Manage users" })).toBeVisible();

  const res = await alice.goto("/admin");
  await alice.waitForURL(/\/home\?denied=1/);
  expect(res).toBeTruthy();
  await expect(alice.getByText("You do not have access to that area.")).toBeVisible();
  const api = await alice.request.get("/api/admin/export?metric=summary");
  expect([401, 403]).toContain(api.status());
  await expect(alice.getByRole("link", { name: "Admin Panel" })).toHaveCount(0);
  await alice.getByRole("button", { name: "Account menu" }).click();
  await expect(alice.getByRole("menuitem", { name: "Admin Panel" })).toHaveCount(0);
  await admin.getByRole("button", { name: "Account menu" }).count();
});

test("9. feature flag has a real effect on pages and APIs", async () => {
  await admin.goto("/admin/features");
  await admin.getByRole("button", { name: "Disable Trips" }).click();
  await expect(admin.getByRole("button", { name: "Enable Trips" })).toBeVisible();
  await alice.goto("/trips");
  await expect(alice.getByText("This feature is unavailable")).toBeVisible();
  await admin.getByRole("button", { name: "Enable Trips" }).click();
  await expect(admin.getByRole("button", { name: "Disable Trips" })).toBeVisible();
  await alice.goto("/trips");
  await expect(alice.getByRole("heading", { name: "Trips" })).toBeVisible();
});

test("10. site settings take effect on public pages", async () => {
  const text = `Footer text from e2e ${run}`;
  await admin.goto("/admin/settings/website");
  await admin.getByLabel("Footer text").fill(text);
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText(/Saved 1 setting/)).toBeVisible();
  await bob.goto("/about");
  await expect(bob.getByText(text)).toBeVisible();
  await admin.getByLabel("Footer text").fill("Nargito helps people and businesses connect, travel and trade locally.");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText(/Saved 1 setting/)).toBeVisible();
});

test("11. report content and resolve it in moderation", async () => {
  await bob.goto("/home");
  await bob.getByRole("button", { name: "Start a post" }).first().click();
  const bad = `Totally spammy buy-now post ${run}`;
  await bob.getByLabel("What would you like to share?").fill(bad);
  await bob.getByRole("button", { name: "Post", exact: true }).click();
  await expect(bob.locator("article", { hasText: bad }).first()).toBeVisible({ timeout: 20_000 });
  await alice.goto("/home?tab=all");
  const card = alice.locator("article", { hasText: bad }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "Report" }).click();
  await alice.getByRole("button", { name: "Send report" }).click();
  await expect(alice.getByText(/moderators will review/)).toBeVisible();

  await admin.goto("/admin/reports");
  await admin.getByRole("link", { name: "Review" }).first().click();
  await admin.getByLabel("Action").selectOption("remove_content");
  await admin.getByLabel(/Notes \/ reason/).fill("Spam");
  await admin.getByRole("button", { name: "Apply" }).click();
  await expect(admin.getByText("Report updated.")).toBeVisible();
  await alice.goto("/home");
  await expect(alice.locator("article", { hasText: bad })).toHaveCount(0);
});

test("12. private data is not exposed publicly", async ({ request }) => {
  const html = await (await request.get(`/profile/${aliceUser.username}`)).text();
  expect(html).not.toMatch(/geo_cell|geoCell|"lat"|"lng"|latitude|longitude/i);
  expect(html).not.toContain(aliceUser.email);
  expect((await request.get("/api/conversations/00000000-0000-0000-0000-000000000000/messages")).status()).toBe(401);
  expect((await request.get("/api/account/export")).status()).toBe(401);
  const feed = await (await request.get("/api/feed")).text();
  expect(feed).not.toMatch(/geoCell|passwordHash|"email"\s*:/);
});

test("13. language and theme switching", async () => {
  await alice.goto("/home");
  const menuBtn = alice.locator("header button[aria-haspopup='menu']").last();
  const openMenu = async () => { if (!(await alice.getByRole("radiogroup").isVisible())) await menuBtn.click(); };
  await openMenu();
  await alice.getByRole("combobox").filter({ has: alice.locator("option[value='hi']") }).selectOption("hi");
  await expect(alice.locator("html")).toHaveAttribute("lang", "hi", { timeout: 15_000 });
  await expect(alice.getByText("होम").first()).toBeVisible({ timeout: 15_000 });
  await openMenu();
  await alice.getByRole("radiogroup").getByRole("radio", { name: "डार्क" }).click();
  await expect(alice.locator("html")).toHaveClass(/dark/);
  await alice.getByRole("radiogroup").getByRole("radio", { name: "लाइट" }).click();
  await expect(alice.locator("html")).not.toHaveClass(/dark/);
  await alice.getByRole("combobox").filter({ has: alice.locator("option[value='en']") }).selectOption("en");
  await expect(alice.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 });
});
test("14. PWA manifest, icons and offline page", async ({ request, page }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBeTruthy();
  expect(m.icons.length).toBeGreaterThanOrEqual(3);
  expect(m.display).toBe("standalone");
  expect((await request.get("/icons/icon-512.png")).status()).toBe(200);
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain('url.pathname.startsWith("/api/")');
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
});

test("15. responsive layout: mobile bottom navigation and no horizontal overflow", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: await ctxA.storageState() });
  const page = await ctx.newPage();
  await page.goto("/home");
  await expect(page.getByRole("navigation", { name: "Primary mobile" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await ctx.close();
});

test("16. seeded demo accounts can sign in and see real content", async ({ browser }) => {
  for (const [email, pw, expectText] of [["demo@nargito.local", "Demo@12345", "Aarav Sharma"], ["moderator@nargito.local", "Moderator@2026", "Dashboard"]] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, email, pw);
    if (expectText === "Dashboard") { await page.goto("/admin"); await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible(); await expect(page.getByRole("link", { name: "Roles & permissions" })).toHaveCount(0); }
    else await expect(page.getByText(expectText).first()).toBeVisible();
    await ctx.close();
  }
});