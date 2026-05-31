/**
 * Playwright configuration for browser smoke and optional real-camera gates.
 */
import { defineConfig, devices } from "@playwright/test";

const FAKE_CAMERA_LAUNCH_ARGS = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "./test-results/playwright",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
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
      name: "chromium-static-image",
      testMatch: /static-aprilcube-image\.spec\.ts/,
      timeout: 600_000,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    ...(process.env.RUN_REAL_CAMERA
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
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
