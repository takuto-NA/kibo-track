# Kibo-track Roadmap

## v0.1 — Geometry and projection foundation

**Goal**: OpenCV camera convention に沿った projection、pose 変換、reprojection error を検証済みで提供する。

**Exit criteria**:
- `projectPoints` が pinhole model で px 投影できる
- `cameraFromObject`、quaternion、Rodrigues、row-major matrix4 の相互変換がテストで保証される
- reprojection error が px 単位で計算できる
- CONTEXT.md / ADR / CI tests が揃っている

**Non-goals**:
- PnP / RANSAC / LM
- AprilCube adapter
- tracking
- distortion

## v0.2 — LM refinement

**Goal**: `numopt-js` を使った pixel-space LM refinement を提供する。

**Exit criteria**:
- `refinePoseLM` が initial pose を改善できる
- residual は pixel space の `[du, dv, ...]` 順
- 初期版 Jacobian は数値微分
- 返り値に `initialMeanReprojectionErrorPx`, `finalMeanReprojectionErrorPx`, `improvementRatio`, `converged`, `iterations`, `finalResidualNorm` を含む
- invalid input は `success: false`、optimizer trial の invalid projection は finite penalty residual

**Non-goals**:
- EPnP initial solver
- RANSAC

## v0.3 — Pose estimation

**Goal**: 2D–3D correspondences から `estimatePose` を提供する。

**Exit criteria**:
- EPnP initial -> LM refine の主経路（`enableRansac: false` で deterministic clean-data テスト可能）
- point-level RANSAC wrapper（seeded sampling、px threshold、adaptive iteration cap、`notEnoughInliers`）
- `EstimatePoseSuccess` に `pose`, `inlierIndices`, `outlierIndices`, `numInliers`, `inlierRatio`, `meanReprojectionErrorPx`, `confidence`, `initialMeanReprojectionErrorPx`, `finalMeanReprojectionErrorPx`, `iterations` を含む
- `success: false` の Result 型で `notEnoughPoints`, `notEnoughInliers`, `degenerateConfiguration`, `invalidInput` を返す
- heuristic measurement confidence（0..1、probability ではない）
- normalized camera coordinate helpers、geometry degeneracy checks、EPnP substep unit tests
- `scripts/demo-estimate-pose.mjs` で clean / noisy / outlier diagnostics を出力

**Non-goals**:
- marker-aware RANSAC
- distortion
- AprilCube adapter
- tracking

## v0.4 — AprilCube adapter

**Goal**: 検出済み marker から correspondences を構築し、core PnP に接続する。

**Exit criteria**:
- cube center origin の 3D corner map
- cuboid `config.json` 互換の **tag corner 3D**（`AprilCubeCuboidLayout` / `buildAprilCubeTagCornerObjectPointMap`）
- corner order 設定で detector 差を吸収
- core は marker 非依存のまま
- `buildAprilCubeCorrespondences` が marker ID / corner index メタデータ付きで 2D–3D correspondences を返す
- 隣接 face の shared cube corner は dedupe して PnP に渡す
- `estimateAprilCubePose` が multi-face 非共面 fixture で pose を復元する
- single-face planar pose は `degenerateConfiguration` を明示的に返す
- `scripts/demo-aprilcube.mjs` で clean / noisy / outlier / unsupported diagnostics を出力

**Non-goals**:
- tag detection
- rendering
- single-face planar PnP

## v0.5 — Pose tracking

**Goal**: `PoseMeasurement` から temporal `TrackingState` を更新する。

**Exit criteria**:
- translation: constant-velocity Kalman
- rotation: quaternion slerp + angular velocity prediction
- `tracking / coasting / lost`
- caller-provided `timestampSeconds`

**Non-goals**:
- quaternion error-state Kalman

## v0.6 — Compatibility and performance

**Goal**: 実運用向けの互換性と性能改善。

**Exit criteria**:
- distortion support in core public API (example layer parity: ADR 0003 until then)
- marker-aware RANSAC
- OpenCV behavioral fixtures (tolerance-based)
- benchmark baseline

**Non-goals**:
- bit-exact OpenCV reproduction
- OpenCV.js bundling

## v0.7 — Anchored multi-object scene tracking

**Goal**: 複数の AprilCube / tag rig を明示的な ID グループで扱い、OptiTrack の L 字 origin marker のような固定 origin fixture から world 座標系を復元して tracked object pose を推定する。

**Exit criteria**:
- `anchor` rig と `tracked` rig を区別する scene-level public type
- origin fixture で 0 位置 / world axis を定義する calibration flow
- rig ごとに marker ID set、AprilCube config、任意の `worldFromObject` を定義できる
- 検出済み marker を rig ごとに deterministic に partition する
- visible anchor から `worldFromCamera` を推定する
- visible tracked rig から `cameraFromObject` と `worldFromObject` を返す
- anchor が見えない frame では `worldFromCamera` の鮮度 / coasting 状態を明示する
- 複数 anchor が見える場合の pose selection / fusion policy を ADR で固定する
- single-face planar anchor の弱さと multi-face / non-coplanar anchor 推奨を docs に明記する

**Non-goals**:
- marker ID だけから未知の物体クラスタを自動発見する
- SLAM / bundle adjustment / map optimization
- camera calibration UI
- detector integration
