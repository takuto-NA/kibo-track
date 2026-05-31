/**
 * Verifies AprilCube wireframe overlay against static photos in examples/data.
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserDiagnosticsCollector } from "./browser-diagnostics.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../../..");
const aprilCubeDataDirectory = path.join(repositoryRoot, "examples", "data");
const verificationOutputDirectory = path.join(aprilCubeDataDirectory, "verification-output");
const exampleDataCalibrationUrl =
  "/examples/data/verification-output/opencv-calibrated-from-examples-data.json";

const aprilCubePhotoFileNames = [
  "WIN_20260531_15_51_30_Pro - コピー.jpg",
  "WIN_20260531_15_51_47_Pro - コピー.jpg",
  "WIN_20260531_15_51_50_Pro - コピー.jpg",
  "WIN_20260531_15_51_57_Pro - コピー.jpg",
];

const cornerOrderCandidates = [
  "canonical",
  "clockwiseRotate90",
  "clockwiseRotate180",
  "clockwiseRotate270",
  "reverse",
  "reversedCanonical",
] as const;

interface StaticImageVerificationResult {
  readonly status: "complete" | "failed";
  readonly detectedMarkerCount: number;
  readonly detectedMarkerIds: readonly number[];
  readonly poseSuccess: boolean;
  readonly poseMode: string | null;
  readonly finalReprojectionErrorPx: number | null;
  readonly visibleFaceCount: number | null;
  readonly failureReason: string | null;
  readonly imageWidth: number;
  readonly imageHeight: number;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, "_");
}

async function runVerificationForPhoto(
  page: import("@playwright/test").Page,
  photoFileName: string,
  focalLengthPixels: number | null,
  cornerOrder: (typeof cornerOrderCandidates)[number] = "reversedCanonical",
  calibrationUrl: string | null = null,
): Promise<StaticImageVerificationResult | undefined> {
  const photoFilePath = path.join(aprilCubeDataDirectory, photoFileName);
  const photoFileExists = await fs
    .access(photoFilePath)
    .then(() => true)
    .catch(() => false);

  if (!photoFileExists) {
    return undefined;
  }

  const encodedPhotoUrl = `/examples/data/${encodeURIComponent(photoFileName)}`;
  const queryParameters = new URLSearchParams({
    image: encodedPhotoUrl,
  });

  if (focalLengthPixels !== null) {
    queryParameters.set("focalLengthPixels", String(focalLengthPixels));
  }

  if (cornerOrder !== "canonical") {
    queryParameters.set("cornerOrder", cornerOrder);
  }

  if (calibrationUrl !== null) {
    queryParameters.set("calibration", calibrationUrl);
  }

  await page.goto(`/static-image-verify.html?${queryParameters.toString()}`);
  await page.waitForFunction(
    () => {
      const statusText = document.querySelector("#verify-status")?.textContent ?? "";
      return statusText === "complete" || statusText === "failed";
    },
    undefined,
    { timeout: 180_000 },
  );

  return page.evaluate(
    (): StaticImageVerificationResult | undefined => window.__staticImageVerificationResult,
  );
}

test.describe("static AprilCube image wireframe verification", () => {
  test("generates overlay artifacts for AprilCube photos", async ({ page }) => {
    test.setTimeout(600_000);

    const collector = createBrowserDiagnosticsCollector();
    collector.attach(page);

    await page.route("**/examples/data/**", async (route) => {
      const requestedPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relativeDataPath = requestedPath.replace(/^\/examples\/data\//, "");
      const resolvedPhotoPath = path.join(aprilCubeDataDirectory, relativeDataPath);
      await route.fulfill({ path: resolvedPhotoPath });
    });

    await fs.mkdir(verificationOutputDirectory, { recursive: true });

    const summaryRows: Array<Record<string, string | number | boolean | null>> = [];

    for (const photoFileName of aprilCubePhotoFileNames) {
      const placeholderResult = await runVerificationForPhoto(page, photoFileName, null);

      if (placeholderResult === undefined) {
        continue;
      }

      const outputBaseName = sanitizeFileName(photoFileName);
      await page.locator('[data-testid="overlay-canvas"]').screenshot({
        path: path.join(verificationOutputDirectory, `${outputBaseName}-placeholder-overlay.png`),
      });
      await fs.writeFile(
        path.join(verificationOutputDirectory, `${outputBaseName}-placeholder-result.json`),
        JSON.stringify(placeholderResult, null, 2),
        "utf8",
      );

      summaryRows.push({
        photoFileName,
        intrinsicsMode: "placeholder",
        verificationStatus: placeholderResult.status,
        poseSuccess: placeholderResult.poseSuccess,
        detectedMarkerCount: placeholderResult.detectedMarkerCount,
        visibleFaceCount: placeholderResult.visibleFaceCount,
        finalReprojectionErrorPx: placeholderResult.finalReprojectionErrorPx,
        failureReason: placeholderResult.failureReason,
      });
    }

    const bestPhotoFileName = "WIN_20260531_15_51_57_Pro - コピー.jpg";
    let bestFocalLengthPixels = 2700;
    let bestReprojectionErrorPx = Number.POSITIVE_INFINITY;

    for (let focalLengthPixels = 1800; focalLengthPixels <= 4200; focalLengthPixels += 200) {
      const tunedResult = await runVerificationForPhoto(
        page,
        bestPhotoFileName,
        focalLengthPixels,
      );

      if (
        tunedResult?.poseSuccess === true &&
        tunedResult.finalReprojectionErrorPx !== null &&
        tunedResult.finalReprojectionErrorPx < bestReprojectionErrorPx
      ) {
        bestReprojectionErrorPx = tunedResult.finalReprojectionErrorPx;
        bestFocalLengthPixels = focalLengthPixels;
      }
    }

    const tunedBestResult = await runVerificationForPhoto(
      page,
      bestPhotoFileName,
      bestFocalLengthPixels,
    );

    expect(tunedBestResult?.poseSuccess).toBe(true);

    await page.locator('[data-testid="overlay-canvas"]').screenshot({
      path: path.join(
        verificationOutputDirectory,
        `${sanitizeFileName(bestPhotoFileName)}-tuned-f${bestFocalLengthPixels}-overlay.png`,
      ),
    });
    await fs.writeFile(
      path.join(verificationOutputDirectory, "focal-length-sweep-summary.json"),
      JSON.stringify(
        {
          bestPhotoFileName,
          bestFocalLengthPixels,
          bestReprojectionErrorPx,
          tunedBestResult,
          placeholderSummary: summaryRows,
        },
        null,
        2,
      ),
      "utf8",
    );

    const cornerOrderSummary = [];
    for (const cornerOrder of cornerOrderCandidates) {
      const cornerOrderResult = await runVerificationForPhoto(
        page,
        bestPhotoFileName,
        bestFocalLengthPixels,
        cornerOrder,
      );

      if (cornerOrderResult === undefined) {
        continue;
      }

      cornerOrderSummary.push({
        cornerOrder,
        status: cornerOrderResult.status,
        poseSuccess: cornerOrderResult.poseSuccess,
        finalReprojectionErrorPx: cornerOrderResult.finalReprojectionErrorPx,
        failureReason: cornerOrderResult.failureReason,
      });

      await page.locator('[data-testid="overlay-canvas"]').screenshot({
        path: path.join(
          verificationOutputDirectory,
          `${sanitizeFileName(bestPhotoFileName)}-corner-${cornerOrder}-overlay.png`,
        ),
      });
    }

    await fs.writeFile(
      path.join(verificationOutputDirectory, "corner-order-sweep-summary.json"),
      JSON.stringify(cornerOrderSummary, null, 2),
      "utf8",
    );

    const calibratedSummaryRows = [];
    for (const photoFileName of aprilCubePhotoFileNames) {
      const calibratedResult = await runVerificationForPhoto(
        page,
        photoFileName,
        null,
        "canonical",
        exampleDataCalibrationUrl,
      );

      if (calibratedResult === undefined) {
        continue;
      }

      calibratedSummaryRows.push({
        photoFileName,
        status: calibratedResult.status,
        poseSuccess: calibratedResult.poseSuccess,
        detectedMarkerCount: calibratedResult.detectedMarkerCount,
        finalReprojectionErrorPx: calibratedResult.finalReprojectionErrorPx,
        failureReason: calibratedResult.failureReason,
      });

      await page.locator('[data-testid="overlay-canvas"]').screenshot({
        path: path.join(
          verificationOutputDirectory,
          `${sanitizeFileName(photoFileName)}-calibrated-overlay.png`,
        ),
      });
      await fs.writeFile(
        path.join(
          verificationOutputDirectory,
          `${sanitizeFileName(photoFileName)}-calibrated-result.json`,
        ),
        JSON.stringify(calibratedResult, null, 2),
        "utf8",
      );
    }

    await fs.writeFile(
      path.join(verificationOutputDirectory, "calibrated-summary.json"),
      JSON.stringify(calibratedSummaryRows, null, 2),
      "utf8",
    );

    const calibratedCornerOrderSummary = [];
    for (const photoFileName of aprilCubePhotoFileNames) {
      for (const cornerOrder of cornerOrderCandidates) {
        const calibratedCornerOrderResult = await runVerificationForPhoto(
          page,
          photoFileName,
          null,
          cornerOrder,
          exampleDataCalibrationUrl,
        );

        if (calibratedCornerOrderResult === undefined) {
          continue;
        }

        calibratedCornerOrderSummary.push({
          photoFileName,
          cornerOrder,
          status: calibratedCornerOrderResult.status,
          poseSuccess: calibratedCornerOrderResult.poseSuccess,
          finalReprojectionErrorPx: calibratedCornerOrderResult.finalReprojectionErrorPx,
          failureReason: calibratedCornerOrderResult.failureReason,
        });
      }
    }

    await fs.writeFile(
      path.join(verificationOutputDirectory, "calibrated-corner-order-sweep-summary.json"),
      JSON.stringify(calibratedCornerOrderSummary, null, 2),
      "utf8",
    );

    // Worker requests are aborted during repeated page navigations in this artifact generator.
  });
});
