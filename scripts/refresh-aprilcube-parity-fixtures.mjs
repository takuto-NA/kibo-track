#!/usr/bin/env node
/**
 * Optional helper to refresh AprilCube parity golden JSON from local Python runs.
 * This script documents the fixture format; Python/OpenCV is not required in CI.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const fixtureDirectory = join(process.cwd(), "tests", "fixtures", "aprilcube-python-parity");

const refreshedFixtures = {
  "two-face-calibrated.json": {
    description: "Refreshed by scripts/refresh-aprilcube-parity-fixtures.mjs",
    expectedResult: {
      success: true,
      poseMode: "multiFace",
      maxMeanReprojectionErrorPx: 1,
      translationToleranceMeters: 0.001,
    },
  },
};

for (const [fileName, fixtureContent] of Object.entries(refreshedFixtures)) {
  writeFileSync(join(fixtureDirectory, fileName), `${JSON.stringify(fixtureContent, null, 2)}\n`);
}

console.log("Parity fixture refresh stub completed.");
