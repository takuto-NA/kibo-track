/**
 * Unit tests for AprilCube layout JSON mapping.
 */
import { describe, expect, it } from "vitest";
import {
  buildAprilCubeConfigFromLayoutJson,
  buildCuboidLayoutFromLayoutJson,
  convertMillimetersToMeters,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
  parseAprilCubeGridString,
} from "./aprilcube-config.js";

describe("AprilCube layout mapping", () => {
  it("converts millimeters to meters", () => {
    expect(convertMillimetersToMeters(32)).toBe(0.032);
  });

  it("parses grid strings", () => {
    expect(parseAprilCubeGridString("1x1x1")).toEqual([1, 1, 1]);
    expect(parseAprilCubeGridString("2x2x2")).toEqual([2, 2, 2]);
  });

  it("maps face axes and cube size from the example JSON", () => {
    const config = buildAprilCubeConfigFromLayoutJson(EXAMPLE_APRILCUBE_LAYOUT_JSON);

    expect(config.cubeSize).toBe(0.032);
    expect(config.faces[0]).toBe("right");
    expect(config.faces[1]).toBe("left");
    expect(config.faces[2]).toBe("bottom");
    expect(config.faces[3]).toBe("top");
    expect(config.faces[4]).toBe("front");
    expect(config.faces[5]).toBe("back");
  });

  it("builds cuboidLayout for tag corner geometry", () => {
    const cuboidLayout = buildCuboidLayoutFromLayoutJson(EXAMPLE_APRILCUBE_LAYOUT_JSON);

    expect(cuboidLayout.grid).toEqual([1, 1, 1]);
    expect(cuboidLayout.tagIds).toEqual([0, 1, 2, 3, 4, 5]);
    expect(cuboidLayout.tagSizeMeters).toBe(0.024);
    expect(cuboidLayout.markerPixels).toBe(6);
    expect(cuboidLayout.boxDimensionsMeters).toEqual([0.032, 0.032, 0.032]);
  });

  it("includes cuboidLayout on the built config", () => {
    const config = buildAprilCubeConfigFromLayoutJson(EXAMPLE_APRILCUBE_LAYOUT_JSON);

    expect(config.cuboidLayout).toBeDefined();
    expect(config.cuboidLayout?.grid).toEqual([1, 1, 1]);
  });
});
