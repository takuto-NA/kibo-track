/**
 * Unit tests for public asset path resolution under Vite base URLs.
 */
import { describe, expect, it } from "vitest";
import { buildPublicAssetPath } from "./public-asset-path.js";

describe("buildPublicAssetPath", () => {
  it("returns root-relative paths when the Vite base URL is /", () => {
    expect(buildPublicAssetPath("vendor/kibo-tag/apriltag.js", "/")).toBe(
      "/vendor/kibo-tag/apriltag.js",
    );
  });

  it("returns project-site paths when the Vite base URL is /kibo-track/", () => {
    expect(buildPublicAssetPath("vendor/kibo-tag/apriltag.js", "/kibo-track/")).toBe(
      "/kibo-track/vendor/kibo-tag/apriltag.js",
    );
  });

  it("preserves leading slashes on the relative path input", () => {
    expect(buildPublicAssetPath("/vendor/kibo-tag/apriltag_wasm.js", "/")).toBe(
      "/vendor/kibo-tag/apriltag_wasm.js",
    );
  });
});
