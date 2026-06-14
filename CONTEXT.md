# Kibo-track

Kibo-track は、検出済み 2D 点と既知 3D 点から cameraFromObject pose を推定・追跡するためのブラウザ向けライブラリである。ArUco / AprilTag 検出やカメラキャリブレーション UI は含まない。

## Language

**Kibo-track**:
検出後の 2D–3D 姿勢推定・追跡ライブラリ。marker 検出器そのものではない。
_Avoid_: OpenCV.js 代替, detector, tracker-only library

**ImagePoint2D**:
画像上の 2D 点。pixel 座標 `[u, v]`。左上原点、+u 右、+v 下。core に渡す時点では PnP / 再投影に使う座標系の点。検出器 raw 出力との変換（corner 並べ替え・レンズ補正）は adapter / example 責務。
_Avoid_: normalized point（明示しない限り）

**CornerOrder**:
検出器が返す 4 corner を OpenCV / AprilCube canonical `[TL, TR, BR, BL]` に合わせる adapter 側の並べ替え。検出器ごとに異なりうる。
_Avoid_: detector corner order（検出器固有の別名として混同）

**PlanarPoseAmbiguity**:
共面 4 点から pose を求めると、再投影誤差が同等の複数解（表/裏）が出うる状態。
_Avoid_: mirror pose（文脈なしでは曖昧）

**PoseFacingCamera**:
cuboid の可視面法線がカメラを向いているかの幾何制約。低 reprojection でも裏解を弾くために使う。
_Avoid_: chirality（数学用語のみで説明しない）

**DetectedMarkerCorners**:
検出器が返す `{ id, corners }`。corner 順序は検出器 native。AprilCube adapter に渡す前に CornerOrder で正規化しうる。
_Avoid_: ImagePoint2D[]（ID と corner の対応が失われる）

**ObjectPoint3D**:
物体座標系上の 3D 点 `[x, y, z]`。core は単位を解釈しない。
_Avoid_: world point, marker point (unless adapter-specific)

**CameraIntrinsics**:
pinhole camera の内部パラメータ。focal length と principal point を px 単位で持つ。
_Avoid_: distortion coefficients (v0.1 では非対象)

**cameraFromObject**:
物体座標からカメラ座標へ変換する pose の向き。`X_camera = R * X_object + t`。
_Avoid_: objectFromCamera, worldFromCamera, camera pose (without direction)

**Pose**:
`cameraFromObject` を表す回転と並進。回転は quaternion `[x, y, z, w]`、並進は object points と同じ単位。
_Avoid_: transform, matrix pose (as canonical public type)

**PoseMeasurement**:
単一フレームの pose 推定結果。pose、再投影誤差、inliers、confidence などの品質指標を含む。
_Avoid_: TrackingState, raw detector output

**TrackingState**:
時系列 tracking の現在状態。`tracking / coasting / lost` と平滑化済み pose を持つ。
_Avoid_: PoseMeasurement, detector state

**confidence**:
単一フレーム measurement の品質スコア。0..1 の heuristic。統計的確率ではない。
_Avoid_: probability, tracking confidence (unless explicitly scoped)

**AprilCube adapter**:
AprilCube config と検出済み marker corners から 2D–3D correspondences を作る adapter。公式 cuboid `config.json` は `parseAprilCubeCuboidConfigJson` で読める。core は marker 非依存。
_Avoid_: AprilCube detector, core module

## Example dialogue

**Developer**: 検出器が marker ID と 4 corner の pixel 座標を返しました。Kibo-track に何を渡しますか？

**Domain expert**: まず AprilCube adapter に `{ id, corners }` を渡して correspondences を作ります。core には `ImagePoint2D[]`、`ObjectPoint3D[]`、`CameraIntrinsics` を渡します。

**Developer**: 返ってくる pose は Three.js 用ですか？

**Domain expert**: いいえ。core は `cameraFromObject` の `Pose` を返します。Three.js 変換は adapter の責務です。

**Developer**: confidence が 0.8 なら 80% の確率ですか？

**Domain expert**: いいえ。inlier ratio や reprojection error から作る measurement quality の heuristic です。
