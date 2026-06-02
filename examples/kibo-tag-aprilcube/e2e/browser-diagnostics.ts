/**
 * Playwright browser diagnostics collector for example smoke tests.
 */
import type { ConsoleMessage, Page, Request } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export interface BrowserDiagnosticsSnapshot {
  consoleMessages: string[];
  pageErrors: string[];
  requestFailures: string[];
  failedResponses: string[];
  appStatus: string;
  cameraStatus: string;
  resolutionStatus: string;
  diagnosticsText: string;
}

export interface BrowserDiagnosticsCollector {
  readonly snapshot: BrowserDiagnosticsSnapshot;
  attach(page: Page): void;
  assertClean(options?: { allowConsoleErrorPatterns?: RegExp[] }): void;
  writeFailureArtifacts(outputDirectory: string, testName: string): Promise<void>;
}

/** Sanitizes a Playwright test title for use as a filesystem artifact name. */
function sanitizeArtifactFileStem(testName: string): string {
  return testName.replace(/[<>:"/\\|?*]/g, "-");
}

export function createBrowserDiagnosticsCollector(): BrowserDiagnosticsCollector {
  const snapshot: BrowserDiagnosticsSnapshot = {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    failedResponses: [],
    appStatus: "",
    cameraStatus: "",
    resolutionStatus: "",
    diagnosticsText: "",
  };

  return {
    get snapshot() {
      return snapshot;
    },
    attach(page: Page) {
      page.on("console", (message: ConsoleMessage) => {
        snapshot.consoleMessages.push(`${message.type()}: ${message.text()}`);
      });

      page.on("pageerror", (error: Error) => {
        snapshot.pageErrors.push(error.message);
      });

      page.on("requestfailed", (request: Request) => {
        snapshot.requestFailures.push(
          `${request.url()} ${request.failure()?.errorText ?? "failed"}`,
        );
      });

      page.on("response", (response) => {
        const responseUrl = response.url();
        const isScriptOrWasm =
          responseUrl.endsWith(".js") ||
          responseUrl.endsWith(".wasm") ||
          responseUrl.includes("/vendor/kibo-tag/") ||
          responseUrl.includes("/vendor/comlink/");

        if (isScriptOrWasm && !response.ok()) {
          snapshot.failedResponses.push(`${response.status()} ${responseUrl}`);
        }
      });
    },
    assertClean(options?: { allowConsoleErrorPatterns?: RegExp[] }) {
      const allowedPatterns = options?.allowConsoleErrorPatterns ?? [];

      const unexpectedConsoleErrors = snapshot.consoleMessages.filter((message) => {
        if (!message.startsWith("error:")) {
          return false;
        }

        return !allowedPatterns.some((pattern) => pattern.test(message));
      });

      if (unexpectedConsoleErrors.length > 0) {
        throw new Error(`Unexpected console errors:\n${unexpectedConsoleErrors.join("\n")}`);
      }

      if (snapshot.pageErrors.length > 0) {
        throw new Error(`Uncaught page errors:\n${snapshot.pageErrors.join("\n")}`);
      }

      if (snapshot.requestFailures.length > 0) {
        throw new Error(`Request failures:\n${snapshot.requestFailures.join("\n")}`);
      }

      if (snapshot.failedResponses.length > 0) {
        throw new Error(`Failed script or wasm responses:\n${snapshot.failedResponses.join("\n")}`);
      }
    },
    async writeFailureArtifacts(outputDirectory: string, testName: string) {
      await fs.mkdir(outputDirectory, { recursive: true });
      const artifactPath = path.join(
        outputDirectory,
        `${sanitizeArtifactFileStem(testName)}-diagnostics.json`,
      );
      await fs.writeFile(artifactPath, JSON.stringify(snapshot, null, 2), "utf8");
    },
  };
}

/** Reads current app diagnostics from the page DOM into the collector snapshot. */
export async function readDiagnosticsFromPage(
  page: Page,
  collector: BrowserDiagnosticsCollector,
): Promise<void> {
  collector.snapshot.appStatus = (await page.locator("#app-status").textContent()) ?? "";
  collector.snapshot.cameraStatus = (await page.locator("#camera-status").textContent()) ?? "";
  collector.snapshot.resolutionStatus =
    (await page.locator("#resolution-status").textContent()) ?? "";
  collector.snapshot.diagnosticsText =
    (await page.locator("#diagnostics-text").textContent()) ?? "";
}
