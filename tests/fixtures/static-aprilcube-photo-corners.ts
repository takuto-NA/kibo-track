/**
 * Detected marker corners from local AprilCube static photos (images stay gitignored).
 */
import type {
  AprilCubeConfig,
  DetectedMarkerCorners,
  EstimateAprilCubePoseInput,
} from "../../src/aprilcube/types.js";
import type { CameraIntrinsics } from "../../src/core/types.js";
import { EXAMPLE_CUBOID_LAYOUT, EXAMPLE_CUBE_SIZE_METERS } from "./example-aprilcube-layout.js";

export const STATIC_PHOTO_CAMERA_INTRINSICS: CameraIntrinsics = {
  focalLengthX: 2005.8902417296943,
  focalLengthY: 2005.8902417296943,
  principalPointX: 1920,
  principalPointY: 1080,
};

/** Maximum mean reprojection error (px) treated as a good static-photo pose fit. */
export const STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX = 3;

/** Maximum allowed deviation from golden translation depth on static photo regressions (m). */
export const STATIC_PHOTO_GOLDEN_TRANSLATION_TOLERANCE_METERS = 0.02;

/** Golden camera-space depth for marker-5-only static photo pose (calibrated verification). */
export const STATIC_PHOTO_MARKER_5_GOLDEN_DEPTH_METERS = 0.15929761630305123;

export const STATIC_PHOTO_BACK_MARKER_5: DetectedMarkerCorners = {
  id: 5,
  corners: [
    [1895.01, 1021.18],
    [1581.33, 954.5],
    [1516.43, 1266.92],
    [1828.63, 1330.63],
  ],
};

export const STATIC_PHOTO_MARKERS_1_AND_5: readonly DetectedMarkerCorners[] = [
  {
    id: 1,
    corners: [
      [1604.17, 1268.44],
      [1649.76, 938.63],
      [1594.23, 943.2],
      [1554.8, 1232.5],
    ],
  },
  {
    id: 5,
    corners: [
      [2033.74, 993.23],
      [1719.42, 945.38],
      [1672.86, 1283.68],
      [1989.43, 1315.3],
    ],
  },
];

export const STATIC_PHOTO_APRILCUBE_CONFIG: AprilCubeConfig = {
  cubeSize: EXAMPLE_CUBE_SIZE_METERS,
  cornerOrder: "reversedCanonical",
  faces: {
    0: "right",
    1: "left",
    2: "bottom",
    3: "top",
    4: "front",
    5: "back",
  },
  cuboidLayout: EXAMPLE_CUBOID_LAYOUT,
};

export const STATIC_PHOTO_MARKER_5_ONLY_CONFIG: AprilCubeConfig = {
  cubeSize: EXAMPLE_CUBE_SIZE_METERS,
  cornerOrder: "reversedCanonical",
  faces: {
    5: "back",
  },
  cuboidLayout: EXAMPLE_CUBOID_LAYOUT,
};

/** Builds estimateAprilCubePose input using static-photo intrinsics. */
export function buildStaticPhotoEstimateInput(
  markers: ReadonlyArray<DetectedMarkerCorners>,
  config: AprilCubeConfig = STATIC_PHOTO_APRILCUBE_CONFIG,
): EstimateAprilCubePoseInput {
  return {
    markers: [...markers],
    config,
    cameraIntrinsics: STATIC_PHOTO_CAMERA_INTRINSICS,
  };
}

/** Returns true when the pose passes the static-photo good-fit reprojection threshold. */
export function staticPhotoPoseHasGoodReprojection(
  poseSuccess: boolean,
  finalMeanReprojectionErrorPx: number,
): boolean {
  if (!poseSuccess) {
    return false;
  }

  return finalMeanReprojectionErrorPx <= STATIC_PHOTO_MAXIMUM_GOOD_REPROJECTION_ERROR_PX;
}
