# AprilCube cuboid config.json loader

AprilCube adapter accepts official cuboid `config.json` files produced by [AprilCube generate.py](https://github.com/younghyopark/aprilcube) through `parseAprilCubeCuboidConfigJson`.

**Decision**: Parse cuboid JSON in the library; reject schema v2 explicit geometry (`markers[].corners_mm`) with `unsupportedSchema`. When `cuboidLayout` is present, allow multiple marker IDs to map to the same `AprilCubeFaceName` for PoseFacingCamera. Set `cubeSize` to `max(box_dims)` as a legacy reference dimension; PnP geometry uses `cuboidLayout.boxDimensionsMeters`.

**Considered options**: Example-only parser / keep duplicate-face validation / use `box_dims[0]` for `cubeSize`.

**Consequences**: stick and multi-tag-per-face cuboids become valid without changing tag corner math. v2 voxel targets remain out of scope until a dedicated explicit-geometry loader exists. Example app reads dict, tag IDs, and box dimensions from loaded config.
