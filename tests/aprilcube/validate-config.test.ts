/**
 * Tests for AprilCube configuration validation.
 */
import { describe, expect, it } from "vitest";
import { isValidAprilCubeConfig } from "../../src/aprilcube/validate-config.js";
import {
  APRILCUBE_FRONT_MARKER_ID,
  APRILCUBE_RIGHT_MARKER_ID,
  STANDARD_APRILCUBE_CONFIG,
} from "../fixtures/aprilcube-config.js";
import { STICK_1X1X6_APRILCUBE_CONFIG } from "../fixtures/stick-1x1x6-aprilcube-config.js";

describe("AprilCube config validation", () => {
  it("accepts a valid multi-face configuration", () => {
    expect(isValidAprilCubeConfig(STANDARD_APRILCUBE_CONFIG)).toBe(true);
  });

  it("rejects non-positive cube size", () => {
    expect(
      isValidAprilCubeConfig({
        cubeSize: 0,
        faces: STANDARD_APRILCUBE_CONFIG.faces,
      }),
    ).toBe(false);
  });

  it("rejects empty face maps", () => {
    expect(
      isValidAprilCubeConfig({
        cubeSize: 0.2,
        faces: {},
      }),
    ).toBe(false);
  });

  it("rejects duplicate face assignment for legacy face-only configs", () => {
    expect(
      isValidAprilCubeConfig({
        cubeSize: 0.2,
        faces: {
          [APRILCUBE_FRONT_MARKER_ID]: "front",
          [APRILCUBE_RIGHT_MARKER_ID]: "front",
        },
      }),
    ).toBe(false);
  });

  it("rejects invalid face names", () => {
    expect(
      isValidAprilCubeConfig({
        cubeSize: 0.2,
        faces: {
          1: "invalid-face" as never,
        },
      }),
    ).toBe(false);
  });

  it("rejects non-integer marker IDs in the face map", () => {
    expect(
      isValidAprilCubeConfig({
        cubeSize: 0.2,
        faces: {
          "1.5": "front" as never,
        },
      }),
    ).toBe(false);
  });

  it("accepts stick 1x1x6 with multiple markers on the same face when cuboidLayout is present", () => {
    expect(isValidAprilCubeConfig(STICK_1X1X6_APRILCUBE_CONFIG)).toBe(true);
  });
});
