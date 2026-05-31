/**
 * Homography-based planar pose estimation with LM refinement and prior disambiguation.
 */
import { projectPoints } from "../../core/project-points.js";
import { reprojectionError } from "../../core/reprojection-error.js";
import type { Pose } from "../../core/types.js";
import { MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT } from "../constants.js";
import { refinePoseLM } from "../refine-pose-lm.js";
import { decomposeHomographyToPoseCandidates } from "./decompose-homography.js";
import { estimateHomographyFromCorrespondences } from "./estimate-homography.js";
import { normalizeImagePoints } from "./normalize-image-points.js";
import { buildCoplanarPlaneBasis } from "./plane-basis.js";
import { computePlanarAmbiguityScore, computePoseDistanceScore } from "./pose-distance.js";
import type {
  EstimatePlanarPoseInput,
  EstimatePlanarPoseOptions,
  EstimatePlanarPoseResult,
  PlanarPoseCandidate,
} from "./types.js";

/** Minimum reprojection gap (px) required to accept a cold-start single candidate. */
const MINIMUM_PLANAR_AMBIGUITY_RESOLUTION_PX = 0.25;

function refinePlanarCandidate(
  input: EstimatePlanarPoseInput,
  initialPose: Pose,
  maxRefinementIterations: number | undefined,
): PlanarPoseCandidate | null {
  const refinementResult = refinePoseLM(
    {
      imagePoints: input.imagePoints,
      objectPoints: input.objectPoints,
      cameraIntrinsics: input.cameraIntrinsics,
      initialPose,
    },
    {
      maxIterations: maxRefinementIterations,
    },
  );

  if (!refinementResult.success) {
    return null;
  }

  return {
    pose: refinementResult.pose,
    meanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    initialMeanReprojectionErrorPx: refinementResult.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: refinementResult.finalMeanReprojectionErrorPx,
    iterations: refinementResult.iterations,
  };
}

function sortCandidatesByReprojectionError(
  candidates: ReadonlyArray<PlanarPoseCandidate>,
): PlanarPoseCandidate[] {
  return [...candidates].sort(
    (leftCandidate, rightCandidate) =>
      leftCandidate.finalMeanReprojectionErrorPx - rightCandidate.finalMeanReprojectionErrorPx,
  );
}

function selectCandidateWithPreviousPose(
  refinedCandidates: ReadonlyArray<PlanarPoseCandidate>,
  previousPose: Pose,
): number {
  let bestCandidateIndex = 0;
  let bestDistanceScore = Number.POSITIVE_INFINITY;

  for (let candidateIndex = 0; candidateIndex < refinedCandidates.length; candidateIndex += 1) {
    const candidate = refinedCandidates[candidateIndex];

    if (candidate === undefined) {
      continue;
    }

    const distanceScore = computePoseDistanceScore(previousPose, candidate.pose);

    if (distanceScore < bestDistanceScore) {
      bestDistanceScore = distanceScore;
      bestCandidateIndex = candidateIndex;
    }
  }

  return bestCandidateIndex;
}

