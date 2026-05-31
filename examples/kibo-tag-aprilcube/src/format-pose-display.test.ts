/**
 * Unit tests for pose display formatting in the example UI.
 */
import { describe, expect, it } from "vitest";
import {
  formatPoseDisplayLines,
  rotationMatrixToEulerZyxDegrees,
} from "./format-pose-display.js";

describe("formatPoseDisplay", () => {
  it("returns identity Euler angles for a zero rotation vector pose", () => {
    const identityPose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0.01, -0.02, 0.15] as const,
    };

    const lines = formatPoseDisplayLines(identityPose);

    expect(lines[0]).toContain("Translation (mm):");
    expect(lines[1]).toContain("yaw 0.00, pitch 0.00, roll 0.00");
    expect(lines[2]).toContain("angle 0.00");
  });

  it("computes ZYX Euler angles from a row-major rotation matrix", () => {
    const rotationMatrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ] as const;

    const [yawDegrees, pitchDegrees, rollDegrees] =
      rotationMatrixToEulerZyxDegrees(rotationMatrix);

    expect(yawDegrees).toBeCloseTo(0, 5);
    expect(pitchDegrees).toBeCloseTo(0, 5);
    expect(rollDegrees).toBeCloseTo(0, 5);
  });
});
