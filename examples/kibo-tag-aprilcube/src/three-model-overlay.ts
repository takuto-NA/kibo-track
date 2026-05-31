/**
 * three.js WebGL model overlay: Utah teapot synced to tracked AprilCube pose.
 */
import {
  AmbientLight,
  AxesHelper,
  Color,
  DirectionalLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry.js";
import type { CameraIntrinsics, Pose } from "kibo-track";
import { shouldRenderThreeModelForPose } from "./overlay-display-mode.js";
import { synchronizeOverlayCanvasSize } from "./resolution-gate.js";
import {
  buildOpenCvStyleProjectionMatrixColumnMajor,
  buildThreeJsObjectMatrixFromPose,
  convertRowMajorMatrix4ToColumnMajor,
  THREE_OVERLAY_FAR_CLIP_PLANE,
  THREE_OVERLAY_NEAR_CLIP_PLANE,
} from "./three-pose-projection.js";
import type { OverlayDisplayMode } from "./types.js";

/** Teapot max reference dimension (Y/Z body height-depth) relative to AprilCube edge length. */
export const TEAPOT_MODEL_TO_CUBE_SIZE_RATIO = 2;

/** Utah teapot tessellation segments for the built-in geometry. */
const TEAPOT_GEOMETRY_TESSELLATION_SEGMENTS = 6;

/** Teapot geometry size parameter before bounding-box normalization. */
const TEAPOT_GEOMETRY_BASE_SIZE = 1;

/** Axis helper length in meters for orientation debugging. */
const THREE_OVERLAY_AXIS_HELPER_LENGTH_METERS = 0.02;

/** Ambient light intensity for the teapot material. */
const THREE_OVERLAY_AMBIENT_LIGHT_INTENSITY = 0.55;

/** Directional light intensity for the teapot material. */
const THREE_OVERLAY_DIRECTIONAL_LIGHT_INTENSITY = 0.85;

/** Base color for the built-in Utah teapot mesh. */
const THREE_OVERLAY_TEAPOT_BASE_COLOR = 0x66a3ff;

export interface ThreeModelOverlaySession {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly modelRoot: Object3D;
  readonly modelMesh: Mesh;
  readonly axisHelper: AxesHelper;
}

export interface ThreeModelOverlayRenderInput {
  readonly overlayDisplayMode: OverlayDisplayMode;
  readonly cameraFromObjectPose: Pose | null;
  readonly cameraIntrinsics: CameraIntrinsics | null;
  readonly captureCanvas: HTMLCanvasElement;
  readonly cubeSizeMeters: number;
}

export interface BoundingBoxSize {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
}

export interface NormalizedTeapotGeometryResult {
  readonly geometry: TeapotGeometry;
  readonly uniformScale: number;
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

/** Computes teapot normalization reference size (body height/depth, not spout-handle X span). */
export function computeTeapotNormalizationReferenceDimension(
  boundingBoxSize: BoundingBoxSize,
): number {
  return Math.max(boundingBoxSize.sizeY, boundingBoxSize.sizeZ);
}

/** Creates a centered teapot geometry and the uniform scale for the AprilCube target size. */
export function createNormalizedTeapotGeometry(
  cubeSizeMeters: number,
): NormalizedTeapotGeometryResult {
  const teapotGeometry = new TeapotGeometry(
    TEAPOT_GEOMETRY_BASE_SIZE,
    TEAPOT_GEOMETRY_TESSELLATION_SEGMENTS,
  );
  teapotGeometry.computeBoundingBox();

  const boundingBox = teapotGeometry.boundingBox;

  // Guard: teapot geometry must expose a bounding box for normalization.
  if (boundingBox === null) {
    teapotGeometry.dispose();
    throw new RangeError("Teapot geometry bounding box is unavailable.");
  }

  const boundingBoxCenterX = (boundingBox.max.x + boundingBox.min.x) / 2;
  const boundingBoxCenterY = (boundingBox.max.y + boundingBox.min.y) / 2;
  const boundingBoxCenterZ = (boundingBox.max.z + boundingBox.min.z) / 2;
  teapotGeometry.translate(
    -boundingBoxCenterX,
    -boundingBoxCenterY,
    -boundingBoxCenterZ,
  );
  teapotGeometry.computeBoundingBox();

  const centeredBoundingBox = teapotGeometry.boundingBox;

  // Guard: centered teapot geometry must expose a bounding box for normalization.
  if (centeredBoundingBox === null) {
    teapotGeometry.dispose();
    throw new RangeError("Centered teapot geometry bounding box is unavailable.");
  }

  const boundingBoxSize: BoundingBoxSize = {
    sizeX: centeredBoundingBox.max.x - centeredBoundingBox.min.x,
    sizeY: centeredBoundingBox.max.y - centeredBoundingBox.min.y,
    sizeZ: centeredBoundingBox.max.z - centeredBoundingBox.min.z,
  };
  const targetReferenceDimension = cubeSizeMeters * TEAPOT_MODEL_TO_CUBE_SIZE_RATIO;
  const uniformScale = computeUniformScaleForTargetMaxDimension(
    computeTeapotNormalizationReferenceDimension(boundingBoxSize),
    targetReferenceDimension,
  );

  return {
    geometry: teapotGeometry,
    uniformScale,
  };
}

/** Computes teapot uniform scale so its max dimension matches the AprilCube target size. */
export function computeTeapotUniformScaleForCubeSize(cubeSizeMeters: number): number {
  const normalizedTeapotGeometry = createNormalizedTeapotGeometry(cubeSizeMeters);
  const uniformScale = normalizedTeapotGeometry.uniformScale;
  normalizedTeapotGeometry.geometry.dispose();
  return uniformScale;
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
}

function hideThreeModelOverlay(session: ThreeModelOverlaySession): void {
  session.modelRoot.visible = false;
  session.renderer.clear();
}

/** Creates the three.js overlay session with a built-in Utah teapot model. */
export function createThreeModelOverlay(
  threeModelCanvas: HTMLCanvasElement,
  cubeSizeMeters: number,
): ThreeModelOverlaySession {
  const renderer = new WebGLRenderer({
    canvas: threeModelCanvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
  });
  renderer.setClearColor(new Color(0x000000), 0);
  renderer.autoClear = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  camera.matrixWorldAutoUpdate = false;
  camera.matrix.identity();
  camera.matrixWorld.identity();

  const ambientLight = new AmbientLight(0xffffff, THREE_OVERLAY_AMBIENT_LIGHT_INTENSITY);
  const directionalLight = new DirectionalLight(0xffffff, THREE_OVERLAY_DIRECTIONAL_LIGHT_INTENSITY);
  directionalLight.position.set(0.2, 0.4, 0.6);
  scene.add(ambientLight);
  scene.add(directionalLight);

  const normalizedTeapotGeometry = createNormalizedTeapotGeometry(cubeSizeMeters);
  const modelRoot = new Object3D();
  modelRoot.matrixAutoUpdate = false;

  const modelMesh = new Mesh(
    normalizedTeapotGeometry.geometry,
    new MeshStandardMaterial({
      color: THREE_OVERLAY_TEAPOT_BASE_COLOR,
      metalness: 0.35,
      roughness: 0.45,
    }),
  );
  modelMesh.scale.setScalar(normalizedTeapotGeometry.uniformScale);
  modelRoot.add(modelMesh);

  const axisHelper = new AxesHelper(THREE_OVERLAY_AXIS_HELPER_LENGTH_METERS);
  modelRoot.add(axisHelper);

  scene.add(modelRoot);

  return {
    renderer,
    scene,
    camera,
    modelRoot,
    modelMesh,
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

/** Disposes three.js GPU resources held by the overlay session. */
export function disposeThreeModelOverlay(session: ThreeModelOverlaySession): void {
  session.modelMesh.geometry.dispose();

  const modelMaterial = session.modelMesh.material;
  if (Array.isArray(modelMaterial)) {
    for (const material of modelMaterial) {
      material.dispose();
    }
  } else {
    modelMaterial.dispose();
  }

  session.renderer.dispose();
}
