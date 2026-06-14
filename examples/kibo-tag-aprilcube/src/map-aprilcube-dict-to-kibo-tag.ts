/**
 * Maps AprilCube config.json dictionary names to kibo-tag ArUco family names.
 */

const APRILCUBE_DICTIONARY_TO_KIBO_TAG_FAMILY: Readonly<Record<string, string>> = {
  "4x4_50": "DICT_4X4_50",
  "4x4_100": "DICT_4X4_100",
  "4x4_250": "DICT_4X4_250",
  "4x4_1000": "DICT_4X4_1000",
  "5x5_50": "DICT_5X5_50",
  "5x5_100": "DICT_5X5_100",
  "5x5_250": "DICT_5X5_250",
  "5x5_1000": "DICT_5X5_1000",
};

export interface AprilCubeDictionaryMappingSuccess {
  readonly success: true;
  readonly kiboTagFamilyName: string;
}

export interface AprilCubeDictionaryMappingFailure {
  readonly success: false;
  readonly detail: string;
}

export type AprilCubeDictionaryMappingResult =
  | AprilCubeDictionaryMappingSuccess
  | AprilCubeDictionaryMappingFailure;

/** Maps an AprilCube dict field value to a kibo-tag family name. */
export function mapAprilCubeDictionaryToKiboTagFamily(
  aprilCubeDictionaryName: string,
): AprilCubeDictionaryMappingResult {
  const kiboTagFamilyName = APRILCUBE_DICTIONARY_TO_KIBO_TAG_FAMILY[aprilCubeDictionaryName];

  if (kiboTagFamilyName === undefined) {
    return {
      success: false,
      detail: `Unsupported AprilCube dictionary: ${aprilCubeDictionaryName}`,
    };
  }

  return {
    success: true,
    kiboTagFamilyName,
  };
}
