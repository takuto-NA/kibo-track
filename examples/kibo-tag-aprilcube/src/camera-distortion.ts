/**
 * OpenCV Brown-Conrady distortion helpers for example-layer calibration parity.
 */
import type { CameraIntrinsics, DetectedMarkerCorners, ImagePoint2D } from "kibo-track";

const OPENCV_DISTORTION_COEFFICIENT_COUNT = 5;
const UNDISTORTION_ITERATION_COUNT = 5;

interface DistortionCoefficients {
  readonly k1: number;
  readonly k2: number;
  readonly p1: number;
  readonly p2: number;
  readonly k3: number;
}

function readOpenCvDistortionCoefficients(
  distortionCoefficients: readonly number[],
): DistortionCoefficients {
  return {
    k1: distortionCoefficients[0] ?? 0,
    k2: distortionCoefficients[1] ?? 0,
    p1: distortionCoefficients[2] ?? 0,
    p2: distortionCoefficients[3] ?? 0,
    k3: distortionCoefficients[4] ?? 0,
  };
}

function hasSupportedDistortionCoefficients(
  distortionCoefficients: readonly number[] | undefined,
): distortionCoefficients is readonly number[] {
  if (distortionCoefficients === undefined) {
    return false;
  }

  return distortionCoefficients
    .slice(0, OPENCV_DISTORTION_COEFFICIENT_COUNT)
    .some((coefficient) => coefficient !== 0);
}

function distortNormalizedPoint(
  normalizedX: number,
  normalizedY: number,
  coefficients: DistortionCoefficients,
): readonly [number, number] {
  const radiusSquared = normalizedX * normalizedX + normalizedY * normalizedY;
  const radiusFourth = radiusSquared * radiusSquared;
  const radiusSixth = radiusFourth * radiusSquared;
  const radialScale =
    1 +
    coefficients.k1 * radiusSquared +
    coefficients.k2 * radiusFourth +
    coefficients.k3 * radiusSixth;
  const tangentialX =
    2 * coefficients.p1 * normalizedX * normalizedY +
    coefficients.p2 * (radiusSquared + 2 * normalizedX * normalizedX);
  const tangentialY =
    coefficients.p1 * (radiusSquared + 2 * normalizedY * normalizedY) +
    2 * coefficients.p2 * normalizedX * normalizedY;

  return [
    normalizedX * radialScale + tangentialX,
    normalizedY * radialScale + tangentialY,
  ];
}

export function distortImagePoint(
  imagePoint: ImagePoint2D,
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
): ImagePoint2D {
  if (!hasSupportedDistortionCoefficients(distortionCoefficients)) {
    return imagePoint;
  }

  const coefficients = readOpenCvDistortionCoefficients(distortionCoefficients);
  const normalizedX =
    (imagePoint[0] - cameraIntrinsics.principalPointX) / cameraIntrinsics.focalLengthX;
  const normalizedY =
    (imagePoint[1] - cameraIntrinsics.principalPointY) / cameraIntrinsics.focalLengthY;
  const [distortedX, distortedY] = distortNormalizedPoint(normalizedX, normalizedY, coefficients);

  return [
    cameraIntrinsics.focalLengthX * distortedX + cameraIntrinsics.principalPointX,
    cameraIntrinsics.focalLengthY * distortedY + cameraIntrinsics.principalPointY,
  ];
}

export function distortImagePoints(
  imagePoints: ReadonlyArray<ImagePoint2D>,
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
): ImagePoint2D[] {
  return imagePoints.map((imagePoint) =>
    distortImagePoint(imagePoint, cameraIntrinsics, distortionCoefficients),
  );
}

export function undistortImagePoint(
  imagePoint: ImagePoint2D,
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
): ImagePoint2D {
  if (!hasSupportedDistortionCoefficients(distortionCoefficients)) {
    return imagePoint;
  }

  const coefficients = readOpenCvDistortionCoefficients(distortionCoefficients);
  const distortedNormalizedX =
    (imagePoint[0] - cameraIntrinsics.principalPointX) / cameraIntrinsics.focalLengthX;
  const distortedNormalizedY =
    (imagePoint[1] - cameraIntrinsics.principalPointY) / cameraIntrinsics.focalLengthY;
  let normalizedX = distortedNormalizedX;
  let normalizedY = distortedNormalizedY;

  for (let iterationIndex = 0; iterationIndex < UNDISTORTION_ITERATION_COUNT; iterationIndex += 1) {
    const radiusSquared = normalizedX * normalizedX + normalizedY * normalizedY;
    const radiusFourth = radiusSquared * radiusSquared;
    const radiusSixth = radiusFourth * radiusSquared;
    const radialScale =
      1 +
      coefficients.k1 * radiusSquared +
      coefficients.k2 * radiusFourth +
      coefficients.k3 * radiusSixth;
    const tangentialX =
      2 * coefficients.p1 * normalizedX * normalizedY +
      coefficients.p2 * (radiusSquared + 2 * normalizedX * normalizedX);
    const tangentialY =
      coefficients.p1 * (radiusSquared + 2 * normalizedY * normalizedY) +
      2 * coefficients.p2 * normalizedX * normalizedY;

    normalizedX = (distortedNormalizedX - tangentialX) / radialScale;
    normalizedY = (distortedNormalizedY - tangentialY) / radialScale;
  }

  return [
    cameraIntrinsics.focalLengthX * normalizedX + cameraIntrinsics.principalPointX,
    cameraIntrinsics.focalLengthY * normalizedY + cameraIntrinsics.principalPointY,
  ];
}

export function undistortDetectedMarkers(
  detectedMarkers: ReadonlyArray<DetectedMarkerCorners>,
  cameraIntrinsics: CameraIntrinsics,
  distortionCoefficients: readonly number[] | undefined,
): DetectedMarkerCorners[] {
  return detectedMarkers.map((marker) => ({
    id: marker.id,
    corners: marker.corners.map((corner) =>
      undistortImagePoint(corner, cameraIntrinsics, distortionCoefficients),
    ),
  }));
}
