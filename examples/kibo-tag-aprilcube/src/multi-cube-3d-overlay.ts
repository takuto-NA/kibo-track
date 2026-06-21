/**
 * three.js WebGL overlay for the 16-cube AprilCube demo: loads 16 glTF models,
 * normalizes them to cube size, and renders them synced to per-cube tracked poses.
 */
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CameraIntrinsics, Pose } from "kibo-track";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";
import { buildMultiCubeModelUrls, readMultiCubeModelLabel } from "./multi-cube-model-assignment.js";
import {
  computeBoundingBoxMaxDimension,
  computeUniformScaleForTargetMaxDimension,
  type BoundingBoxSize,
} from "./three-model-normalization.js";
import {
  buildOpenCvStyleProjectionMatrixColumnMajor,
  buildThreeJsObjectMatrixFromPose,
  convertRowMajorMatrix4ToColumnMajor,
  THREE_OVERLAY_FAR_CLIP_PLANE,
  THREE_OVERLAY_NEAR_CLIP_PLANE,
} from "./three-pose-projection.js";
import { synchronizeOverlayCanvasSize } from "./resolution-gate.js";
import {
  shouldRenderThreeModelForPose,
  shouldShowThreeModelOverlay,
} from "./overlay-display-mode.js";
import type { OverlayDisplayMode } from "./types.js";

/** Model max dimension relative to AprilCube edge length (64mm for a 32mm cube). */
export const MULTI_CUBE_MODEL_TO_CUBE_SIZE_RATIO = 2;

/** Ambient fill light intensity for the 16-model scene. */
const MULTI_CUBE_AMBIENT_LIGHT_INTENSITY = 0.45;

/** Key directional light intensity for shading. */
const MULTI_CUBE_KEY_DIRECTIONAL_LIGHT_INTENSITY = 0.9;

/** Soft fill light from the opposite side (no shadows). */
const MULTI_CUBE_FILL_DIRECTIONAL_LIGHT_INTENSITY = 0.35;

/** Fixed key-light position in camera space. */
const MULTI_CUBE_KEY_LIGHT_CAMERA_SPACE_POSITION = new Vector3(0.5, 0.6, 0.8);

/** Fixed key-light target in camera space. */
const MULTI_CUBE_KEY_LIGHT_CAMERA_SPACE_TARGET = new Vector3(0, 0, -0.25);

/** Fixed fill-light position in camera space. */
const MULTI_CUBE_FILL_LIGHT_CAMERA_SPACE_POSITION = new Vector3(-0.5, 0.2, 0.4);

/** Fixed fill-light target (same anchor as key light). */
const MULTI_CUBE_FILL_LIGHT_CAMERA_SPACE_TARGET = MULTI_CUBE_KEY_LIGHT_CAMERA_SPACE_TARGET;

export interface MultiCubeThreeOverlaySession {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly modelRoots: ReadonlyArray<Object3D>;
  readonly modelLabels: ReadonlyArray<string>;
}

export interface MultiCubeThreeOverlayRenderInput {
  readonly overlayDisplayMode: OverlayDisplayMode;
  readonly cubePoses: ReadonlyArray<Pose | null>;
  readonly cameraIntrinsics: CameraIntrinsics | null;
  readonly captureCanvas: HTMLCanvasElement;
  readonly cubeSizeMeters: number;
}

/** Returns true when the three.js overlay should render for the current session input. */
export function shouldDrawMultiCubeThreeOverlay(
  input: MultiCubeThreeOverlayRenderInput,
): boolean {
  if (!shouldShowThreeModelOverlay(input.overlayDisplayMode)) {
    return false;
  }

  return input.cubePoses.some((pose) => pose !== null) && input.cameraIntrinsics !== null;
}

function computeObjectBoundingBoxSize(object3D: Object3D): BoundingBoxSize {
  const axisAlignedBoundingBox = new Box3().setFromObject(object3D);
  const boundingBoxSizeVector = axisAlignedBoundingBox.getSize(new Vector3());

  return {
    sizeX: boundingBoxSizeVector.x,
    sizeY: boundingBoxSizeVector.y,
    sizeZ: boundingBoxSizeVector.z,
  };
}

function centerObjectAtOrigin(object3D: Object3D): void {
  const axisAlignedBoundingBox = new Box3().setFromObject(object3D);
  const boundingBoxCenter = axisAlignedBoundingBox.getCenter(new Vector3());
  object3D.position.sub(boundingBoxCenter);
  object3D.updateMatrixWorld(true);
}

