/**
 * Loads and normalizes OBJ overlay models from examples/data for three.js rendering.
 */
import {
  Box3,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { DEFAULT_THREE_OVERLAY_OBJ_URL } from "./three-model-asset-paths.js";
import {
  computeNormalizedModelScaleForCubeSize,
  MODEL_VERTEX_UNIT_TO_METERS,
  type BoundingBoxSize,
} from "./three-model-normalization.js";

/** Fallback mesh color for OBJ models without MTL assets. */
const THREE_OVERLAY_OBJ_FALLBACK_COLOR = 0xffffff;

/** Fallback material when OBJ files omit MTL assets. */
const THREE_OVERLAY_OBJ_FALLBACK_MATERIAL = new MeshStandardMaterial({
  color: THREE_OVERLAY_OBJ_FALLBACK_COLOR,
  metalness: 0.04,
  roughness: 0.72,
});

export interface LoadedNormalizedObjModel {
  readonly modelObject: Object3D;
  readonly uniformScale: number;
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

function applyFallbackMaterialToMeshes(object3D: Object3D): void {
  object3D.traverse((childObject) => {
    if (!(childObject instanceof Mesh)) {
      return;
    }

    childObject.material = THREE_OVERLAY_OBJ_FALLBACK_MATERIAL;
  });
}

/** Enables cast/receive shadow on all meshes in the loaded OBJ model. */
export function enableShadowCastingOnModelMeshes(object3D: Object3D): void {
  object3D.traverse((childObject) => {
    if (!(childObject instanceof Mesh)) {
      return;
    }

    childObject.castShadow = true;
    childObject.receiveShadow = true;
  });
}

/** Loads an OBJ model, converts mm vertices to meters, centers it, and scales to the AprilCube size. */
export async function loadNormalizedObjOverlayModel(
  cubeSizeMeters: number,
  objUrl: string = DEFAULT_THREE_OVERLAY_OBJ_URL,
): Promise<LoadedNormalizedObjModel> {
  const objectLoader = new OBJLoader();
  const loadedObject = await objectLoader.loadAsync(objUrl);
  const modelRoot = loadedObject instanceof Group ? loadedObject : new Group().add(loadedObject);

  modelRoot.scale.setScalar(MODEL_VERTEX_UNIT_TO_METERS);
  modelRoot.updateMatrixWorld(true);
  centerObjectAtOrigin(modelRoot);

  const boundingBoxSizeMeters = computeObjectBoundingBoxSize(modelRoot);
  const normalizedModelScale = computeNormalizedModelScaleForCubeSize(
    boundingBoxSizeMeters,
    cubeSizeMeters,
  );

  modelRoot.scale.multiplyScalar(normalizedModelScale.uniformScale);
  modelRoot.updateMatrixWorld(true);
  applyFallbackMaterialToMeshes(modelRoot);

  return {
    modelObject: modelRoot,
    uniformScale: normalizedModelScale.uniformScale,
  };
}

/** Disposes mesh geometries and materials under an object tree. */
export function disposeObject3DResources(object3D: Object3D): void {
  object3D.traverse((childObject) => {
    if (!(childObject instanceof Mesh)) {
      return;
    }

    childObject.geometry.dispose();

    const meshMaterial = childObject.material;
    if (Array.isArray(meshMaterial)) {
      for (const material of meshMaterial) {
        material.dispose();
      }
      return;
    }

    if (meshMaterial !== THREE_OVERLAY_OBJ_FALLBACK_MATERIAL) {
      meshMaterial.dispose();
    }
  });
}

/** Disposes a standalone buffer geometry when tests create temporary meshes. */
export function disposeBufferGeometry(geometry: BufferGeometry): void {
  geometry.dispose();
}
