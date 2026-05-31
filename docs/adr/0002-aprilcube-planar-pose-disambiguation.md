# AprilCube planar pose disambiguation

AprilCube adapter は共面 tag 検出で planar PnP を使う。homography 分解では mirror 解（表/裏）が同等の再投影誤差で残りうる。`finalMeanReprojectionErrorPx` が小さいだけでは wireframe が正しいとは限らない。

**Decision**: `cuboidLayout` があるとき、planar 候補は **PoseFacingCamera**（面法線 chirality）で裏向き pose を除外する。multi-marker EPnP が閾値超過または outlier marker があるときは **single-marker planar fallback** と **one-pass outlier re-solve** を試す。

**Considered options**: `previousPose` のみ / reprojection 最小のみ / OpenCV IPPE バインド / px-only 成功判定。

**Consequences**: 低 px でも棄却する経路が増えるが、mirror 解による「数値は良いが wireframe が反対側」を防げる。回帰は `tests/aprilcube/pose-facing-camera.test.ts` と `tests/aprilcube/static-image-detected-corners.regression.test.ts` で public API 経由に固定する。目視 overlay は CI 外（`examples/data/` は gitignore）。
