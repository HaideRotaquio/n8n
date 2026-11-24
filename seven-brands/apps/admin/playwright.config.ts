import { defineConfig, devices } from "@playwright/test";

const PORT = 3199;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://daos:daos_dev_only@localhost:5432/daos_e2e_test";
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "off" },
  timeout: 90_000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Reset + seed the E2E database before the server starts, so the health check can pass.
    // The production worker runs next to the app so queued jobs actually execute.
    command: `npx tsx e2e/setup-db.ts && (npx tsx ../../services/worker/src/main.ts & npx next start -p ${PORT})`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false, // fail loudly if something else holds the port
    timeout: 60_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      ADMIN_BASE_URL: BASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456",
      STORAGE_DRIVER: "fs",
      // Absolute so the admin and the worker (different working directories) share one store.
      STORAGE_FS_ROOT: `${process.cwd()}/.data/e2e-storage`,
      STORAGE_SIGNING_SECRET: "e2e-storage-secret-e2e-storage-secret-01",
      // The sign-in limiter (5/min) is covered by unit tests; E2E signs in more often than that.
      AUTH_RATE_LIMIT: "off",
      // Explicit, labelled stand-in for the AI provider so the AI flow is tested without an API key.
      DAOS_AI_PROVIDER: "fixture",
    },
  },
});
