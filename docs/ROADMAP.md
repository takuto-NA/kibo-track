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
- corner order 設定で detector 差を吸収
- core は marker 非依存のまま

**Non-goals**:
- tag detection
- rendering

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
- distortion support
- marker-aware RANSAC
- OpenCV behavioral fixtures (tolerance-based)
- benchmark baseline

**Non-goals**:
- bit-exact OpenCV reproduction
- OpenCV.js bundling
