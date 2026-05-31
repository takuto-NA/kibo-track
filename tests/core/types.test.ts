/**
 * Convention tests for public tuple and object types.
 */
import { describe, expect, it } from "vitest";
import type {
  CameraIntrinsics,
  ImagePoint2D,
  ObjectPoint3D,
  Pose,
  Quaternion,
} from "../../src/core/types.js";

describe("public domain types", () => {
  it("uses pixel image points as readonly tuples", () => {
    const imagePoint: ImagePoint2D = [640, 360];
    expect(imagePoint[0]).toBe(640);
    expect(imagePoint[1]).toBe(360);
  });

  it("uses object points and quaternions as readonly tuples", () => {
    const objectPoint: ObjectPoint3D = [1, 2, 3];
    const quaternion: Quaternion = [0, 0, 0, 1];

    expect(objectPoint).toEqual([1, 2, 3]);
    expect(quaternion).toEqual([0, 0, 0, 1]);
  });

  it("uses self-documenting camera intrinsics field names", () => {
    const cameraIntrinsics: CameraIntrinsics = {
      focalLengthX: 800,
      focalLengthY: 800,
      principalPointX: 640,
      principalPointY: 360,
    };

    expect(cameraIntrinsics.focalLengthX).toBe(800);
    expect(cameraIntrinsics.principalPointX).toBe(640);
  });

  it("represents cameraFromObject pose with quaternion and translation", () => {
    const pose: Pose = {
      rotation: [0, 0, 0, 1],
      translation: [0, 0, 1],
    };

    expect(pose.rotation[3]).toBe(1);
    expect(pose.translation[2]).toBe(1);
  });
});
