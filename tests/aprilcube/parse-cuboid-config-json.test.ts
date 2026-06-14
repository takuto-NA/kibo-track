/**
 * Tests for parseAprilCubeCuboidConfigJson.
 */
import { describe, expect, it } from "vitest";
import { parseAprilCubeCuboidConfigJson } from "../../src/aprilcube/parse-cuboid-config-json.js";
import { isValidAprilCubeConfig } from "../../src/aprilcube/validate-config.js";
import {
  readLShapeV2OfficialConfigJson,
  readOneByOneByOne24OfficialConfigJson,
  readStickOfficialConfigJson,
} from "../fixtures/stick-1x1x6-aprilcube-config.js";

describe("parseAprilCubeCuboidConfigJson", () => {
  it("parses stick 1x1x6 official JSON", () => {
    const parseResult = parseAprilCubeCuboidConfigJson(readStickOfficialConfigJson());

    expect(parseResult.success).toBe(true);

    if (!parseResult.success) {
      return;
    }

    expect(parseResult.dictionaryName).toBe("4x4_100");
    expect(parseResult.tagIds).toHaveLength(26);
    expect(parseResult.boxDimensionsMillimeters).toEqual([40, 40, 215]);
    expect(parseResult.config.cubeSize).toBe(0.215);
    expect(parseResult.config.cuboidLayout?.grid).toEqual([1, 1, 6]);
    expect(isValidAprilCubeConfig(parseResult.config)).toBe(true);
    expect(parseResult.config.faces[0]).toBe("right");
    expect(parseResult.config.faces[5]).toBe("right");
    expect(parseResult.config.faces[24]).toBe("front");
  });

  it("parses 1x1x1_24 official JSON", () => {
    const parseResult = parseAprilCubeCuboidConfigJson(readOneByOneByOne24OfficialConfigJson());

    expect(parseResult.success).toBe(true);

    if (!parseResult.success) {
      return;
    }

    expect(parseResult.tagIds).toEqual([0, 1, 2, 3, 4, 5]);
    expect(parseResult.config.cubeSize).toBe(0.032);
    expect(parseResult.config.cuboidLayout?.boxDimensionsMeters).toEqual([0.032, 0.032, 0.032]);
  });

  it("rejects schema v2 explicit marker geometry", () => {
    const parseResult = parseAprilCubeCuboidConfigJson(readLShapeV2OfficialConfigJson());

    expect(parseResult.success).toBe(false);

    if (parseResult.success) {
      return;
    }

    expect(parseResult.reason).toBe("unsupportedSchema");
  });

  it("rejects non-object JSON", () => {
    const parseResult = parseAprilCubeCuboidConfigJson("not-an-object");

    expect(parseResult.success).toBe(false);

    if (parseResult.success) {
      return;
    }

    expect(parseResult.reason).toBe("invalidJson");
  });
});
