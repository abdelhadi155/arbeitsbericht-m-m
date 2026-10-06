import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-End-to-End-Tests.
 *
 *   npm run test:e2e
 *
 * Baut die App und startet sie auf Port 3100. Alle Geräteprofile laufen mit Chromium
 * (Touch, Pixeldichte und Bildschirmgröße werden emuliert).
 * Eigener Chromium-Pfad optional über PW_CHROMIUM_PATH.
 */
const PORT = 3100;
const chromium = (device: (typeof devices)[string]) => ({
  ...device,
  browserName: "chromium" as const,
  launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
});

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
  projects: [
    { name: "iPhone SE", use: chromium(devices["iPhone SE"]) },
    { name: "iPhone 15", use: chromium(devices["iPhone 15"]) },
    {
      name: "Android groß",
      use: chromium({ ...devices["Pixel 7"], viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 }),
    },
    { name: "Tablet", use: chromium(devices["iPad (gen 7)"]) },
    { name: "Desktop", use: chromium({ ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }) },
  ],
});
