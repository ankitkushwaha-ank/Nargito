import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  // Builds must exist (`npm run build`). Reuses a running server if there is one.
  webServer: process.env.E2E_BASE_URL ? undefined : { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