function normalizeLoadedGltfModel(
  loadedScene: Object3D,
  cubeSizeMeters: number,
): Object3D {
  const modelRoot = new Group();
  modelRoot.add(loadedScene);

  // glTF vertices are already in meters (Blender export), no mm→m conversion needed.
  modelRoot.updateMatrixWorld(true);

  // Compute bounding box and scale first, then center.
  // Doing center-before-scale would leave the center offset unscaled, shifting the model origin.
  const boundingBoxSizeMeters = computeObjectBoundingBoxSize(modelRoot);
  const referenceDimensionMeters = computeBoundingBoxMaxDimension(boundingBoxSizeMeters);
  const targetReferenceDimensionMeters = cubeSizeMeters * MULTI_CUBE_MODEL_TO_CUBE_SIZE_RATIO;
  const uniformScale = computeUniformScaleForTargetMaxDimension(
    referenceDimensionMeters,
    targetReferenceDimensionMeters,
  );

  modelRoot.scale.multiplyScalar(uniformScale);
  modelRoot.updateMatrixWorld(true);
  centerObjectAtOrigin(modelRoot);

  return modelRoot;
}

function createMultiCubeOverlayRenderer(
  threeModelCanvas: HTMLCanvasElement,
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas: threeModelCanvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  renderer.setClearColor(new Color(0x000000), 0);
  renderer.autoClear = true;
  // Shadows disabled: 16 models with shadow maps would be too heavy for mobile.
  renderer.shadowMap.enabled = false;
  return renderer;
}

function createMultiCubeOverlayScene(): {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
} {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.matrix.identity();
  camera.matrixWorld.identity();
  scene.add(camera);

  const ambientLight = new AmbientLight(0xffffff, MULTI_CUBE_AMBIENT_LIGHT_INTENSITY);

  const keyDirectionalLight = new DirectionalLight(
    0xffffff,
    MULTI_CUBE_KEY_DIRECTIONAL_LIGHT_INTENSITY,
  );
  keyDirectionalLight.position.copy(MULTI_CUBE_KEY_LIGHT_CAMERA_SPACE_POSITION);
  keyDirectionalLight.target.position.copy(MULTI_CUBE_KEY_LIGHT_CAMERA_SPACE_TARGET);
  camera.add(keyDirectionalLight.target);
  camera.add(keyDirectionalLight);

  const fillDirectionalLight = new DirectionalLight(
    0xffffff,
    MULTI_CUBE_FILL_DIRECTIONAL_LIGHT_INTENSITY,
  );
  fillDirectionalLight.position.copy(MULTI_CUBE_FILL_LIGHT_CAMERA_SPACE_POSITION);
  fillDirectionalLight.target.position.copy(MULTI_CUBE_FILL_LIGHT_CAMERA_SPACE_TARGET);
  camera.add(fillDirectionalLight.target);
  camera.add(fillDirectionalLight);

  scene.add(ambientLight);

  return { scene, camera };
}

