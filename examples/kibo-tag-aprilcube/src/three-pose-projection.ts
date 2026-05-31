/**
 * Pure camera/pose conversion helpers for three.js overlay alignment with kibo-track projection.
 */
import { poseToMatrix4, projectPoint, type CameraIntrinsics, type Pose, type RowMajorMatrix4 } from "kibo-track";

/** Near clip plane for the three.js perspective projection matrix. */
export const THREE_OVERLAY_NEAR_CLIP_PLANE = 0.01;

/** Far clip plane for the three.js perspective projection matrix. */
export const THREE_OVERLAY_FAR_CLIP_PLANE = 100;

/** Column-major 4×4 matrix used by three.js (16 elements). */
export type ColumnMajorMatrix4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface WebGlCanvasPixelSize {
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly devicePixelRatio: number;
}

export interface ThreeOverlayProjectionInput {
  readonly cameraFromObjectPose: Pose;
  readonly cameraIntrinsics: CameraIntrinsics;
  readonly imageWidthPixels: number;
  readonly imageHeightPixels: number;
  readonly nearClipPlane?: number;
  readonly farClipPlane?: number;
}

/** Applies OpenCV-to-three.js axis flip (x right, y up, z toward viewer) to a row-major pose matrix. */
export function applyOpenCvToThreeJsAxisFlipToRowMajorMatrix(
  rowMajorMatrix: RowMajorMatrix4,
): RowMajorMatrix4 {
  return [
    rowMajorMatrix[0]!,
    rowMajorMatrix[1]!,
    rowMajorMatrix[2]!,
    rowMajorMatrix[3]!,
    -rowMajorMatrix[4]!,
    -rowMajorMatrix[5]!,
    -rowMajorMatrix[6]!,
    -rowMajorMatrix[7]!,
    -rowMajorMatrix[8]!,
    -rowMajorMatrix[9]!,
    -rowMajorMatrix[10]!,
    -rowMajorMatrix[11]!,
    rowMajorMatrix[12]!,
    rowMajorMatrix[13]!,
    rowMajorMatrix[14]!,
    rowMajorMatrix[15]!,
  ];
}

/** Builds the three.js object matrix from a kibo-track cameraFromObject pose. */
export function buildThreeJsObjectMatrixFromPose(cameraFromObjectPose: Pose): RowMajorMatrix4 {
  const cameraFromObjectMatrix = poseToMatrix4(cameraFromObjectPose);
  return applyOpenCvToThreeJsAxisFlipToRowMajorMatrix(cameraFromObjectMatrix);
}

/** Converts a kibo-track row-major matrix into a three.js column-major matrix. */
export function convertRowMajorMatrix4ToColumnMajor(rowMajorMatrix: RowMajorMatrix4): ColumnMajorMatrix4 {
  return [
    rowMajorMatrix[0]!,
    rowMajorMatrix[4]!,
    rowMajorMatrix[8]!,
    rowMajorMatrix[12]!,
    rowMajorMatrix[1]!,
    rowMajorMatrix[5]!,
    rowMajorMatrix[9]!,
    rowMajorMatrix[13]!,
    rowMajorMatrix[2]!,
    rowMajorMatrix[6]!,
    rowMajorMatrix[10]!,
    rowMajorMatrix[14]!,
    rowMajorMatrix[3]!,
    rowMajorMatrix[7]!,
    rowMajorMatrix[11]!,
    rowMajorMatrix[15]!,
  ];
}

/** Builds an OpenGL-style projection matrix from pinhole intrinsics (column-major). */
export function buildOpenCvStyleProjectionMatrixColumnMajor(
  cameraIntrinsics: CameraIntrinsics,
  imageWidthPixels: number,
  imageHeightPixels: number,
  nearClipPlane: number = THREE_OVERLAY_NEAR_CLIP_PLANE,
  farClipPlane: number = THREE_OVERLAY_FAR_CLIP_PLANE,
): ColumnMajorMatrix4 {
  const { focalLengthX, focalLengthY, principalPointX, principalPointY } = cameraIntrinsics;

  return [
    (2 * focalLengthX) / imageWidthPixels,
    0,
    0,
    0,
    0,
    (2 * focalLengthY) / imageHeightPixels,
    0,
    0,
    1 - (2 * principalPointX) / imageWidthPixels,
    (2 * principalPointY) / imageHeightPixels - 1,
    -(farClipPlane + nearClipPlane) / (farClipPlane - nearClipPlane),
    -1,
    0,
    0,
    (-2 * farClipPlane * nearClipPlane) / (farClipPlane - nearClipPlane),
    0,
  ];
}

