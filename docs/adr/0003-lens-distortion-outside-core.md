# Lens distortion outside core

kibo-track core の `CameraIntrinsics` と `projectPoints` は pinhole のまま維持する。AprilCube Python parity では `dist_coeffs` 付きキャリブレーションが必要だが、distortion を core public 型に入れる判断は別途 ROADMAP で行う。

**Decision**: レンズ歪みの undistort（PnP 前）と distort（overlay 描画）は **example 層**（`examples/kibo-tag-aprilcube`）で Brown-Conrady 近似を適用する。core adapter は pinhole 入力を前提とする。

**Considered options**: core に `dist_coeffs` を追加 / OpenCV.js バインド / example 層のみ / 歪み無視。

**Consequences**: Python との静的写真 parity は example で達成できるが、ライブラリ利用者は自前 adapter で undistort する責務を負う。往復精度は `examples/kibo-tag-aprilcube/src/camera-distortion.test.ts` で固定する。
