/**
 * Unit tests for AprilCube dictionary mapping.
 */
import { describe, expect, it } from "vitest";
import { mapAprilCubeDictionaryToKiboTagFamily } from "./map-aprilcube-dict-to-kibo-tag.js";

describe("mapAprilCubeDictionaryToKiboTagFamily", () => {
  it("maps 4x4_100 to DICT_4X4_100", () => {
    const mappingResult = mapAprilCubeDictionaryToKiboTagFamily("4x4_100");

    expect(mappingResult.success).toBe(true);

    if (!mappingResult.success) {
      return;
    }

    expect(mappingResult.kiboTagFamilyName).toBe("DICT_4X4_100");
  });

  it("rejects unsupported dictionaries", () => {
    const mappingResult = mapAprilCubeDictionaryToKiboTagFamily("unknown_dict");

    expect(mappingResult.success).toBe(false);
  });
});
