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

Copy kibo-tag browser artifacts into the example vendor folder:

```bash
cp /path/to/kibo-tag/html/apriltag.js public/vendor/kibo-tag/
cp /path/to/kibo-tag/html/apriltag_wasm.js public/vendor/kibo-tag/
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

## AprilCube layout

The example uses this layout:

- marker `0`: `+X` -> `right`
- marker `1`: `-X` -> `left`
- marker `2`: `+Y` -> `bottom`
- marker `3`: `-Y` -> `top`
- marker `4`: `+Z` -> `front`
- marker `5`: `-Z` -> `back`
- cube size: `32 mm` -> `0.032 m`

## Gates

Unit tests:

```bash
npm test
```

Fake-camera browser smoke test:

```bash
npx playwright install chromium
npm run test:browser
```

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

- Camera intrinsics are placeholder values. Pose is approximate until calibrated intrinsics are supplied.
- v0.4 does not support reliable single-face planar pose. One visible face may return `degenerateConfiguration`.
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
| `degenerateConfiguration` | Only one cube face is visible; show at least two non-coplanar faces |
