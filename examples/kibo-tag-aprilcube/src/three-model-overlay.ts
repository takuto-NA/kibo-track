/**
 * three.js WebGL model overlay synced to tracked AprilCube pose.
 */
import {
  AmbientLight,
  AxesHelper,
  Color,
  DirectionalLight,
  Matrix4,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import type { CameraIntrinsics, Pose } from "kibo-track";
import { shouldRenderThreeModelForPose } from "./overlay-display-mode.js";
import { synchronizeOverlayCanvasSize } from "./resolution-gate.js";
import { DEFAULT_THREE_OVERLAY_OBJ_URL } from "./three-model-asset-paths.js";
import {
  disposeObject3DResources,
  enableShadowCastingOnModelMeshes,
  loadNormalizedObjOverlayModel,
} from "./three-model-load-obj.js";
import { THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO } from "./three-model-normalization.js";
import {
  buildOpenCvStyleProjectionMatrixColumnMajor,
  buildThreeJsObjectMatrixFromPose,
  convertRowMajorMatrix4ToColumnMajor,
  THREE_OVERLAY_FAR_CLIP_PLANE,
  THREE_OVERLAY_NEAR_CLIP_PLANE,
} from "./three-pose-projection.js";
import type { OverlayDisplayMode } from "./types.js";

/** Axis helper length in meters for orientation debugging. */
const THREE_OVERLAY_AXIS_HELPER_LENGTH_METERS = 0.02;

/** Ambient fill kept low so directional shadows remain visible. */
const THREE_OVERLAY_AMBIENT_LIGHT_INTENSITY = 0.22;

/** Key light intensity for primary shading and shadow casting. */
const THREE_OVERLAY_KEY_DIRECTIONAL_LIGHT_INTENSITY = 1.15;

/** Soft fill light from the opposite side (no shadows). */
const THREE_OVERLAY_FILL_DIRECTIONAL_LIGHT_INTENSITY = 0.32;

/** Shadow map resolution in pixels (width and height). */
const THREE_OVERLAY_SHADOW_MAP_SIZE_PIXELS = 1024;

/** Shadow frustum half-extent multiplier relative to normalized model target size. */
const THREE_OVERLAY_SHADOW_FRUSTUM_HALF_EXTENT_MULTIPLIER = 1.35;

/** Extra margin so shadow frustum covers typical model depth when centered on the camera. */
const THREE_OVERLAY_SHADOW_FRUSTUM_DEPTH_MARGIN_MULTIPLIER = 3;

/** Shadow camera far-plane multiplier relative to frustum half-extent. */
const THREE_OVERLAY_SHADOW_CAMERA_FAR_PLANE_MULTIPLIER = 4;

/** Shadow bias to reduce shadow acne on curved OBJ surfaces. */
const THREE_OVERLAY_SHADOW_BIAS = -0.0002;

/** Shadow normal bias for high-curvature mesh self-shadowing. */
const THREE_OVERLAY_SHADOW_NORMAL_BIAS = 0.025;

/** Fixed key-light position in camera space (does not follow object pose). */
const THREE_OVERLAY_KEY_LIGHT_CAMERA_SPACE_POSITION = new Vector3(0.35, 0.55, 0.75);

/** Fixed key-light target in camera space (view axis anchor). */
const THREE_OVERLAY_KEY_LIGHT_CAMERA_SPACE_TARGET = new Vector3(0, 0, -0.25);

/** Fixed fill-light target in camera space (same view anchor as key light). */
const THREE_OVERLAY_FILL_LIGHT_CAMERA_SPACE_TARGET = THREE_OVERLAY_KEY_LIGHT_CAMERA_SPACE_TARGET;

/** Fixed fill-light position in camera space (no shadows). */
const THREE_OVERLAY_FILL_LIGHT_CAMERA_SPACE_POSITION = new Vector3(-0.4, 0.15, 0.35);

export interface ThreeModelOverlaySession {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly modelRoot: Object3D;
  readonly modelObject: Object3D;
  readonly axisHelper: AxesHelper;
}

export interface ThreeModelOverlayRenderInput {
  readonly overlayDisplayMode: OverlayDisplayMode;
  readonly cameraFromObjectPose: Pose | null;
  readonly cameraIntrinsics: CameraIntrinsics | null;
  readonly captureCanvas: HTMLCanvasElement;
  readonly cubeSizeMeters: number;
}

/** Returns true when the three.js overlay should render for the current session input. */
export function shouldDrawThreeModelOverlay(input: ThreeModelOverlayRenderInput): boolean {
  return shouldRenderThreeModelForPose(
    input.overlayDisplayMode,
    input.cameraFromObjectPose !== null && input.cameraIntrinsics !== null,
  );
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

function computeShadowFrustumHalfExtentMeters(cubeSizeMeters: number): number {
  const normalizedModelTargetSizeMeters =
    cubeSizeMeters * THREE_OVERLAY_MODEL_TO_CUBE_SIZE_RATIO;

  return (
    normalizedModelTargetSizeMeters *
    THREE_OVERLAY_SHADOW_FRUSTUM_HALF_EXTENT_MULTIPLIER *
    THREE_OVERLAY_SHADOW_FRUSTUM_DEPTH_MARGIN_MULTIPLIER
  );
}

function configureKeyDirectionalLightShadowFrustum(
  keyDirectionalLight: DirectionalLight,
  shadowFrustumHalfExtentMeters: number,
): void {
  const shadowCamera = keyDirectionalLight.shadow.camera;
  shadowCamera.left = -shadowFrustumHalfExtentMeters;
  shadowCamera.right = shadowFrustumHalfExtentMeters;
  shadowCamera.top = shadowFrustumHalfExtentMeters;
  shadowCamera.bottom = -shadowFrustumHalfExtentMeters;
  shadowCamera.near = THREE_OVERLAY_NEAR_CLIP_PLANE;
  shadowCamera.far =
    shadowFrustumHalfExtentMeters * THREE_OVERLAY_SHADOW_CAMERA_FAR_PLANE_MULTIPLIER;
  shadowCamera.updateProjectionMatrix();
}

function hideThreeModelOverlay(session: ThreeModelOverlaySession): void {
  session.modelRoot.visible = false;
  session.renderer.clear();
}

function createThreeModelOverlayRenderer(threeModelCanvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas: threeModelCanvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  renderer.setClearColor(new Color(0x000000), 0);
  renderer.autoClear = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

function configureDirectionalLightShadows(keyDirectionalLight: DirectionalLight): void {
  keyDirectionalLight.castShadow = true;
  keyDirectionalLight.shadow.mapSize.set(
    THREE_OVERLAY_SHADOW_MAP_SIZE_PIXELS,
    THREE_OVERLAY_SHADOW_MAP_SIZE_PIXELS,
  );
  keyDirectionalLight.shadow.bias = THREE_OVERLAY_SHADOW_BIAS;
  keyDirectionalLight.shadow.normalBias = THREE_OVERLAY_SHADOW_NORMAL_BIAS;
}

function createThreeModelOverlayScene(
  shadowFrustumHalfExtentMeters: number,
): {
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

  const ambientLight = new AmbientLight(0xffffff, THREE_OVERLAY_AMBIENT_LIGHT_INTENSITY);

  const keyDirectionalLight = new DirectionalLight(
    0xffffff,
    THREE_OVERLAY_KEY_DIRECTIONAL_LIGHT_INTENSITY,
  );
  keyDirectionalLight.position.copy(THREE_OVERLAY_KEY_LIGHT_CAMERA_SPACE_POSITION);
  keyDirectionalLight.target.position.copy(THREE_OVERLAY_KEY_LIGHT_CAMERA_SPACE_TARGET);
  configureDirectionalLightShadows(keyDirectionalLight);
  configureKeyDirectionalLightShadowFrustum(
    keyDirectionalLight,
    shadowFrustumHalfExtentMeters,
  );
  camera.add(keyDirectionalLight.target);
  camera.add(keyDirectionalLight);

  const fillDirectionalLight = new DirectionalLight(
    0xffffff,
    THREE_OVERLAY_FILL_DIRECTIONAL_LIGHT_INTENSITY,
  );
  fillDirectionalLight.position.copy(THREE_OVERLAY_FILL_LIGHT_CAMERA_SPACE_POSITION);
  fillDirectionalLight.target.position.copy(THREE_OVERLAY_FILL_LIGHT_CAMERA_SPACE_TARGET);
  camera.add(fillDirectionalLight.target);
  camera.add(fillDirectionalLight);

  scene.add(ambientLight);

  return {
    scene,
    camera,
  };
}

/** Loads the default OBJ overlay model and creates a three.js overlay session. */
export async function createThreeModelOverlay(
  threeModelCanvas: HTMLCanvasElement,
  cubeSizeMeters: number,
  objUrl: string = DEFAULT_THREE_OVERLAY_OBJ_URL,
): Promise<ThreeModelOverlaySession> {
  const renderer = createThreeModelOverlayRenderer(threeModelCanvas);
  const shadowFrustumHalfExtentMeters = computeShadowFrustumHalfExtentMeters(cubeSizeMeters);
  const overlayScene = createThreeModelOverlayScene(shadowFrustumHalfExtentMeters);
  const loadedNormalizedObjModel = await loadNormalizedObjOverlayModel(cubeSizeMeters, objUrl);
  enableShadowCastingOnModelMeshes(loadedNormalizedObjModel.modelObject);

  const modelRoot = new Object3D();
  modelRoot.matrixAutoUpdate = false;
  modelRoot.add(loadedNormalizedObjModel.modelObject);

  const axisHelper = new AxesHelper(THREE_OVERLAY_AXIS_HELPER_LENGTH_METERS);
  modelRoot.add(axisHelper);
  overlayScene.scene.add(modelRoot);

  return {
    renderer,
    scene: overlayScene.scene,
    camera: overlayScene.camera,
    modelRoot,
    modelObject: loadedNormalizedObjModel.modelObject,
    axisHelper,
  };
}

/** Renders or hides the three.js model overlay for the current tracked pose. */
export function renderThreeModelOverlay(
  session: ThreeModelOverlaySession,
  threeModelCanvas: HTMLCanvasElement,
  input: ThreeModelOverlayRenderInput,
): void {
  if (!shouldDrawThreeModelOverlay(input)) {
    hideThreeModelOverlay(session);
    return;
  }

  const cameraIntrinsics = input.cameraIntrinsics;
  const cameraFromObjectPose = input.cameraFromObjectPose;

  // Guard: render path requires intrinsics and pose even though shouldDraw checked both.
  if (cameraIntrinsics === null || cameraFromObjectPose === null) {
    hideThreeModelOverlay(session);
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
  applyPoseToModelRoot(session.modelRoot, cameraFromObjectPose);
  session.modelRoot.visible = true;

  session.renderer.render(session.scene, session.camera);
}

function disposeAxesHelper(axisHelper: AxesHelper): void {
  axisHelper.geometry.dispose();

  const axisHelperMaterial = axisHelper.material;
  if (Array.isArray(axisHelperMaterial)) {
    for (const material of axisHelperMaterial) {
      material.dispose();
    }
    return;
  }

  axisHelperMaterial.dispose();
}

/** Disposes three.js GPU resources held by the overlay session. */
export function disposeThreeModelOverlay(session: ThreeModelOverlaySession): void {
  disposeAxesHelper(session.axisHelper);
  disposeObject3DResources(session.modelObject);
  session.renderer.dispose();
}
