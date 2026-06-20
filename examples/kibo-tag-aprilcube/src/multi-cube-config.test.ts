/**
 * Unit tests for multi-cube config set assembly and marker partitioning.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MULTI_CUBE_CONFIG_COUNT,
  MULTI_CUBE_CONFIG_FIXTURE_FILENAMES,
  MULTI_CUBE_TAGS_PER_CUBE,
} from "./constants.js";
import {
  buildMultiCubeConfigSetFromLoaded,
  partitionDetectedMarkersByCubeIndex,
  parseMultiCubeConfigJsonTexts,
} from "./multi-cube-config.js";
import { parseAprilCubeConfigJsonText } from "./load-aprilcube-config-file.js";
import type { DetectedMarkerCorners } from "kibo-track";

const fixtureDirectory = join(
  process.cwd(),
  "public",
  "aprilcube-fixtures",
  "multi-cube",
);

function readMultiCubeFixtureTexts(): string[] {
  return MULTI_CUBE_CONFIG_FIXTURE_FILENAMES.map((fileName) =>
    readFileSync(join(fixtureDirectory, fileName), "utf8"),
  );
}

function readMultiCubeFixtureLabels(): string[] {
  return MULTI_CUBE_CONFIG_FIXTURE_FILENAMES.map((fileName) =>
    fileName.replace(/\.json$/i, ""),
  );
}

function buildLoadedConfigsFromFixtures() {
  const texts = readMultiCubeFixtureTexts();
  const labels = readMultiCubeFixtureLabels();
  const loaded: ReturnType<typeof parseAprilCubeConfigJsonText>[] = [];

  for (let i = 0; i < texts.length; i += 1) {
    loaded.push(parseAprilCubeConfigJsonText(texts[i]!, labels[i]!, "reversedCanonical"));
  }

  return loaded;
}

describe("parseMultiCubeConfigJsonTexts", () => {
  it("assembles 16 fixture configs into a partitioned set", () => {
    const texts = readMultiCubeFixtureTexts();
    const labels = readMultiCubeFixtureLabels();
    const result = parseMultiCubeConfigJsonTexts(texts, labels, "reversedCanonical");

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const { configSet } = result;
    expect(configSet.cubeCount).toBe(MULTI_CUBE_CONFIG_COUNT);
    expect(configSet.cubes).toHaveLength(MULTI_CUBE_CONFIG_COUNT);
    expect(configSet.unionTagIdSet.size).toBe(
      MULTI_CUBE_CONFIG_COUNT * MULTI_CUBE_TAGS_PER_CUBE,
    );
    expect(configSet.idToCubeIndex.size).toBe(
      MULTI_CUBE_CONFIG_COUNT * MULTI_CUBE_TAGS_PER_CUBE,
    );
    expect(configSet.kiboTagFamilyName).toBe("DICT_4X4_100");
  });

  it("maps each tag id to the cube index that owns it", () => {
    const texts = readMultiCubeFixtureTexts();
    const labels = readMultiCubeFixtureLabels();
    const result = parseMultiCubeConfigJsonTexts(texts, labels, "reversedCanonical");

    if (!result.success) {
      throw new Error("Expected multi-cube parse to succeed");
    }

    for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
      const cube = result.configSet.cubes[cubeIndex]!;

      for (const tagId of cube.tagIds) {
        expect(result.configSet.idToCubeIndex.get(tagId)).toBe(cubeIndex);
      }
    }
  });

  it("rejects when the number of config texts is wrong", () => {
    const result = parseMultiCubeConfigJsonTexts(["{}"], ["only-one"], "reversedCanonical");

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.detail).toContain("Expected 16");
  });

  it("rejects when a tag id appears in two cubes", () => {
    const texts = readMultiCubeFixtureTexts();
    const labels = readMultiCubeFixtureLabels();

    // Force cube 1 to reuse ids 0..5 (already in cube 0) by swapping in cube 0's text.
    texts[1] = texts[0]!;
    labels[1] = "dup-cube-1";

    const result = parseMultiCubeConfigJsonTexts(texts, labels, "reversedCanonical");

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.detail).toContain("appears in both");
  });
});

describe("buildMultiCubeConfigSetFromLoaded", () => {
  it("rejects when cubes disagree on kibo-tag family", () => {
    const loadedResults = buildLoadedConfigsFromFixtures();

    // Mutate one cube's family name to simulate a dict mismatch without re-parsing.
    const first = loadedResults[0]!;
    if (!first.success) {
      throw new Error("first fixture failed to parse");
    }

    const second = loadedResults[1]!;
    if (!second.success) {
      throw new Error("second fixture failed to parse");
    }

    const mismatchedSecond: typeof second.loadedConfig = {
      ...second.loadedConfig,
      kiboTagFamilyName: "DICT_5X5_100",
    };

    const rebuilt = [
      first.loadedConfig,
      mismatchedSecond,
      ...loadedResults.slice(2).map((r) => (r!.success ? r!.loadedConfig : null)),
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    const result = buildMultiCubeConfigSetFromLoaded(rebuilt);

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.detail).toContain("does not match");
  });
});

describe("partitionDetectedMarkersByCubeIndex", () => {
  function marker(id: number): DetectedMarkerCorners {
    return {
      id,
      corners: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    };
  }

  it("places each marker into the partition for its owning cube", () => {
    const idToCubeIndex = new Map<number, number>([
      [0, 0],
      [5, 0],
      [6, 1],
      [11, 1],
      [90, 15],
      [95, 15],
    ]);

    const partitions = partitionDetectedMarkersByCubeIndex(
      [marker(0), marker(6), marker(90), marker(11), marker(5), marker(95)],
      idToCubeIndex,
      16,
    );

    expect(partitions).toHaveLength(16);
    expect(partitions[0]!.map((m) => m.id)).toEqual([0, 5]);
    expect(partitions[1]!.map((m) => m.id)).toEqual([6, 11]);
    expect(partitions[15]!.map((m) => m.id)).toEqual([90, 95]);
    expect(partitions[2]).toEqual([]);
  });

  it("ignores marker ids not present in the idToCubeIndex map", () => {
    const idToCubeIndex = new Map<number, number>([[0, 0]]);
    const partitions = partitionDetectedMarkersByCubeIndex(
      [marker(0), marker(999), marker(-1)],
      idToCubeIndex,
      4,
    );

    expect(partitions).toHaveLength(4);
    expect(partitions[0]).toHaveLength(1);
    expect(partitions[0]![0]!.id).toBe(0);
    expect(partitions[1]).toEqual([]);
  });

  it("returns 16 empty partitions when no markers are detected", () => {
    const idToCubeIndex = new Map<number, number>([[0, 0]]);
    const partitions = partitionDetectedMarkersByCubeIndex([], idToCubeIndex, 16);

    expect(partitions).toHaveLength(16);
    for (const partition of partitions) {
      expect(partition).toEqual([]);
    }
  });
});
