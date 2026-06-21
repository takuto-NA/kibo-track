/**
 * Unit tests for multi-cube model assignment.
 */
import { describe, expect, it } from "vitest";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import {
  MULTI_CUBE_MODEL_ASSIGNMENTS,
  buildMultiCubeModelUrl,
  buildMultiCubeModelUrls,
  readMultiCubeModelLabel,
  validateMultiCubeModelAssignments,
} from "./multi-cube-model-assignment.js";

describe("MULTI_CUBE_MODEL_ASSIGNMENTS", () => {
  it("covers exactly 16 cubes with unique file names and cube indices", () => {
    validateMultiCubeModelAssignments();

    expect(MULTI_CUBE_MODEL_ASSIGNMENTS).toHaveLength(MULTI_CUBE_CONFIG_COUNT);

    const cubeIndices = MULTI_CUBE_MODEL_ASSIGNMENTS.map((a) => a.cubeIndex);
    expect(new Set(cubeIndices).size).toBe(MULTI_CUBE_CONFIG_COUNT);
    expect(cubeIndices).toEqual(Array.from({ length: MULTI_CUBE_CONFIG_COUNT }, (_, i) => i));

    const fileNames = MULTI_CUBE_MODEL_ASSIGNMENTS.map((a) => a.fileName);
    expect(new Set(fileNames).size).toBe(MULTI_CUBE_CONFIG_COUNT);
  });
});

describe("buildMultiCubeModelUrl", () => {
  it("builds a public asset URL under aprilcube-fixtures/multi-cube/models/", () => {
    const url = buildMultiCubeModelUrl(0, "/");
    expect(url).toBe("/aprilcube-fixtures/multi-cube/models/00_Chick.gltf");
  });

  it("honors a non-root base URL for GitHub Pages deployment", () => {
    const url = buildMultiCubeModelUrl(7, "/kibo-track/");
    expect(url).toBe("/kibo-track/aprilcube-fixtures/multi-cube/models/07_Character_Female_1.gltf");
  });

  it("throws for out-of-range cube indices", () => {
    expect(() => buildMultiCubeModelUrl(-1, "/")).toThrow(RangeError);
    expect(() => buildMultiCubeModelUrl(MULTI_CUBE_CONFIG_COUNT, "/")).toThrow(RangeError);
  });
});

describe("buildMultiCubeModelUrls", () => {
  it("returns 16 URLs in cube-index order", () => {
    const urls = buildMultiCubeModelUrls("/");
    expect(urls).toHaveLength(MULTI_CUBE_CONFIG_COUNT);
    expect(urls[0]).toBe("/aprilcube-fixtures/multi-cube/models/00_Chick.gltf");
    expect(urls[15]).toBe("/aprilcube-fixtures/multi-cube/models/15_Sword_Diamond.gltf");
  });
});

describe("readMultiCubeModelLabel", () => {
  it("returns the human-readable label for a cube index", () => {
    expect(readMultiCubeModelLabel(0)).toBe("Chick");
    expect(readMultiCubeModelLabel(15)).toBe("Sword_Diamond");
  });

  it("returns a fallback for out-of-range indices", () => {
    expect(readMultiCubeModelLabel(-1)).toBe("(no model)");
    expect(readMultiCubeModelLabel(99)).toBe("(no model)");
  });
});
