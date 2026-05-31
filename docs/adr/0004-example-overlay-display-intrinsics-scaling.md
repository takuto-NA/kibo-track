# Example overlay display and intrinsics scaling

640×480 などキャプチャ解像度のアスペクト比を変更すると、AprilCube デモの映像・ワイヤーフレームがフィットせずフレームが歪む不具合があった。デバッグセッション `9c17c6` で **表示層（CSS）** と **幾何層（intrinsics スケーリング）** の独立した 2 根本原因を特定し、修正後に回帰テストで固定する。

## Decision A — Display: viewport aspect must match capture

**Decision**: `#viewport` の CSS `aspect-ratio` はキャプチャ解像度と同期する（`syncViewportCaptureAspectRatio`）。canvas は `object-fit: contain` で表示し、固定 16:9 箱への非一様伸縮を避ける。

**Evidence (pre-fix → post-fix @ 640×480, viewport width ~958px)**:
- cssScaleFactorX / cssScaleFactorY: 1.497 / 1.121 → 1.497 / 1.496
- viewport CSS height: 538px → 718px

**Considered options**: overlay のみ座標補正 / CSS 固定 16:9 のまま JS で scale 補正 / viewport aspect を capture に合わせる。

**Consequences**: 解像度変更時に viewport 高さが変わる UI 挙動は許容。E2E ブラウザテストは CI 外（手動確認）。

## Decision B — Geometry: square pixels when reference aspect ≠ capture aspect

**Decision**: キャリブレーション reference（1280×720）と capture の aspect が不一致のとき、intrinsics は **resize-only の独立 scaleX/scaleY を使わず** `fx = fy = f × scaleX`（square pixels）でスケールする。同一 aspect のリサイズでは従来どおり scaleY も適用する。

**Evidence (pre-fix → post-fix @ 640×480 from 1280×720 ref)**:
- focalLengthX / focalLengthY: 450 / 600 → 450 / 450

**Considered options**: capture 解像度で再キャリブのみ / pose 経路の修正 / intrinsics スケール式の修正。

**Consequences**: placeholder intrinsics の絶対精度は別 issue。4:3 capture + 16:9 calibration の物理限界は残る — **capture 解像度での再キャリブが理想**。

## Decision C — Preventive: overlay canvas sync and explicit drawImage

**Decision**: 毎フレーム `synchronizeOverlayCanvasSize(capture, overlay)` を呼び、overlay canvas の backing store を capture と一致させる。`drawImage` は destination 幅・高さを明示指定する。

**Consequences**: 主因ではなかったが、desync による subtle ズレを防ぐ契約としてテスト固定。

## Rejected hypotheses (session `9c17c6`)

- 解像度ネゴシエーション不一致（requested = actual）
- pose 経路のみが primary（reproj 0.17–1.9px；主因は A+B）

## Residual (out of scope)

- PoseTracker 平滑化（α=0.35）による 1 フレーム遅れ
- 完全一致ではなく「だいぶフィット」レベルの残差

## Regression tests

| ID | File | What it guards |
|----|------|----------------|
| T1 | `examples/kibo-tag-aprilcube/src/resolution-gate.test.ts` | legacy fy=600 再現 + production は fx=fy=450 |
| T2 | `examples/kibo-tag-aprilcube/src/viewport-layout.test.ts` | 16:9 viewport + 4:3 canvas → 非一様 scale；matched aspect → 一様 |
| T3 | `examples/kibo-tag-aprilcube/src/overlay-projection-regression.test.ts` | 同一 pose で legacy vs fixed intrinsics の corner 距離 |
| T4 | `examples/kibo-tag-aprilcube/src/overlay.test.ts` | drawImage 全サイズ + canvas 同期 |

Legacy bug 再現は `examples/kibo-tag-aprilcube/src/test-helpers/overlay-regression-fixtures.ts` の純関数で行い、git revert なしに T1/T3 が FAIL することを確認できる。
