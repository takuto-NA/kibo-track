/**
 * Cube index to glTF model assignment for the 16-cube AprilCube demo.
 */
import { buildPublicAssetPath } from "./public-asset-path.js";
import { MULTI_CUBE_CONFIG_COUNT } from "./constants.js";

export interface MultiCubeModelAssignment {
  readonly cubeIndex: number;
  readonly fileName: string;
  readonly label: string;
}

/** Ordered list of 16 glTF model assignments, one per cube index. */
export const MULTI_CUBE_MODEL_ASSIGNMENTS: readonly MultiCubeModelAssignment[] = [
  { cubeIndex: 0, fileName: "00_Chick.gltf", label: "Chick" },
  { cubeIndex: 1, fileName: "01_Dog.gltf", label: "Dog" },
  { cubeIndex: 2, fileName: "02_Horse.gltf", label: "Horse" },
  { cubeIndex: 3, fileName: "03_Pig.gltf", label: "Pig" },
  { cubeIndex: 4, fileName: "04_Wolf.gltf", label: "Wolf" },
  { cubeIndex: 5, fileName: "05_Sheep.gltf", label: "Sheep" },
  { cubeIndex: 6, fileName: "06_Character_Male_1.gltf", label: "Character_Male_1" },
  { cubeIndex: 7, fileName: "07_Character_Female_1.gltf", label: "Character_Female_1" },
  { cubeIndex: 8, fileName: "08_Skeleton.gltf", label: "Skeleton" },
  { cubeIndex: 9, fileName: "09_Goblin.gltf", label: "Goblin" },
  { cubeIndex: 10, fileName: "10_Zombie.gltf", label: "Zombie" },
  { cubeIndex: 11, fileName: "11_Tree_1.gltf", label: "Tree_1" },
  { cubeIndex: 12, fileName: "12_Mushroom.gltf", label: "Mushroom" },
  { cubeIndex: 13, fileName: "13_Chest_Closed.gltf", label: "Chest_Closed" },
  { cubeIndex: 14, fileName: "14_Crystal_Big.gltf", label: "Crystal_Big" },
  { cubeIndex: 15, fileName: "15_Sword_Diamond.gltf", label: "Sword_Diamond" },
];

/** Builds the public URL for a cube's assigned glTF model. */
export function buildMultiCubeModelUrl(
  cubeIndex: number,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const assignment = MULTI_CUBE_MODEL_ASSIGNMENTS[cubeIndex];

  if (assignment === undefined) {
    throw new RangeError(`No model assignment for cube index ${cubeIndex}.`);
  }

  return buildPublicAssetPath(
    `aprilcube-fixtures/multi-cube/models/${assignment.fileName}`,
    baseUrl,
  );
}

/** Returns the human-readable label for a cube's assigned model. */
export function readMultiCubeModelLabel(cubeIndex: number): string {
  return MULTI_CUBE_MODEL_ASSIGNMENTS[cubeIndex]?.label ?? "(no model)";
}

/** Builds the full list of 16 glTF model URLs in cube-index order. */
export function buildMultiCubeModelUrls(
  baseUrl: string = import.meta.env.BASE_URL,
): readonly string[] {
  return MULTI_CUBE_MODEL_ASSIGNMENTS.map((_, cubeIndex) =>
    buildMultiCubeModelUrl(cubeIndex, baseUrl),
  );
}

/** Guards that the assignment list covers exactly MULTI_CUBE_CONFIG_COUNT cubes with unique file names. */
export function validateMultiCubeModelAssignments(): void {
  if (MULTI_CUBE_MODEL_ASSIGNMENTS.length !== MULTI_CUBE_CONFIG_COUNT) {
    throw new RangeError(
      `Multi-cube model assignments must cover ${MULTI_CUBE_CONFIG_COUNT} cubes, found ${MULTI_CUBE_MODEL_ASSIGNMENTS.length}.`,
    );
  }

  const seenFileNames = new Set<string>();
  const seenCubeIndices = new Set<number>();

  for (const assignment of MULTI_CUBE_MODEL_ASSIGNMENTS) {
    if (seenCubeIndices.has(assignment.cubeIndex)) {
      throw new RangeError(`Duplicate cube index ${assignment.cubeIndex} in model assignments.`);
    }
    seenCubeIndices.add(assignment.cubeIndex);

    if (seenFileNames.has(assignment.fileName)) {
      throw new RangeError(`Duplicate file name ${assignment.fileName} in model assignments.`);
    }
    seenFileNames.add(assignment.fileName);
  }
}
