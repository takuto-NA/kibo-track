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
- residual は pixel space
- 初期版 Jacobian は数値微分

**Non-goals**:
- EPnP initial solver
- RANSAC

## v0.3 — Pose estimation

**Goal**: 2D–3D correspondences から `estimatePose` を提供する。

**Exit criteria**:
- EPnP initial -> LM refine の主経路
- point-level RANSAC wrapper
- `success: false` の Result 型で推定失敗を返す
- heuristic measurement confidence

**Non-goals**:
- marker-aware RANSAC
- distortion

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
