/**
 * Runnable demo: synthetic AprilCube markers -> estimateAprilCubePose diagnostics.
 */
import {
  buildAprilCubeObjectPointMap,
  estimateAprilCubePose,
  projectPoints,
} from "../dist/index.js";

const cameraIntrinsics = {
  focalLengthX: 800,
  focalLengthY: 800,
  principalPointX: 640,
  principalPointY: 360,
};

const cubeSizeMeters = 0.2;
const frontMarkerId = 10;
const backMarkerId = 11;
const groundTruthPose = {
  rotation: [0, 0, 0, 1],
  translation: [0.05, -0.03, 0.2],
};

const twoFaceConfig = {
  cubeSize: cubeSizeMeters,
  faces: {
    [frontMarkerId]: "front",
    [backMarkerId]: "back",
  },
};

const singleFaceConfig = {
  cubeSize: cubeSizeMeters,
  faces: {
    [frontMarkerId]: "front",
  },
};

const observationNoisePx = 0.5;
const outlierOffsetPx = 80;
const ransacRandomSeed = 42;

const noisePattern = [
  [0.35, -0.25],
  [-0.15, 0.4],
  [0.2, 0.15],
  [-0.3, -0.2],
  [0.25, 0.3],
  [-0.2, -0.15],
  [0.1, -0.35],
  [-0.25, 0.2],
];

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

function createProjectedMarkers(config) {
  const objectPointMap = buildAprilCubeObjectPointMap(config);

  return Object.keys(config.faces).map((markerIdText) => {
    const markerId = Number(markerIdText);
    const objectPoints = objectPointMap[markerId];

    if (objectPoints === undefined) {
      throw new RangeError("Marker object points are missing for demo projection.");
    }

    return {
      id: markerId,
      corners: projectPoints(objectPoints, groundTruthPose, cameraIntrinsics),
    };
  });
}

function addDeterministicNoise(markers) {
  let noisePatternIndex = 0;

  return markers.map((marker) => ({
    id: marker.id,
    corners: marker.corners.map((corner) => {
      const noise = noisePattern[noisePatternIndex];
      noisePatternIndex += 1;

      if (noise === undefined) {
        throw new RangeError("Noise pattern is missing for demo marker corner.");
      }

      return [
        corner[0] + noise[0] * observationNoisePx,
        corner[1] + noise[1] * observationNoisePx,
      ];
    }),
  }));
}

function injectBadCorner(markers) {
  const copiedMarkers = markers.map((marker) => ({
    id: marker.id,
    corners: [...marker.corners],
  }));

  const firstMarker = copiedMarkers[0];

  if (firstMarker === undefined || firstMarker.corners[0] === undefined) {
    throw new RangeError("First marker corner is missing for outlier injection.");
  }

  firstMarker.corners[0] = [
    firstMarker.corners[0][0] + outlierOffsetPx,
    firstMarker.corners[0][1] - outlierOffsetPx,
  ];

  return copiedMarkers;
}

function printResult(label, result, referencePose) {
  console.log(`\n=== ${label} ===`);

  if (!result.success) {
    console.log(`  stage: ${result.stage}`);
    console.log(`  failure reason: ${result.reason}`);
    return;
  }

  console.log(`  detected marker count: ${result.detectedMarkerCount}`);
  console.log(`  correspondence count: ${result.correspondenceCount}`);
  console.log(`  final mean reprojection error: ${result.finalMeanReprojectionErrorPx.toExponential(3)} px`);
  console.log(`  initial mean reprojection error: ${result.initialMeanReprojectionErrorPx.toExponential(3)} px`);
  console.log(`  translation error: ${computeTranslationErrorMeters(result.pose, referencePose).toExponential(3)} m`);
  console.log(`  confidence (heuristic): ${result.confidence.toFixed(4)}`);
  console.log(`  num inliers: ${result.numInliers}`);
  console.log(`  outlier marker diagnostics: ${JSON.stringify(result.outlierMarkerDiagnostics)}`);
  console.log(`  pose: ${JSON.stringify(formatPose(result.pose))}`);
}

console.log("=== Kibo-track v0.4 demo: estimateAprilCubePose ===\n");
console.log("Configured marker IDs:", Object.keys(twoFaceConfig.faces).join(", "));

const cleanMarkers = createProjectedMarkers(twoFaceConfig);

printResult(
  "Clean two-face synthetic case (RANSAC disabled)",
  estimateAprilCubePose(
    {
      markers: cleanMarkers,
      config: twoFaceConfig,
      cameraIntrinsics,
    },
    { enableRansac: false },
  ),
  groundTruthPose,
);

printResult(
  "Noisy two-face synthetic case (RANSAC disabled)",
  estimateAprilCubePose(
    {
      markers: addDeterministicNoise(cleanMarkers),
      config: twoFaceConfig,
      cameraIntrinsics,
    },
    { enableRansac: false },
  ),
  groundTruthPose,
);

printResult(
  "Outlier two-face synthetic case (seeded RANSAC)",
  estimateAprilCubePose(
    {
      markers: injectBadCorner(cleanMarkers),
      config: twoFaceConfig,
      cameraIntrinsics,
    },
    {
      randomSeed: ransacRandomSeed,
      reprojectionErrorThresholdPx: 5,
    },
  ),
  groundTruthPose,
);

printResult(
  "Unsupported single-face planar pose case",
  estimateAprilCubePose(
    {
      markers: createProjectedMarkers(singleFaceConfig),
      config: singleFaceConfig,
      cameraIntrinsics,
    },
    { enableRansac: false },
  ),
  groundTruthPose,
);

console.log("\nDone.");