/** Estimates pose from coplanar 2D-3D correspondences using homography decomposition. */
export function estimatePlanarPose(
  input: EstimatePlanarPoseInput,
  options: EstimatePlanarPoseOptions = {},
): EstimatePlanarPoseResult {
  if (input.imagePoints.length < MINIMUM_ESTIMATE_POSE_CORRESPONDENCE_COUNT) {
    return {
      success: false,
      reason: "notEnoughPoints",
    };
  }

  if (options.previousPose !== undefined) {
    const priorRefinement = refinePlanarCandidate(
      input,
      options.previousPose,
      options.maxRefinementIterations,
    );

    if (priorRefinement === null) {
      return {
        success: false,
        reason: "degenerateConfiguration",
      };
    }

    return {
      success: true,
      pose: priorRefinement.pose,
      candidates: [priorRefinement],
      selectedCandidateIndex: 0,
      planarAmbiguityScore: Number.POSITIVE_INFINITY,
      meanReprojectionErrorPx: priorRefinement.finalMeanReprojectionErrorPx,
      initialMeanReprojectionErrorPx: priorRefinement.initialMeanReprojectionErrorPx,
      finalMeanReprojectionErrorPx: priorRefinement.finalMeanReprojectionErrorPx,
      iterations: priorRefinement.iterations,
    };
  }

  let planeBasis;

  try {
    planeBasis = buildCoplanarPlaneBasis(input.objectPoints);
  } catch {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const normalizedImagePoints = normalizeImagePoints(
    input.imagePoints,
    input.cameraIntrinsics,
  );

  let homographyMatrix;

  try {
    homographyMatrix = estimateHomographyFromCorrespondences(
      planeBasis.planeCoordinates2D,
      normalizedImagePoints,
    );
  } catch {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const rawPoseCandidates = decomposeHomographyToPoseCandidates(
    homographyMatrix,
    planeBasis,
    input.objectPoints,
  );

  if (rawPoseCandidates.length === 0) {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const refinedCandidates: PlanarPoseCandidate[] = [];

  for (const rawPoseCandidate of rawPoseCandidates) {
    const refinedCandidate = refinePlanarCandidate(
      input,
      rawPoseCandidate,
      options.maxRefinementIterations,
    );

    if (refinedCandidate !== null) {
      refinedCandidates.push(refinedCandidate);
    }
  }

  if (refinedCandidates.length === 0) {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const sortedCandidates = sortCandidatesByReprojectionError(refinedCandidates);
  const bestCandidate = sortedCandidates[0];
  const secondBestCandidate = sortedCandidates[1] ?? null;

  if (bestCandidate === undefined) {
    return {
      success: false,
      reason: "degenerateConfiguration",
    };
  }

  const planarAmbiguityScore = computePlanarAmbiguityScore(
    bestCandidate.finalMeanReprojectionErrorPx,
    secondBestCandidate?.finalMeanReprojectionErrorPx ?? null,
  );

  if (sortedCandidates.length === 1) {
    return {
      success: true,
      pose: bestCandidate.pose,
      candidates: sortedCandidates,
      selectedCandidateIndex: 0,
      planarAmbiguityScore,
      meanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
      initialMeanReprojectionErrorPx: bestCandidate.initialMeanReprojectionErrorPx,
      finalMeanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
      iterations: bestCandidate.iterations,
    };
  }

  if (options.previousPose !== undefined) {
    const selectedCandidateIndex = selectCandidateWithPreviousPose(
      sortedCandidates,
      options.previousPose,
    );
    const selectedCandidate = sortedCandidates[selectedCandidateIndex];

    if (selectedCandidate === undefined) {
      return {
        success: false,
        reason: "degenerateConfiguration",
        candidates: sortedCandidates,
        planarAmbiguityScore,
      };
    }

    return {
      success: true,
      pose: selectedCandidate.pose,
      candidates: sortedCandidates,
      selectedCandidateIndex,
      planarAmbiguityScore,
      meanReprojectionErrorPx: selectedCandidate.finalMeanReprojectionErrorPx,
      initialMeanReprojectionErrorPx: selectedCandidate.initialMeanReprojectionErrorPx,
      finalMeanReprojectionErrorPx: selectedCandidate.finalMeanReprojectionErrorPx,
      iterations: selectedCandidate.iterations,
    };
  }

  if (
    sortedCandidates.length > 1 &&
    planarAmbiguityScore < MINIMUM_PLANAR_AMBIGUITY_RESOLUTION_PX
  ) {
    return {
      success: false,
      reason: "planarAmbiguous",
      candidates: sortedCandidates,
      planarAmbiguityScore,
    };
  }

  return {
    success: true,
    pose: bestCandidate.pose,
    candidates: sortedCandidates,
    selectedCandidateIndex: 0,
    planarAmbiguityScore,
    meanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
    initialMeanReprojectionErrorPx: bestCandidate.initialMeanReprojectionErrorPx,
    finalMeanReprojectionErrorPx: bestCandidate.finalMeanReprojectionErrorPx,
    iterations: bestCandidate.iterations,
  };
}

/** Computes mean reprojection error for diagnostics without changing pose. */
export function computeMeanReprojectionErrorPx(
  input: EstimatePlanarPoseInput,
  pose: Pose,
): number {
  const projectedImagePoints = projectPoints(
    input.objectPoints,
    pose,
    input.cameraIntrinsics,
  );

  return reprojectionError(input.imagePoints, projectedImagePoints).meanErrorPx;
}
