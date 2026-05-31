/**
 * Unit tests for examples/data path resolution in the Vite dev plugin.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveExamplesDataFilePath } from "./resolve-examples-data-file-path.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRootDirectory = path.resolve(currentDirectory, "../../..");

describe("examples data path resolution", () => {
  it("resolves encoded OBJ paths under examples/data", () => {
    const resolvedPath = resolveExamplesDataFilePath(
      repositoryRootDirectory,
      `/examples/data/${encodeURIComponent("ボディ60.obj")}`,
    );

    expect(resolvedPath).toBe(
      path.join(repositoryRootDirectory, "examples", "data", "ボディ60.obj"),
    );
  });

  it("rejects path traversal outside examples/data", () => {
    expect(
      resolveExamplesDataFilePath(repositoryRootDirectory, "/examples/data/../package.json"),
    ).toBeNull();
    expect(
      resolveExamplesDataFilePath(
        repositoryRootDirectory,
        `/examples/data/${encodeURIComponent("../package.json")}`,
      ),
    ).toBeNull();
    expect(
      resolveExamplesDataFilePath(
        repositoryRootDirectory,
        "/examples/data/nested/../../package.json",
      ),
    ).toBeNull();
  });
});
