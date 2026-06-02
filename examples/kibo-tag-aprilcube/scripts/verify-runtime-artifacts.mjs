/**
 * Verifies that browser runtime artifacts required for the public demo exist locally.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const exampleRootDirectory = path.resolve(currentDirectory, "..");

const REQUIRED_RUNTIME_ARTIFACT_RELATIVE_PATHS = [
  "public/vendor/kibo-tag/apriltag.js",
  "public/vendor/kibo-tag/apriltag_wasm.js",
  "public/vendor/comlink/comlink.js",
];

const UNPKG_DEPENDENCY_PATTERN = /https:\/\/unpkg\.com\/comlink/;

function readRequiredArtifact(relativePathFromExampleRoot) {
  const absolutePath = path.join(exampleRootDirectory, relativePathFromExampleRoot);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required runtime artifact: ${relativePathFromExampleRoot}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function assertWorkerDoesNotUseRemoteComlink(workerSourceText) {
  if (UNPKG_DEPENDENCY_PATTERN.test(workerSourceText)) {
    throw new Error(
      "public/vendor/kibo-tag/apriltag.js still imports Comlink from unpkg. Vendor Comlink locally instead.",
    );
  }
}

for (const relativePath of REQUIRED_RUNTIME_ARTIFACT_RELATIVE_PATHS) {
  readRequiredArtifact(relativePath);
}

const workerSourceText = readRequiredArtifact("public/vendor/kibo-tag/apriltag.js");
assertWorkerDoesNotUseRemoteComlink(workerSourceText);

console.log("Runtime artifact verification passed.");
