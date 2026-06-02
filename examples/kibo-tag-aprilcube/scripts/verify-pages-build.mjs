/**
 * Verifies the GitHub Pages production build under dist/ has correct asset paths.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const exampleRootDirectory = path.resolve(currentDirectory, "..");
const pagesDistDirectory = path.join(exampleRootDirectory, "dist");
const GITHUB_PAGES_PROJECT_SITE_BASE_PATH = "/kibo-track/";

const UNPKG_DEPENDENCY_PATTERN = /https:\/\/unpkg\.com\/comlink/;
const ROOT_ONLY_VENDOR_PATH_PATTERN = /["'`]\/vendor\/kibo-tag\//;

const REQUIRED_DIST_RELATIVE_PATHS = [
  "index.html",
  "vendor/kibo-tag/apriltag.js",
  "vendor/kibo-tag/apriltag_wasm.js",
  "vendor/kibo-tag/apriltag_wasm.wasm",
  "vendor/comlink/comlink.js",
];

const EXCLUDED_PUBLIC_ONLY_RELATIVE_PATHS = ["verify-images"];

function readDistFile(relativePathFromDistRoot) {
  const absolutePath = path.join(pagesDistDirectory, relativePathFromDistRoot);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required Pages build artifact: dist/${relativePathFromDistRoot}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function collectTextFilesRecursively(directoryPath) {
  const collectedFilePaths = [];

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const absoluteEntryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectedFilePaths.push(...collectTextFilesRecursively(absoluteEntryPath));
      continue;
    }

    if (entry.name.endsWith(".html") || entry.name.endsWith(".js") || entry.name.endsWith(".css")) {
      collectedFilePaths.push(absoluteEntryPath);
    }
  }

  return collectedFilePaths;
}

function assertPagesBasePathInIndexHtml(indexHtmlText) {
  if (!indexHtmlText.includes(`${GITHUB_PAGES_PROJECT_SITE_BASE_PATH}assets/`)) {
    throw new Error(
      `dist/index.html does not reference assets under ${GITHUB_PAGES_PROJECT_SITE_BASE_PATH}`,
    );
  }
}

function assertNoUnpkgReferencesInDistTextFiles() {
  const textFilePaths = collectTextFilesRecursively(pagesDistDirectory);

  for (const textFilePath of textFilePaths) {
    const fileText = fs.readFileSync(textFilePath, "utf8");
    if (UNPKG_DEPENDENCY_PATTERN.test(fileText)) {
      throw new Error(`dist file still references unpkg Comlink: ${textFilePath}`);
    }

    if (ROOT_ONLY_VENDOR_PATH_PATTERN.test(fileText)) {
      throw new Error(
        `dist file still contains root-only /vendor/kibo-tag/ paths: ${textFilePath}`,
      );
    }
  }
}

function assertExcludedPublicPathsAreNotDeployed() {
  for (const relativePath of EXCLUDED_PUBLIC_ONLY_RELATIVE_PATHS) {
    const absolutePath = path.join(pagesDistDirectory, relativePath);
    if (fs.existsSync(absolutePath)) {
      throw new Error(
        `dist/${relativePath} must not be deployed to GitHub Pages. Move it out of public/.`,
      );
    }
  }
}

if (!fs.existsSync(pagesDistDirectory)) {
  throw new Error("Missing dist/ output. Run npm run build:pages first.");
}

for (const relativePath of REQUIRED_DIST_RELATIVE_PATHS) {
  readDistFile(relativePath);
}

const indexHtmlText = readDistFile("index.html");
assertPagesBasePathInIndexHtml(indexHtmlText);
assertNoUnpkgReferencesInDistTextFiles();
assertExcludedPublicPathsAreNotDeployed();

console.log("Pages build verification passed.");
