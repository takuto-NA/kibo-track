/**
 * Tolerance-based parity comparisons against golden AprilCube-style fixtures.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateAprilCubePose } from "../../src/aprilcube/estimate-aprilcube-pose.js";
import {
  APRILCUBE_GROUND_TRUTH_POSE,
  CANONICAL_CAMERA_INTRINSICS,
  SINGLE_FACE_APRILCUBE_CONFIG,
  STANDARD_APRILCUBE_CONFIG,
  TWO_FACE_APRILCUBE_CONFIG,
  createProjectedAprilCubeMarkers,
  createSingleFaceAprilCubeMarkers,
  injectBadCornerOnFirstMarker,
} from "../fixtures/aprilcube-config.js";

const PARITY_FIXTURE_DIRECTORY = join(
  process.cwd(),
  "tests",
  "fixtures",
  "aprilcube-python-parity",
);

function readParityFixture(fileName: string): { expectedResult: Record<string, unknown> } {
  const fixtureText = readFileSync(join(PARITY_FIXTURE_DIRECTORY, fileName), "utf8");
  return JSON.parse(fixtureText) as { expectedResult: Record<string, unknown> };
}

describe("AprilCube python parity fixtures", () => {
  it("matches two-face calibrated golden expectations", () => {
    const fixture = readParityFixture("two-face-calibrated.json");
    const result = estimateAprilCubePose(
      {
        markers: createProjectedAprilCubeMarkers(TWO_FACE_APRILCUBE_CONFIG),
        config: TWO_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(fixture.expectedResult.success);

    if (!result.success) {
      expect(result.stage).toBe(fixture.expectedResult.stage);
      expect(result.reason).toBe(fixture.expectedResult.reason);
      return;
    }

    expect(result.poseMode).toBe(fixture.expectedResult.poseMode);
    expect(result.finalMeanReprojectionErrorPx).toBeLessThan(
      Number(fixture.expectedResult.maxMeanReprojectionErrorPx),
    );

    const groundTruthTranslation = fixture.expectedResult.groundTruthTranslation as number[];
    const translationToleranceMeters = Number(fixture.expectedResult.translationToleranceMeters);
    const translationError = Math.hypot(
      result.pose.translation[0] - (groundTruthTranslation[0] ?? 0),
      result.pose.translation[1] - (groundTruthTranslation[1] ?? 0),
      result.pose.translation[2] - (groundTruthTranslation[2] ?? 0),
    );

    expect(translationError).toBeLessThan(translationToleranceMeters);
  });

  it("matches one-face no-prior golden expectations", () => {
    const fixture = readParityFixture("one-face-no-prior.json");
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      { enableRansac: false },
    );

    expect(result.success).toBe(fixture.expectedResult.success);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe(fixture.expectedResult.poseMode);
  });

  it("matches one-face with-prior golden expectations", () => {
    const fixture = readParityFixture("one-face-with-prior.json");
    const result = estimateAprilCubePose(
      {
        markers: createSingleFaceAprilCubeMarkers(),
        config: SINGLE_FACE_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      {
        enableRansac: false,
        previousPose: APRILCUBE_GROUND_TRUTH_POSE,
      },
    );

    expect(result.success).toBe(fixture.expectedResult.success);

    if (!result.success) {
      return;
    }

    expect(result.poseMode).toBe(fixture.expectedResult.poseMode);

    const translationToleranceMeters = Number(fixture.expectedResult.translationToleranceMeters);
    const translationError = Math.hypot(
      result.pose.translation[0] - APRILCUBE_GROUND_TRUTH_POSE.translation[0],
      result.pose.translation[1] - APRILCUBE_GROUND_TRUTH_POSE.translation[1],
      result.pose.translation[2] - APRILCUBE_GROUND_TRUTH_POSE.translation[2],
    );

    expect(translationError).toBeLessThan(translationToleranceMeters);
  });
});

describe("AprilCube bad-marker outlier re-solve", () => {
  it("rejects a synthetic bad marker and keeps pose stable", () => {
    const markers = injectBadCornerOnFirstMarker(
      createProjectedAprilCubeMarkers(STANDARD_APRILCUBE_CONFIG),
      120,
    );

    const result = estimateAprilCubePose(
      {
        markers,
        config: STANDARD_APRILCUBE_CONFIG,
        cameraIntrinsics: CANONICAL_CAMERA_INTRINSICS,
      },
      {
        enableRansac: false,
        reprojectionErrorThresholdPx: 5,
      },
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.rejectedMarkerIds.length).toBeGreaterThan(0);

    const keptMarkerDiagnostics = result.markerReprojectionDiagnostics.filter(
      (diagnostic) => !result.rejectedMarkerIds.includes(diagnostic.markerId),
    );

    expect(keptMarkerDiagnostics.length).toBeGreaterThan(0);
    expect(
      Math.max(...keptMarkerDiagnostics.map((diagnostic) => diagnostic.meanReprojectionErrorPx)),
    ).toBeLessThan(2);
  });
});
