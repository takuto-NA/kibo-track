/**
 * Unit tests for official AprilCube config file loading.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAprilCubeConfigJsonText } from "./load-aprilcube-config-file.js";

const repositoryRootDirectory = join(process.cwd(), "..", "..");
const stickConfigPath = join(
  repositoryRootDirectory,
  "tests",
  "fixtures",
  "aprilcube-official",
  "stick-1x1x6-config.json",
);

describe("loadAprilCubeConfigFromFile helpers", () => {
  it("parses stick config JSON text into loaded runtime config", () => {
    const configJsonText = readFileSync(stickConfigPath, "utf8");
    const loadResult = parseAprilCubeConfigJsonText(
      configJsonText,
      "stick_1x1x6",
      "reversedCanonical",
    );

    expect(loadResult.success).toBe(true);

    if (!loadResult.success) {
      return;
    }

    expect(loadResult.loadedConfig.configLabel).toBe("stick_1x1x6");
    expect(loadResult.loadedConfig.dictionaryName).toBe("4x4_100");
    expect(loadResult.loadedConfig.kiboTagFamilyName).toBe("DICT_4X4_100");
    expect(loadResult.loadedConfig.tagIds).toHaveLength(26);
    expect(loadResult.loadedConfig.boxDimensionsMeters).toEqual([0.04, 0.04, 0.215]);
  });
});