function multiplyColumnMajorMatrix4ByVector4(
  columnMajorMatrix: ColumnMajorMatrix4,
  vector: readonly [number, number, number, number],
): [number, number, number, number] {
  const [vectorX, vectorY, vectorZ, vectorW] = vector;
  const productX =
    columnMajorMatrix[0]! * vectorX +
    columnMajorMatrix[4]! * vectorY +
    columnMajorMatrix[8]! * vectorZ +
    columnMajorMatrix[12]! * vectorW;
  const productY =
    columnMajorMatrix[1]! * vectorX +
    columnMajorMatrix[5]! * vectorY +
    columnMajorMatrix[9]! * vectorZ +
    columnMajorMatrix[13]! * vectorW;
  const productZ =
    columnMajorMatrix[2]! * vectorX +
    columnMajorMatrix[6]! * vectorY +
    columnMajorMatrix[10]! * vectorZ +
    columnMajorMatrix[14]! * vectorW;
  const productW =
    columnMajorMatrix[3]! * vectorX +
    columnMajorMatrix[7]! * vectorY +
    columnMajorMatrix[11]! * vectorZ +
    columnMajorMatrix[15]! * vectorW;

  return [productX, productY, productZ, productW];
}

function multiplyColumnMajorMatrices(
  leftMatrix: ColumnMajorMatrix4,
  rightMatrix: ColumnMajorMatrix4,
): ColumnMajorMatrix4 {
  const result: number[] = new Array(16);

  for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
      let sum = 0;

      for (let innerIndex = 0; innerIndex < 4; innerIndex += 1) {
        sum +=
          leftMatrix[rowIndex + innerIndex * 4]! * rightMatrix[innerIndex + columnIndex * 4]!;
      }

      result[rowIndex + columnIndex * 4] = sum;
    }
  }

  return [
    result[0]!,
    result[1]!,
    result[2]!,
    result[3]!,
    result[4]!,
    result[5]!,
    result[6]!,
    result[7]!,
    result[8]!,
    result[9]!,
    result[10]!,
    result[11]!,
    result[12]!,
    result[13]!,
    result[14]!,
    result[15]!,
  ];
}

/** Projects an object-space origin through the three.js matrix pipeline into pixel coordinates. */
export function projectObjectOriginToPixelViaThreeJsPipeline(
  input: ThreeOverlayProjectionInput,
): [number, number] {
  const nearClipPlane = input.nearClipPlane ?? THREE_OVERLAY_NEAR_CLIP_PLANE;
  const farClipPlane = input.farClipPlane ?? THREE_OVERLAY_FAR_CLIP_PLANE;
  const objectMatrixColumnMajor = convertRowMajorMatrix4ToColumnMajor(
    buildThreeJsObjectMatrixFromPose(input.cameraFromObjectPose),
  );
  const projectionMatrixColumnMajor = buildOpenCvStyleProjectionMatrixColumnMajor(
    input.cameraIntrinsics,
    input.imageWidthPixels,
    input.imageHeightPixels,
    nearClipPlane,
    farClipPlane,
  );
  const modelViewProjectionMatrix = multiplyColumnMajorMatrices(
    projectionMatrixColumnMajor,
    objectMatrixColumnMajor,
  );
  const clipSpaceHomogeneous = multiplyColumnMajorMatrix4ByVector4(modelViewProjectionMatrix, [
    0,
    0,
    0,
    1,
  ]);
  const clipSpaceW = clipSpaceHomogeneous[3]!;

  // Guard: homogeneous divide requires a non-zero W component.
  if (Math.abs(clipSpaceW) <= Number.EPSILON) {
    throw new RangeError("Clip-space W must be non-zero for projection.");
  }

  const normalizedDeviceCoordinateX = clipSpaceHomogeneous[0]! / clipSpaceW;
  const normalizedDeviceCoordinateY = clipSpaceHomogeneous[1]! / clipSpaceW;
  const pixelU = ((normalizedDeviceCoordinateX + 1) * input.imageWidthPixels) / 2;
  const pixelV = ((1 - normalizedDeviceCoordinateY) * input.imageHeightPixels) / 2;

  return [pixelU, pixelV];
}

/** Computes backing-store pixel dimensions for a WebGL canvas from CSS size and DPR. */
export function computeWebGlCanvasPixelSize(
  cssWidthPixels: number,
  cssHeightPixels: number,
  devicePixelRatio: number,
): WebGlCanvasPixelSize {
  const sanitizedDevicePixelRatio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

  return {
    widthPixels: Math.max(1, Math.round(cssWidthPixels * sanitizedDevicePixelRatio)),
    heightPixels: Math.max(1, Math.round(cssHeightPixels * sanitizedDevicePixelRatio)),
    devicePixelRatio: sanitizedDevicePixelRatio,
  };
}

/** Projects the object origin with kibo-track pinhole math for regression comparison. */
export function projectObjectOriginToPixelViaKiboTrack(
  cameraFromObjectPose: Pose,
  cameraIntrinsics: CameraIntrinsics,
): [number, number] {
  const projectedOrigin = projectPoint([0, 0, 0], cameraFromObjectPose, cameraIntrinsics);
  return [projectedOrigin[0]!, projectedOrigin[1]!];
}