/** Loads 16 glTF models, normalizes them, and creates a three.js overlay session. */
export async function createMultiCubeThreeOverlay(
  threeModelCanvas: HTMLCanvasElement,
  cubeSizeMeters: number,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<MultiCubeThreeOverlaySession> {
  const renderer = createMultiCubeOverlayRenderer(threeModelCanvas);
  const overlayScene = createMultiCubeOverlayScene();
  const modelUrls = buildMultiCubeModelUrls(baseUrl);
  const loader = new GLTFLoader();

  const loadedModels = await Promise.all(
    modelUrls.map(async (modelUrl, cubeIndex) => {
      const gltf = await loader.loadAsync(modelUrl);
      const normalizedModel = normalizeLoadedGltfModel(gltf.scene, cubeSizeMeters);

      const modelRoot = new Object3D();
      modelRoot.matrixAutoUpdate = false;
      modelRoot.add(normalizedModel);
      modelRoot.visible = false;
      overlayScene.scene.add(modelRoot);

      return { modelRoot, cubeIndex };
    }),
  );

  const modelRoots = loadedModels.map((entry) => entry.modelRoot);
  const modelLabels = Array.from(
    { length: MULTI_CUBE_CONFIG_COUNT },
    (_, cubeIndex) => readMultiCubeModelLabel(cubeIndex),
  );

  return {
    renderer,
    scene: overlayScene.scene,
    camera: overlayScene.camera,
    modelRoots,
    modelLabels,
  };
}

function synchronizeThreeModelCanvasSize(
  threeModelCanvas: HTMLCanvasElement,
  captureCanvas: HTMLCanvasElement,
): { readonly widthPixels: number; readonly heightPixels: number } {
  synchronizeOverlayCanvasSize(captureCanvas, threeModelCanvas);

  return {
    widthPixels: captureCanvas.width,
    heightPixels: captureCanvas.height,
  };
}

function applyCameraIntrinsicsToThreeCamera(
  camera: PerspectiveCamera,
  cameraIntrinsics: CameraIntrinsics,
  imageWidthPixels: number,
  imageHeightPixels: number,
): void {
  const projectionMatrix = new Matrix4().fromArray(
    buildOpenCvStyleProjectionMatrixColumnMajor(
      cameraIntrinsics,
      imageWidthPixels,
      imageHeightPixels,
      THREE_OVERLAY_NEAR_CLIP_PLANE,
      THREE_OVERLAY_FAR_CLIP_PLANE,
    ),
  );

  camera.projectionMatrix.copy(projectionMatrix);
  camera.projectionMatrixInverse.copy(projectionMatrix).invert();
}

function applyPoseToModelRoot(modelRoot: Object3D, cameraFromObjectPose: Pose): void {
  const objectMatrix = new Matrix4().fromArray(
    convertRowMajorMatrix4ToColumnMajor(buildThreeJsObjectMatrixFromPose(cameraFromObjectPose)),
  );
  modelRoot.matrix.copy(objectMatrix);
  modelRoot.matrixAutoUpdate = false;
  modelRoot.updateMatrixWorld(true);
}

function hideAllModels(session: MultiCubeThreeOverlaySession): void {
  for (const modelRoot of session.modelRoots) {
    modelRoot.visible = false;
  }
  session.renderer.clear();
}

/** Renders or hides the 16-model three.js overlay for the current tracked poses. */
export function renderMultiCubeThreeOverlay(
  session: MultiCubeThreeOverlaySession,
  threeModelCanvas: HTMLCanvasElement,
  input: MultiCubeThreeOverlayRenderInput,
): void {
  if (!shouldShowThreeModelOverlay(input.overlayDisplayMode)) {
    hideAllModels(session);
    return;
  }

  const cameraIntrinsics = input.cameraIntrinsics;

  if (cameraIntrinsics === null) {
    hideAllModels(session);
    return;
  }

  const anyPoseAvailable = input.cubePoses.some((pose) => pose !== null);

  if (!shouldRenderThreeModelForPose(input.overlayDisplayMode, anyPoseAvailable)) {
    hideAllModels(session);
    return;
  }

  const canvasPixelSize = synchronizeThreeModelCanvasSize(
    threeModelCanvas,
    input.captureCanvas,
  );

  session.renderer.setSize(
    canvasPixelSize.widthPixels,
    canvasPixelSize.heightPixels,
    false,
  );

  applyCameraIntrinsicsToThreeCamera(
    session.camera,
    cameraIntrinsics,
    canvasPixelSize.widthPixels,
    canvasPixelSize.heightPixels,
  );

  for (let cubeIndex = 0; cubeIndex < MULTI_CUBE_CONFIG_COUNT; cubeIndex += 1) {
    const pose = input.cubePoses[cubeIndex];
    const modelRoot = session.modelRoots[cubeIndex];

    if (pose === null || pose === undefined || modelRoot === undefined) {
      if (modelRoot !== undefined) {
        modelRoot.visible = false;
      }
      continue;
    }

    applyPoseToModelRoot(modelRoot, pose);
    modelRoot.visible = true;
  }

  session.renderer.render(session.scene, session.camera);
}

/** Disposes three.js GPU resources held by the 16-model overlay session. */
export function disposeMultiCubeThreeOverlay(session: MultiCubeThreeOverlaySession): void {
  for (const modelRoot of session.modelRoots) {
    modelRoot.traverse((childObject) => {
      // Best-effort disposal: glTF meshes own geometries and materials.
      const mesh = childObject as unknown as {
        geometry?: { dispose: () => void };
        material?: unknown;
      };

      mesh.geometry?.dispose?.();

      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const mat of material) {
          if (mat && typeof mat === "object" && "dispose" in mat) {
            (mat as { dispose: () => void }).dispose();
          }
        }
      } else if (material && typeof material === "object" && "dispose" in material) {
        (material as { dispose: () => void }).dispose();
      }
    });
  }

  session.renderer.dispose();
}
