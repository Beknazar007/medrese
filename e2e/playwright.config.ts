import { defineConfig, devices } from "@playwright/test";

// The stand: backend on a throwaway SQLite database with made-up people (fixtures/seed.py)
// and the Vite dev server pointed at it. Never run these tests against production.
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "8765";
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "5175";
const PYTHON = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // one shared stand database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Phone first: teachers use the app on a phone. Desktop for rector/dean screens.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `${PYTHON} fixtures/start_backend.py`,
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Extra stand data for feature tests (seed.py); video recording starts the stand without it.
      env: { E2E_EXTRA_DATA: "1" },
    },
    {
      command: `npm --prefix ../frontend run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1` },
    },
  ],
});
