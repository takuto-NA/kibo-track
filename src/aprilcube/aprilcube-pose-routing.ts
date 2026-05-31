/**
 * Routes pre-built AprilCube correspondences to coplanar or multi-face pose solvers.
 */
import { areObjectPointsCoplanar } from "../pnp/coplanarity.js";
import { estimateCoplanarAprilCubePose } from "./coplanar-aprilcube-pose.js";
import { estimateMultiFaceAprilCubePose } from "./estimate-aprilcube-pose-resolve.js";
import type {
  AprilCubeCorrespondencesSuccess,
  EstimateAprilCubePoseInput,
  EstimateAprilCubePoseOptions,
  EstimateAprilCubePoseResult,
} from "./types.js";

/** Estimates pose from pre-built correspondences (coplanar or multi-face path). */
export function routeAprilCubePoseFromCorrespondences(
  input: EstimateAprilCubePoseInput,
  correspondences: AprilCubeCorrespondencesSuccess,
  options: EstimateAprilCubePoseOptions = {},
): EstimateAprilCubePoseResult {
  const {
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
  } = correspondences;

  if (areObjectPointsCoplanar(objectPoints)) {
    return estimateCoplanarAprilCubePose(input, correspondences, options);
  }

  return estimateMultiFaceAprilCubePose(
    input,
    imagePoints,
    objectPoints,
    markerIds,
    cornerIndices,
    options,
    "multiFace",
  );
}
