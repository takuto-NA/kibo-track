/**
 * Playwright configuration for browser smoke and optional real-camera gates.
 */
import { defineConfig, devices } from "@playwright/test";

const FAKE_CAMERA_LAUNCH_ARGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];

const browserTestsEnabled = Boolean(process.env.RUN_BROWSER_TESTS);
const pagesBrowserTestsEnabled = Boolean(process.env.RUN_PAGES_BROWSER_TESTS);
const realCameraTestsEnabled = Boolean(process.env.RUN_REAL_CAMERA);
const GITHUB_PAGES_PROJECT_SITE_BASE_PATH = "/kibo-track/";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "./test-results/playwright",
  use: {
    baseURL: pagesBrowserTestsEnabled
      ? `http://127.0.0.1:4173${GITHUB_PAGES_PROJECT_SITE_BASE_PATH}`
      : "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    ...(pagesBrowserTestsEnabled
      ? [
          {
            name: "chromium-pages-demo",
            testMatch: /pages-demo\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              launchOptions: {
                args: FAKE_CAMERA_LAUNCH_ARGS,
              },
            },
          },
        ]
      : []),
    ...(browserTestsEnabled
      ? [
          {
            name: "chromium-fake-camera",
            testMatch: /camera-startup\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              launchOptions: {
                args: FAKE_CAMERA_LAUNCH_ARGS,
              },
            },
          },
          {
            name: "chromium-aprilcube-config-loader",
            testMatch: /aprilcube-config-loader\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
            },
          },
          {
            name: "chromium-static-image",
            testMatch: /static-aprilcube-image\.spec\.ts/,
            timeout: 600_000,
            use: {
              ...devices["Desktop Chrome"],
            },
          },
        ]
      : []),
    ...(realCameraTestsEnabled
      ? [
          {
            name: "chromium-real-camera",
            testMatch: /real-camera\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              headless: false,
            },
          },
        ]
      : []),
  ],
  webServer: browserTestsEnabled || pagesBrowserTestsEnabled || realCameraTestsEnabled
    ? {
        command: pagesBrowserTestsEnabled
          ? "npm run build:pages && npm run preview:pages"
          : "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
        url: pagesBrowserTestsEnabled
          ? `http://127.0.0.1:4173${GITHUB_PAGES_PROJECT_SITE_BASE_PATH}`
          : "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
