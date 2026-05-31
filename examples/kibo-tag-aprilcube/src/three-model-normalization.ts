/**
 * Pure helpers for scaling and centering three.js overlay models to AprilCube size.
 */

/** Millimeters per meter for CAD-exported OBJ vertex units. */
export const MODEL_VERTEX_MILLIMETERS_PER_METER = 1000;

/** Converts model vertex units from millimeters into meters. */
export const MODEL_VERTEX_UNIT_TO_METERS = 1 / MODEL_VERTEX_MILLIMETERS_PER_METER;

/** Max model reference dimension relative to AprilCube edge length. */
export const THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO = 4;

export interface BoundingBoxSize {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
}

export interface NormalizedModelScaleResult {
  readonly referenceDimensionMeters: number;
  readonly uniformScale: number;
  readonly targetReferenceDimensionMeters: number;
}

/** Returns the largest edge length of an axis-aligned bounding box. */
export function computeBoundingBoxMaxDimension(boundingBoxSize: BoundingBoxSize): number {
  return Math.max(boundingBoxSize.sizeX, boundingBoxSize.sizeY, boundingBoxSize.sizeZ);
}

/** Computes the uniform scale that maps a model max dimension to a target max dimension. */
export function computeUniformScaleForTargetMaxDimension(
  currentMaxDimension: number,
  targetMaxDimension: number,
): number {
  // Guard: zero-sized geometry cannot be normalized.
  if (currentMaxDimension <= Number.EPSILON) {
    throw new RangeError("Current max dimension must be positive for normalization.");
  }

  // Guard: target size must be positive.
  if (targetMaxDimension <= Number.EPSILON) {
    throw new RangeError("Target max dimension must be positive for normalization.");
  }

  return targetMaxDimension / currentMaxDimension;
}

/** Computes uniform scale from a meter-space bounding box and AprilCube edge length. */
export function computeNormalizedModelScaleForCubeSize(
  boundingBoxSizeMeters: BoundingBoxSize,
  cubeSizeMeters: number,
  modelToCubeSizeRatio: number = THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO,
): NormalizedModelScaleResult {
  const referenceDimensionMeters = computeBoundingBoxMaxDimension(boundingBoxSizeMeters);
  const targetReferenceDimensionMeters = cubeSizeMeters * modelToCubeSizeRatio;
  const uniformScale = computeUniformScaleForTargetMaxDimension(
    referenceDimensionMeters,
    targetReferenceDimensionMeters,
  );

  return {
    referenceDimensionMeters,
    uniformScale,
    targetReferenceDimensionMeters,
  };
}

/** Converts a millimeter-space bounding box into meters. */
export function convertBoundingBoxSizeMillimetersToMeters(
  boundingBoxSizeMillimeters: BoundingBoxSize,
): BoundingBoxSize {
  return {
    sizeX: boundingBoxSizeMillimeters.sizeX * MODEL_VERTEX_UNIT_TO_METERS,
    sizeY: boundingBoxSizeMillimeters.sizeY * MODEL_VERTEX_UNIT_TO_METERS,
    sizeZ: boundingBoxSizeMillimeters.sizeZ * MODEL_VERTEX_UNIT_TO_METERS,
  };
}

/** Reference bbox for the local-only ボディ60.obj asset (mm units, from repository data). */
export const BODY60_OBJ_BOUNDING_BOX_SIZE_MILLIMETERS: BoundingBoxSize = {
  sizeX: 39.371458,
  sizeY: 35.2,
  sizeZ: 72.787276,
};
