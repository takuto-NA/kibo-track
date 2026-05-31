/**
 * Runnable demo: synthetic 2D–3D correspondences -> LM pose refinement.
 */
import {
  projectPoints,
  refinePoseLM,
  rotationVectorToQuaternion,
} from "../dist/index.js";

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
];

const imagePoints = projectPoints(
  objectPoints,
  groundTruthPose,
  cameraIntrinsics,
);

const perturbedInitialPose = {
  rotation: rotationVectorToQuaternion([0.05, 0, 0]),
  translation: [
    groundTruthPose.translation[0] + 0.02,
    groundTruthPose.translation[1] - 0.015,
    groundTruthPose.translation[2] + 0.01,
  ],
};

function formatPose(pose) {
  const translation = pose.translation.map((value) => value.toFixed(4));
  const rotation = pose.rotation.map((value) => value.toFixed(4));
  return {
    translation,
    rotationQuaternion: rotation,
  };
}

console.log("=== Kibo-track v0.2 demo: refinePoseLM ===\n");

console.log("Ground truth pose:");
console.log(formatPose(groundTruthPose));

console.log("\nSynthetic observations (first 3 image points):");
for (let pointIndex = 0; pointIndex < 3; pointIndex += 1) {
  const imagePoint = imagePoints[pointIndex];
  const objectPoint = objectPoints[pointIndex];
  console.log(
    `  object ${JSON.stringify(objectPoint)} -> image [${imagePoint[0].toFixed(1)}, ${imagePoint[1].toFixed(1)}] px`,
  );
}

console.log("\nInitial pose (deliberately perturbed):");
console.log(formatPose(perturbedInitialPose));

const result = refinePoseLM({
  imagePoints,
  objectPoints,
  cameraIntrinsics,
  initialPose: perturbedInitialPose,
});

if (!result.success) {
  console.error("\nRefinement failed:", result.reason);
  process.exit(1);
}

console.log("\n--- LM refinement result ---");
console.log(`  converged:              ${result.converged}`);
console.log(`  iterations:             ${result.iterations}`);
console.log(`  initial error:          ${result.initialMeanReprojectionErrorPx.toFixed(4)} px`);
console.log(`  final error:            ${result.finalMeanReprojectionErrorPx.toFixed(6)} px`);
console.log(`  improvement ratio:      ${(result.improvementRatio * 100).toFixed(1)}%`);
console.log(`  final residual norm:    ${result.finalResidualNorm.toFixed(6)}`);

console.log("\nRefined pose:");
console.log(formatPose(result.pose));

console.log("\nGround truth vs refined translation delta:");
console.log(
  `  dx=${(result.pose.translation[0] - groundTruthPose.translation[0]).toExponential(2)}`,
  `dy=${(result.pose.translation[1] - groundTruthPose.translation[1]).toExponential(2)}`,
  `dz=${(result.pose.translation[2] - groundTruthPose.translation[2]).toExponential(2)}`,
);

console.log("\nDone.");
