# Pose estimation core conventions

Kibo-track は marker 検出器ではなく、検出後の 2D–3D pose estimation core として設計する。public contract は OpenCV camera convention の `cameraFromObject` に固定し、AprilCube / Three.js / tracking は core の外側に置く。

内部標準は `X_camera = R * X_object + t`、image frame は左上原点で +u 右・+v 下、camera frame は +X 右・+Y 下・+Z 前方とする。public `Pose` の回転は quaternion `[x, y, z, w]` を標準とし、core API の matrix 配列は row-major だが数学的には column vector に左から掛ける。Three.js / WebGL の column-major 事情は adapter で吸収する。

**Considered options**: AprilCube-first API、tracking-first API、public API で `Matrix` 型を露出する案。

**Consequences**: core は detector 非依存のまま保てるが、Three.js 利用者は adapter 経由が必須になる。`rvec/tvec` は OpenCV 互換 helper として別途提供する。
