# kibo-tag AprilCube Example

Browser example that connects [kibo-tag](https://github.com/takuto-NA/kibo-tag) WASM detections to `kibo-track` `estimateAprilCubePose` and draws a live overlay.

This example lives outside the `kibo-track` npm package. The core library remains detector-agnostic.

## Prerequisites

- Node.js 20+
- A local [kibo-tag](https://github.com/takuto-NA/kibo-tag) build for real marker detection
- A printed AprilCube using the example layout JSON (`DICT_4X4_100`, marker IDs `0..5`)
- Camera access from `localhost` or HTTPS

## Setup

From the repository root:

```bash
npm install
npm run build
```

From this example directory:

```bash
cd examples/kibo-tag-aprilcube
npm install
```

Copy kibo-tag browser artifacts into the example vendor folder if they are not already present:

```bash
cp /path/to/kibo-tag/html/apriltag.js public/vendor/kibo-tag/
cp /path/to/kibo-tag/html/apriltag_wasm.js public/vendor/kibo-tag/
```

Comlink is vendored locally at `public/vendor/comlink/comlink.js` for the worker script. Verify all runtime artifacts with:

```bash
npm run verify:runtime-artifacts
```

The worker script uses `importScripts` and must be loaded with `new Worker(...)`, not as a page `<script>`.

Build kibo-tag with Docker if needed:

```bash
git clone --recurse-submodules https://github.com/takuto-NA/kibo-tag.git
cd kibo-tag
docker build -t kibo-tag-dev .
docker run --rm -v "${PWD}:/workspace" -w /workspace kibo-tag-dev make apriltag_wasm.js
```

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

1. Click **Start Camera**
2. Confirm diagnostics show `cameraReady` and `resolutionReady`
3. Click **Start Detector**
4. Point the camera at the AprilCube with at least two non-coplanar faces visible

## Share on phone (HTTPS)

Mobile browsers require **HTTPS** for camera access when you are not on `localhost`. LAN HTTP (`http://192.168.x.x:5173`) fails with `insecureContext`.

1. Start the LAN HTTPS server:

   ```bash
   npm run dev:lan
   ```

2. On the PC, open the **Network** URL Vite prints (for example `https://192.168.1.10:5173`).

3. On your phone (same Wi‑Fi), open the same `https://192.168.x.x:5173` URL.

4. Accept the self-signed certificate warning on first visit.

5. Allow camera permission when prompted, then use **Start Camera** / **Start Detector** as usual.

   On iPhone, choose **Back (environment)** in the **Camera** dropdown (default). If the preview still shows the selfie camera, check Diagnostics for `actualCameraFacingMode`. The app retries several constraint patterns for iOS Safari; a hard refresh before **Start Camera** can help if an old page is cached.

Built preview over HTTPS (after `npm run build`):

```bash
npm run preview:lan
```

Self-signed HTTPS triggers a browser warning on first visit; that is expected.

## Public demo (GitHub Pages)

The live camera demo is published to GitHub Pages over trusted HTTPS:

`https://takuto-NA.github.io/kibo-track/`

Requirements for visitors:

- A phone or PC browser with camera permission
- A printed AprilCube using this example layout (`DICT_4X4_100`, marker IDs `0..5`)

Usage:

1. Open the public URL above
2. Click **Start Camera** and allow camera access
3. Click **Start Detector**
4. Point the camera at the AprilCube with at least two non-coplanar faces visible

Deployment:

- Pushes to `feature/githubpages` or `main` run [`.github/workflows/deploy-demo.yml`](../../.github/workflows/deploy-demo.yml)
- The workflow verifies runtime artifacts, builds the Pages demo, runs a Pages-like browser smoke test, and deploys `examples/kibo-tag-aprilcube/dist`
- After merge, `main` pushes continue to update the same public URL automatically

Local Pages preview:

```bash
npm run build:pages
npm run preview:pages
```

Open `http://127.0.0.1:4173/kibo-track/`.

## AprilCube layout

The example uses this layout (matching [AprilCube](https://github.com/younghyopark/aprilcube) `config.json`):

- marker `0`: `+X` -> `right`
- marker `1`: `-X` -> `left`
- marker `2`: `+Y` -> `bottom`
- marker `3`: `-Y` -> `top`
- marker `4`: `+Z` -> `front`
- marker `5`: `-Z` -> `back`
- cube size: `32 mm` -> `0.032 m`
- tag size: `24 mm` (inset from face edges by border cells)

Pose estimation uses **tag corner 3D** (`cuboidLayout` on `AprilCubeConfig`), not full face outer corners. This matches AprilCube detector geometry and kibo-tag tag detections.

## Corner order

Tag 3D corners follow OpenCV / AprilCube `[TL, TR, BR, BL]` after adapter permutation.

**kibo-tag WASM returns corners in reverse order.** The example defaults to **`reversedCanonical`** in the UI, live app, and static verifier. Use **canonical** only when integrating a detector that already matches OpenCV order.

Regression: `tests/aprilcube/static-image-detected-corners.regression.test.ts` (canonical vs reversedCanonical A/B on static photo corners).

## Static image verification

Photos under `examples/data/` are local-only (gitignored). Corner fixtures used in CI live in `tests/fixtures/static-aprilcube-photo-corners.ts`.

1. Copy AprilCube photos into `examples/data/`
2. Run the dev server: `npm run dev`
3. Open static verifier, for example:

   `http://localhost:5173/static-image-verify.html?image=/examples/data/YOUR_PHOTO.jpg&calibration=/examples/data/verification-output/opencv-calibrated-from-examples-data.json`

4. Confirm overlay PNG **visually** — low reprojection error alone is not sufficient (see ADR 0002)

Optional Playwright gate (requires local photos):

```bash
npm run test:browser -- e2e/static-aprilcube-image.spec.ts
```

## Gates

Unit tests:

```bash
npm test
```

Fake-camera browser smoke test (opens the page only; camera starts when you click **Start Camera** in the test):

```bash
npx playwright install chromium
npm run test:browser
```

`npm run test:browser` sets `RUN_BROWSER_TESTS=1`. A plain `playwright test` without that variable runs no browser projects, so the camera is not touched accidentally.

Optional **Probe frame rates** button on the demo page opens a brief camera session before **Start Camera** if you want to filter the FPS list first. Page load and resolution changes no longer probe the camera automatically.

Optional local real-camera gate:

```bash
set RUN_REAL_CAMERA=1
npm run test:camera:real
```

On PowerShell:

```powershell
$env:RUN_REAL_CAMERA=1
npm run test:camera:real
```

This opens a headed browser, uses your physical camera, and checks `cameraReady` / `resolutionReady`.

## Diagnostics

The page reports:

- camera startup state and failure reason
- video / capture / overlay resolution
- grayscale buffer length
- intrinsics reference resolution and scaled intrinsics
- pose success / failure, reprojection error, confidence

Browser tests also collect:

- `console.error`
- uncaught page errors
- failed `.js` / `.wasm` requests
- screenshots and diagnostics JSON on failure

## Limitations

- Camera intrinsics are placeholder values until calibration JSON is pasted/applied. Pose is approximate without calibrated `camera_matrix` and `dist_coeffs`.
- Single-face planar pose is supported when `cuboidLayout` is set; PoseFacingCamera gate rejects mirror solutions (ADR 0002).
- Lens undistort/distort runs in this example only; kibo-track core remains pinhole (ADR 0003).
- kibo-tag WASM artifacts are not bundled with `kibo-track`.
- Real-camera detection quality depends on lighting, focus, print quality, and camera permissions.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `insecureContext` | Open the app from `localhost` or HTTPS, not `file://` |
| `permissionDenied` | Allow camera access in the browser / OS privacy settings |
| `noVideoInput` | No camera device available |
| `deviceBusyOrUnavailable` | Another app is using the camera |
| `captureCanvasMismatch` | Video resolution and canvas backing size diverged |
| `wasmMissing` | Copy `apriltag_wasm.js` into `public/vendor/kibo-tag/` |
| `degenerateConfiguration` | Too few correspondences or planar ambiguity without a valid PoseFacingCamera candidate |
| wireframe misaligned, markers OK | Wrong corner order (kibo-tag needs `reversedCanonical`), missing calibration/distortion, or mirror pose |
