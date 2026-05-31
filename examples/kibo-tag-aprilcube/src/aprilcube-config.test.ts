/**
 * Unit tests for AprilCube layout JSON mapping.
 */
import { describe, expect, it } from "vitest";
import {
  buildAprilCubeConfigFromLayoutJson,
  convertMillimetersToMeters,
  EXAMPLE_APRILCUBE_LAYOUT_JSON,
} from "./aprilcube-config.js";

describe("AprilCube layout mapping", () => {
  it("converts millimeters to meters", () => {
    expect(convertMillimetersToMeters(32)).toBe(0.032);
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
});
