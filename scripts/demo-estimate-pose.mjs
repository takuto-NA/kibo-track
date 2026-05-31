/**
 * Runnable demo: synthetic 2D–3D correspondences -> estimatePose diagnostics.
 */
import { estimatePose, projectPoints } from "../dist/index.js";

const cameraIntrinsics = {
  focalLengthX: 800,
  focalLengthY: 800,
  principalPointX: 640,
  principalPointY: 360,
};

const groundTruthPose = {
  rotation: [0, 0, 0, 1],
  translation: [0.05, -0.03, 0.2],
};

const objectPoints = [
  [-0.1, -0.1, 0.2],
  [0.1, -0.1, 0.2],
  [0.1, 0.1, 0.2],
  [-0.1, 0.1, 0.2],
  [0, 0, 0.3],
  [0.05, -0.05, 0.25],
  [0.08, 0.06, 0.35],
  [-0.06, 0.04, 0.28],
  [0.03, -0.07, 0.32],
  [-0.04, -0.05, 0.27],
];

const noisePattern = [
  [0.4, -0.3],
  [-0.2, 0.5],
  [0.3, 0.2],
  [-0.4, -0.1],
  [0.1, -0.4],
  [-0.3, 0.3],
  [0.2, 0.4],
  [-0.1, -0.2],
  [0.35, -0.25],
  [-0.15, 0.35],
];

const observationNoisePx = 0.5;
const outlierOffsetPx = 80;
const ransacRandomSeed = 42;

function formatPose(pose) {
  return {
    translation: pose.translation.map((value) => value.toFixed(6)),
    rotationQuaternion: pose.rotation.map((value) => value.toFixed(6)),
  };
}

function computeTranslationErrorMeters(estimatedPose, referencePose) {
  const deltaX = estimatedPose.translation[0] - referencePose.translation[0];
  const deltaY = estimatedPose.translation[1] - referencePose.translation[1];
  const deltaZ = estimatedPose.translation[2] - referencePose.translation[2];
  return Math.hypot(deltaX, deltaY, deltaZ);
}

function addDeterministicNoise(imagePoints) {
  return imagePoints.map((imagePoint, pointIndex) => {
    const noise = noisePattern[pointIndex];
    return [
      imagePoint[0] + noise[0] * observationNoisePx,
      imagePoint[1] + noise[1] * observationNoisePx,
    ];
  });
}

function createOutlierImagePoints(cleanImagePoints) {
  const imagePoints = [...cleanImagePoints];
  imagePoints[8] = [
    imagePoints[8][0] + outlierOffsetPx,
    imagePoints[8][1] - outlierOffsetPx,
  ];
  imagePoints[9] = [
    imagePoints[9][0] + outlierOffsetPx,
    imagePoints[9][1] - outlierOffsetPx,
  ];
  return imagePoints;
}

function printEstimateResult(label, result, referencePose) {
  console.log(`\n=== ${label} ===`);

  if (!result.success) {
    console.log(`  failure reason: ${result.reason}`);
    return;
  }

  console.log(`  final mean reprojection error: ${result.finalMeanReprojectionErrorPx.toExponential(3)} px`);
  console.log(`  initial mean reprojection error: ${result.initialMeanReprojectionErrorPx.toExponential(3)} px`);
  console.log(`  translation error: ${computeTranslationErrorMeters(result.pose, referencePose).toExponential(3)} m`);
  console.log(`  confidence (heuristic): ${result.confidence.toFixed(4)}`);
  console.log(`  num inliers: ${result.numInliers}`);
  console.log(`  inlier ratio: ${result.inlierRatio.toFixed(4)}`);
  console.log(`  outlier indices: ${JSON.stringify(result.outlierIndices)}`);
  console.log(`  iterations: ${result.iterations}`);
  console.log(`  pose: ${JSON.stringify(formatPose(result.pose))}`);
}

console.log("=== Kibo-track v0.3 demo: estimatePose ===\n");

const cleanImagePoints = projectPoints(objectPoints, groundTruthPose, cameraIntrinsics);
const noisyImagePoints = addDeterministicNoise(cleanImagePoints);
const outlierImagePoints = createOutlierImagePoints(cleanImagePoints);

printEstimateResult(
  "Clean synthetic case (RANSAC disabled)",
  estimatePose(
    {
      imagePoints: cleanImagePoints,
      objectPoints,
      cameraIntrinsics,
    },
    { enableRansac: false },
  ),
  groundTruthPose,
);

printEstimateResult(
  "Noisy synthetic case (RANSAC disabled)",
  estimatePose(
    {
      imagePoints: noisyImagePoints,
      objectPoints,
      cameraIntrinsics,
    },
    { enableRansac: false },
  ),
  groundTruthPose,
);

printEstimateResult(
  "Outlier synthetic case (seeded RANSAC)",
  estimatePose(
    {
      imagePoints: outlierImagePoints,
      objectPoints,
      cameraIntrinsics,
    },
    {
      randomSeed: ransacRandomSeed,
      reprojectionErrorThresholdPx: 5,
    },
  ),
  groundTruthPose,
);

console.log("\nFailure cases:");
const tooFewPointsResult = estimatePose({
  imagePoints: cleanImagePoints.slice(0, 3),
  objectPoints: objectPoints.slice(0, 3),
  cameraIntrinsics,
});
console.log(`  too few points -> ${tooFewPointsResult.success ? "unexpected success" : tooFewPointsResult.reason}`);

const degenerateResult = estimatePose({
  imagePoints: [
    [640, 360],
    [740, 360],
    [640, 460],
    [740, 460],
  ],
  objectPoints: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
  cameraIntrinsics,
  enableRansac: false,
});
console.log(
  `  degenerate geometry -> ${degenerateResult.success ? "unexpected success" : degenerateResult.reason}`,
);

console.log("\nDone.");
