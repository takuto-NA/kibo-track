/**
 * Unit tests for overlay projection helpers.
 */
import { describe, expect, it } from "vitest";
import { buildCubeCornerVertices, projectCubeWireframe, projectFrontFaceCornersForPose } from "./overlay.js";

describe("overlay projection", () => {
  it("builds eight cube corner vertices", () => {
    const cubeVertices = buildCubeCornerVertices(0.032);
    expect(cubeVertices).toHaveLength(8);
  });

  it("projects cube wireframe segments from a synthetic pose", () => {
    const cameraIntrinsics = {
      focalLengthX: 900,
      focalLengthY: 900,
      principalPointX: 320,
      principalPointY: 240,
    };
    const pose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0, 0, 0.5] as const,
    };

    const wireframeSegments = projectCubeWireframe(pose, 0.032, cameraIntrinsics);

    expect(wireframeSegments.length).toBeGreaterThan(0);
    expect(wireframeSegments[0]?.length).toBe(2);
  });

  it("projects front-face corners for synthetic overlay validation", () => {
    const cameraIntrinsics = {
      focalLengthX: 900,
      focalLengthY: 900,
      principalPointX: 320,
      principalPointY: 240,
    };
    const pose = {
      rotation: [0, 0, 0, 1] as const,
      translation: [0, 0, 0.5] as const,
    };

    const projectedCorners = projectFrontFaceCornersForPose(pose, 0.032, cameraIntrinsics);

    expect(projectedCorners).toHaveLength(4);
    expect(projectedCorners.every((corner) => Number.isFinite(corner[0]))).toBe(true);
  });
});
