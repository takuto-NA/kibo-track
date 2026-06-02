/**
 * Builds site-root-relative URLs for static assets under Vite's public directory.
 */

const TRAILING_SLASH_PATTERN = /\/$/;

/** Normalizes Vite's configured base URL to a path prefix without a trailing slash. */
export function resolveViteBaseUrl(baseUrl: string = import.meta.env.BASE_URL): string {
  return baseUrl.replace(TRAILING_SLASH_PATTERN, "");
}

/**
 * Joins Vite's configured base URL with a path relative to the public root.
 */
export function buildPublicAssetPath(
  relativePathFromPublicRoot: string,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const normalizedRelativePath = relativePathFromPublicRoot.startsWith("/")
    ? relativePathFromPublicRoot.slice(1)
    : relativePathFromPublicRoot;

  const normalizedBaseUrl = resolveViteBaseUrl(baseUrl);
  if (normalizedBaseUrl.length === 0) {
    return `/${normalizedRelativePath}`;
  }

  return `${normalizedBaseUrl}/${normalizedRelativePath}`;
}
