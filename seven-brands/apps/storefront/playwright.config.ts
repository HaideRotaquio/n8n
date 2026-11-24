import { defineConfig, devices } from "@playwright/test";

const PORT = 3299;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://daos:daos_dev_only@localhost:5432/daos_e2e_test";
/** Brands are resolved from the host; Chromium maps *.localhost to 127.0.0.1. */
export const STORE_URL = `http://moodicons.localhost:${PORT}`;
export const OTHER_STORE_URL = `http://sonicglyphs.localhost:${PORT}`;
export const UNKNOWN_HOST_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: STORE_URL, trace: "off" },
  timeout: 90_000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx e2e/setup-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456",
      STORAGE_DRIVER: "fs",
      STORAGE_FS_ROOT: `${process.cwd()}/.data/e2e-storage`,
      STORAGE_SIGNING_SECRET: "e2e-storage-secret-e2e-storage-secret-01",
      AUTH_RATE_LIMIT: "off",
      // Labelled test payment provider: no real payments, orders marked as tests.
      COMMERCE_PROVIDER: "test",
      COMMERCE_TEST_SECRET: "e2e-commerce-test-secret-0123456789",
    },
  },
});
