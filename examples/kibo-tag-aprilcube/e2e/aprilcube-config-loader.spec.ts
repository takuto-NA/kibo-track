/**
 * Verifies AprilCube official config.json loading in the browser UI.
 */
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryRootDirectory = join(currentDirectory, "../../..");
const stickConfigPath = join(
  repositoryRootDirectory,
  "tests",
  "fixtures",
  "aprilcube-official",
  "stick-1x1x6-config.json",
);

test.describe("AprilCube config loader", () => {
  test("loads stick config via file picker and updates status text", async ({ page }) => {
    await page.goto("/");

    await page.locator("#aprilcube-config-file-input").setInputFiles(stickConfigPath);

    await expect(page.locator("#aprilcube-config-status")).toContainText("loaded: stick-1x1x6");
    await expect(page.locator("#aprilcube-config-status")).toContainText("dict=4x4_100");
    await expect(page.locator("#aprilcube-config-status")).toContainText("tags=26");
    await expect(page.locator("#aprilcube-config-status")).toContainText("box=40x40x215mm");
  });
});
