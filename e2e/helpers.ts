import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "admin@nargito.local", password: process.env.SEED_ADMIN_PASSWORD ?? "Admin-Nargito-2026" };
export const PASSWORD = "Test-Passw0rd-2026";

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(home|onboarding|admin)/);
}

/** Registers a user, reads the development verification code shown on the page, and completes onboarding. */
export async function registerUser(page: Page, tag: string) {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  const user = { email: `${tag}-${stamp}@example.test`, username: `${tag}_${stamp}`.slice(0, 28), name: `${tag[0]!.toUpperCase()}${tag.slice(1)} Tester` };
  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  // With no email provider configured, accounts are accepted instantly and the member lands on onboarding.
  await page.waitForURL(/onboarding/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/home/);
  return user;
}
