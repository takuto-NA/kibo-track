# AprilCube Parity Matrix

Comparison between [AprilCube Python](https://github.com/younghyopark/aprilcube) reference behavior and kibo-track v0.4+ adapter.

| Capability | AprilCube Python | kibo-track | Status |
| --- | --- | --- | --- |
| Tag corner 3D (`build_tag_corner_map`, column swap) | Yes | Yes (`tag-corners.ts`) | **Matched** |
| Calibrated camera intrinsics | Yes (`camera_matrix`, `dist_coeffs`) | Example JSON paste + localStorage | **Matched** |
| kibo-tag corner order | N/A (detector-specific) | `reversedCanonical` default in example | **Matched** (detector-specific) |
| Multi-face EPnP / RANSAC | Yes (`solvePnPRansac` ≥6 pts) | Yes (`estimatePose`) | **Matched** |
| Single-face planar PnP | Yes (`solvePnP` 4 pts, SQPNP cold start) | Homography + LM + PoseFacingCamera gate | **Matched** |
| Previous pose prior | Yes (`SOLVEPNP_ITERATIVE` with guess) | `previousPose` option + tracker | **Matched** |
| Planar ambiguity diagnostics | Implicit (prior required for coplanar) | `poseMode`, `planarCandidateCount`, `planarAmbiguityScore` | **Matched** |
| Per-tag outlier re-solve | Yes (~3 px threshold) | One-pass bad-marker re-solve in adapter | **Matched** |
| Temporal filter / Kalman | Yes | Lightweight exponential smoothing tracker | **Partial** (no Kalman yet) |
| Lens distortion | Yes | Example undistort/distort; core pinhole (ADR 0003) | **Matched** (example layer) |
| Python parity fixtures | N/A | Golden JSON + tolerance tests | **Matched** |
| Optical-flow corner tracking | Yes | No | **Omitted** (non-goal) |
| Official cuboid `config.json` loader (`load_cube_config` cuboid path) | Yes | Yes (`parseAprilCubeCuboidConfigJson`) | **Matched** |
| Schema v2 explicit `markers[].corners_mm` | Yes | Reject with `unsupportedSchema` | **Omitted** (ADR 0005) |

## Regression tests

| User-visible defect | Test file |
| --- | --- |
| Markers align but wireframe perspective wrong (placeholder K) | `tests/aprilcube/intrinsics-mismatch.regression.test.ts` |
| Single-face planar without prior picks wrong mirror solution | `tests/aprilcube/pose-facing-camera.test.ts` |
| Static photo corners wrong with canonical order | `tests/aprilcube/static-image-detected-corners.regression.test.ts` |
| One marker rejected (`degenerateConfiguration`) | `tests/aprilcube/single-face-planar.regression.test.ts` |
| Tag geometry vs face-corner mismatch | `tests/aprilcube/geometry-mismatch.regression.test.ts` |
| Three-marker outlier re-solve | `tests/aprilcube/static-image-detected-corners.regression.test.ts` |
| Stick cuboid official JSON end-to-end | `tests/aprilcube/stick-cuboid-config.integration.test.ts` |
| Distortion roundtrip in example layer | `examples/kibo-tag-aprilcube/src/camera-distortion.test.ts` |

## Verification checklist

### CI (automated)

- [ ] `npm test` at repo root — includes pose-facing, static corner golden, intrinsics wireframe regressions
- [ ] `npm test` in `examples/kibo-tag-aprilcube` — includes distortion roundtrip
- [ ] Reprojection error alone is **not** the only assertion in static photo regressions (depth sign, PoseFacingCamera, corner-order A/B)

### Local (manual / optional)

- [ ] Place AprilCube photos under `examples/data/` (gitignored)
- [ ] Run `npm run test:browser` in `examples/kibo-tag-aprilcube` — Playwright static overlay (`e2e/static-aprilcube-image.spec.ts`)
- [ ] Open `static-image-verify.html?calibration=...&image=...` and **visually** confirm wireframe alignment
- [ ] Use calibrated JSON with `dist_coeffs` when comparing to Python

## Intentional differences

- **Distortion in core**: Core projection remains pinhole-only (see ADR 0003). Example applies undistort/distort.
- **Solver stack**: TypeScript EPnP + homography planar instead of OpenCV SQPNP/IPPE bindings (see ADR 0002 for disambiguation).
- **Tracking**: Exponential smoothing instead of Kalman + optical flow in the first iteration.

## Fixture maintenance

- Static photo **corner coordinates** live in `tests/fixtures/static-aprilcube-photo-corners.ts` (photos stay local).
- Refresh Python parity JSON via `scripts/refresh-aprilcube-parity-fixtures.mjs` when reference outputs change.

## Rollback notes

- If calibrated intrinsics do not reduce synthetic wireframe error, re-check tag corner ordering and projection conventions before planar pose work.
- If homography decomposition is unstable on synthetic tests, single-face pose must not ship without an ADR (IPPE port vs OpenCV/WASM vs defer).
- If `finalMeanReprojectionErrorPx` is low but overlay is wrong, check PoseFacingCamera gate and corner order before tuning solvers (ADR 0002).
