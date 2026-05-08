import { defineConfig } from "@playwright/test";

/**
 * Phase 1d — Playwright config for RLS tenant-isolation tests.
 * These tests require service-role + 2 distinct seeded users (org A / org B).
 * They are NOT run in CI by default (no DB credentials in the public sandbox).
 *
 * To run locally:
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_URL=... \
 *   ORG_A_USER_ID=... ORG_B_USER_ID=... \
 *   npx playwright test
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8080",
  },
});
