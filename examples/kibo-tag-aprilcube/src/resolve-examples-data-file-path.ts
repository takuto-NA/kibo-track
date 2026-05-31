/**
 * Resolves /examples/data/* URL paths to files under the repository examples/data directory.
 */
import path from "node:path";

export const EXAMPLES_DATA_URL_PREFIX = "/examples/data/";

function relativePathContainsParentDirectorySegment(relativePath: string): boolean {
  const normalizedRelativePath = path.normalize(relativePath);

  return normalizedRelativePath.split(path.sep).some((pathSegment) => pathSegment === "..");
}

/** Maps a request pathname to an absolute file path under examples/data, or null if invalid. */
export function resolveExamplesDataFilePath(
  repositoryRootDirectory: string,
  requestUrlPathname: string,
): string | null {
  if (!requestUrlPathname.startsWith(EXAMPLES_DATA_URL_PREFIX)) {
    return null;
  }

  const encodedRelativePath = requestUrlPathname.slice(EXAMPLES_DATA_URL_PREFIX.length);
  const relativePath = decodeURIComponent(encodedRelativePath);

  // Guard: reject path traversal via .. segments before resolving on disk.
  if (relativePathContainsParentDirectorySegment(relativePath)) {
    return null;
  }

  const normalizedRelativePath = path.normalize(relativePath);

  // Guard: reject absolute paths and remaining parent-directory references.
  if (normalizedRelativePath.startsWith("..") || path.isAbsolute(normalizedRelativePath)) {
    return null;
  }

  const examplesDataDirectory = path.join(repositoryRootDirectory, "examples", "data");
  const resolvedFilePath = path.resolve(examplesDataDirectory, normalizedRelativePath);
  const relativeToExamplesDataDirectory = path.relative(examplesDataDirectory, resolvedFilePath);

  // Guard: resolved path must remain inside examples/data.
  if (relativeToExamplesDataDirectory.startsWith("..")) {
    return null;
  }

  return resolvedFilePath;
}
