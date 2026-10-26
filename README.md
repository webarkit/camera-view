# CameraView

[![CI](https://github.com/webarkit/camera-view/actions/workflows/CI.yml/badge.svg)](https://github.com/webarkit/camera-view/actions/workflows/CI.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen?logo=vitest&logoColor=white)](./docs/testing.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./tsconfig.json)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?logo=prettier&logoColor=white)](https://github.com/prettier/prettier)
[![Tested with Vitest](https://img.shields.io/badge/tested_with-vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: LGPL v3](https://img.shields.io/badge/License-LGPL_v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![GitHub stars](https://img.shields.io/github/stars/webarkit/camera-view?style=flat&logo=github)](https://github.com/webarkit/camera-view/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/webarkit/camera-view?style=flat&logo=github)](https://github.com/webarkit/camera-view/forks)

Tracker-agnostic camera capture and processing-frame geometry for the [WebARKit](https://github.com/webarkit) ecosystem.

`@webarkit/camera-view` extracts `CameraViewRenderer` and `getProcessGeometry()` out of [ARnft](https://github.com/webarkit/ARnft) ([webarkit/ARnft#370](https://github.com/webarkit/ARnft/issues/370)) so that ARnft, aframe-nft, webarkit-studio, [jsartoolkitNFT](https://github.com/webarkit/jsartoolkitNFT) and future WebARKit trackers share one implementation of:

- **opening the camera:** `getUserMedia`, selecting the device by `cameraLabel`, selecting the rear camera on multi-camera phones, and falling back to the default camera when a requested device cannot be opened;
- **fitting the video into the processing frame:** the 320 px 4:3 letterbox, the opt-in `rotatePortrait` 90° clockwise rotation, and recomputation on video resize;
- **producing frames:** `ImageData` (`getImage()`) and transferable `ImageBitmap` (`getImageBitmap()`) at `frameWidth × frameHeight`, throttled to `targetFrameRate`;
- **exposing `geometry: FrameGeometry`:** a frozen, structured-cloneable plain object that can be posted directly to a worker or passed to `tracker.projectionFor(viewport, view.geometry)` ([webarkit/jsartoolkitNFT#720](https://github.com/webarkit/jsartoolkitNFT/issues/720)).

> **Status:** pre-release (`0.1.0`). The `package.json` is configured for npm publication (`@webarkit/camera-view`), and the package is not published to the public registry yet.

---

## Quick start

```ts
import { CameraView } from "@webarkit/camera-view";

const video = document.querySelector("video")!;
const view = new CameraView(video);

await view.initialize({
    facingMode: "environment",
    cameraLabel: "Logitech",
    width: { min: 640, max: 1280 },
    targetFrameRate: 30,
    rotatePortrait: true,
});

// Plain frozen object — safe to structuredClone / postMessage to a worker
console.log(view.geometry);

// Read a throttled ImageData (frameWidth x frameHeight, typically 320 x 240)
const imageData = view.getImage();

// Or get a transferable ImageBitmap for zero-copy worker messaging
const bitmap = await view.getImageBitmap();
worker.postMessage({ type: "frame", bitmap, geometry: view.geometry }, [bitmap]);

view.addEventListener("geometrychange", (event) => {
    console.log("New frame geometry:", event.detail);
});

view.addEventListener("ended", () => {
    console.warn("Camera stream ended (unplugged or permission revoked)");
});

// When done: stops all media tracks immediately and detaches video.srcObject
view.destroy();
```

### Script tag (UMD)

The build also outputs `./dist/camera-view.umd.cjs`, which exposes the `CameraView` global for non-module consumers (such as legacy example pages):

```html
<script src="dist/camera-view.umd.cjs"></script>
<script>
  const view = new CameraView.CameraView(document.querySelector("video"));
</script>
```

---

## `FrameGeometry`

```
               frameWidth (pw, 320)
        +--------------------------------+
        |          oy (y)                |
        |   +------------------------+   |
        |   |                        |   |
        |ox |     video footprint    |   |  frameHeight (ph, 240)
        |(x)|       width x height   |   |
        |   |         (w x h)        |   |
        |   +------------------------+   |
        |                                |
        +--------------------------------+
```

```ts
interface FrameGeometry {
    readonly frameWidth: number;  // pw (<= 320)
    readonly frameHeight: number; // ph (<= 240)
    readonly videoWidth: number;  // vw (camera stream width)
    readonly videoHeight: number; // vh (camera stream height)
    readonly x: number;           // ox (horizontal letterbox offset)
    readonly y: number;           // oy (vertical letterbox offset)
    readonly width: number;       // w  (drawn footprint width)
    readonly height: number;      // h  (drawn footprint height)
    readonly rotated: boolean;    // rot (true when portrait video is rotated 90 deg CW)
}
```

When `rotatePortrait: true` is passed to `initialize()` and the camera stream is portrait (`videoHeight > videoWidth`), `drawFrame()` rotates the video 90° clockwise onto the landscape process canvas so the long axis fills the 320 px width instead of being pillarboxed to 135 px ([webarkit/ARnft#344](https://github.com/webarkit/ARnft/issues/344)).

---

## API reference

### `new CameraView(video, deps?)`

Creates a new instance bound to an `HTMLVideoElement`. Make sure the `<video>` element has `autoplay`, `muted` and `playsinline` set so mobile browsers allow playback.

- `video`: `HTMLVideoElement`
- `deps` *(optional)*: `Partial<CameraViewDeps>` — injectable `mediaDevices`, `now`, `createCanvas`, `isMobile`, `createImageBitmap`, `warn` for testing or custom environments.

### `await view.initialize(options?)`

Opens the camera stream, attaches it to `video.srcObject`, waits for a non-zero video resolution, and prepares the process canvas.

| Option | Type | Default | Description |
|---|---|---|---|
| `facingMode` | `string` | `"environment"` | Passed to `getUserMedia` video constraints. |
| `cameraLabel` | `string` | `undefined` | Case-insensitive substring matched against `MediaDeviceInfo.label`. |
| `width` | `{ min: number, max: number }` | `undefined` | Passed to `getUserMedia` video constraints. |
| `height` | `{ min: number, max: number }` | `undefined` | Validated for ARnft config compatibility; **not** sent to `getUserMedia`. |
| `targetFrameRate` | `number` | `60` | Maximum number of new frames drawn per second. |
| `rotatePortrait` | `boolean` | `false` | Rotate portrait streams (`vh > vw`) 90° clockwise onto the process canvas. |

### Properties and methods

- `view.state`: `"idle" | "initializing" | "ready" | "ended" | "destroyed"`
- `view.geometry`: `FrameGeometry` — throws `CameraViewError("NOT_INITIALIZED")` before `initialize()` resolves, or `"DESTROYED"` after `destroy()`.
- `view.getImage()`: `ImageData` — returns a fresh `ImageData` copy at `frameWidth × frameHeight`. Draws a new frame from the video at most `targetFrameRate` times per second.
- `view.getImageBitmap()`: `Promise<ImageBitmap>` — returns a transferable `ImageBitmap` of the process canvas, sharing the same throttle and frame counter as `getImage()`.
- `view.destroy()`: `void` — idempotent; stops all tracks immediately, removes listeners, and clears `video.srcObject`.
- **ARnft-compatible accessors:** `view.image`, `view.frame`, `view.getFrame()`, `view.width`, `view.height`, `view.facing`, `view.rotated`, `view.video`, `view.canvasProcess`.

### Pure geometry helpers

- `getProcessGeometry(vw, vh, rotatePortrait = false, floor = false): ProcessGeometry` — bit-for-bit identical to ARnft's `getProcessGeometry()`.
- `toFrameGeometry(vw, vh, processGeometry): FrameGeometry` — converts a `ProcessGeometry` into a frozen `FrameGeometry`.

### Events

- `"geometrychange"` (`CustomEvent<FrameGeometry>`): dispatched on the `CameraView` instance when the video stream changes resolution (e.g. on device orientation change).
- `"ended"` (`Event`): dispatched when the active video track ends externally (camera unplugged or permission revoked). `view.state` becomes `"ended"`, and `view.initialize()` can be called again to reopen the camera.

### Errors

Package errors are instances of `CameraViewError` with a `code` property:

- `"NOT_SUPPORTED"` — `navigator.mediaDevices.getUserMedia` (or `createImageBitmap`) is unavailable.
- `"NOT_INITIALIZED"` — `geometry`, `getImage()`, `getImageBitmap()` or `canvasProcess` accessed before `ready`.
- `"ALREADY_INITIALIZED"` — `initialize()` called while already `initializing` or `ready`.
- `"STREAM_ENDED"` — `getImage()` or `getImageBitmap()` called while in `ended`.
- `"DESTROYED"` — any method called after `destroy()`, or `destroy()` called while `initialize()` was pending.
- `"INVALID_OPTIONS"` — invalid `CameraViewOptions` (e.g. `targetFrameRate <= 0` or `width.min > width.max`).

Browser `getUserMedia` errors (`NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`) are re-thrown unchanged so existing error handling by `error.name` keeps working.

---

## Differences from ARnft's `CameraViewRenderer`

The geometry math (`getProcessGeometry`) and the canvas drawing (`drawFrame`) are preserved bit for bit (verified against a frozen copy of ARnft's function in [`test/unit/geometry.oracle.test.ts`](./test/unit/geometry.oracle.test.ts)). The following lifecycle and safety bugs from ARnft's `CameraViewRenderer` are intentionally fixed:

1. **`destroy()` stops the camera immediately and does not touch the DOM.** ARnft's `destroy()` only registered a listener for a global `stopVideoStreaming` event and removed `#app` from the document, leaving the camera light on if that event was never dispatched.
2. **Events are dispatched on the `CameraView` instance, not `window`.** `view.addEventListener("geometrychange", ...)` replaces the global `window` `"videoResize"` event so multiple instances do not collide.
3. **Calling `getImage()` before `initialize()` throws `CameraViewError("NOT_INITIALIZED")`** instead of crashing with `TypeError: Cannot read properties of undefined (reading 'slice')`.
4. **Frame-size changes on resize (e.g. `320×240` → `318×239` on iPhone `1170×2532` portrait streams) reallocate the pixel cache** instead of throwing `RangeError: offset is out of bounds` in `Uint8ClampedArray.prototype.set()`.
5. **`loadedmetadata` uses `addEventListener` and waits for a non-zero resolution** instead of overwriting `video.onloadedmetadata` and computing `NaN` geometry when an Android WebView fires `loadedmetadata` with `0×0`.
6. **Calling `destroy()` while `initialize()` is awaiting permission or metadata stops the late stream** and rejects with `CameraViewError("DESTROYED")` instead of leaking an active camera stream.
7. **Throttling uses `performance.now()` (injectable) with `lastCapture = -Infinity`** so the first frame after `initialize()` or after a geometry change is always drawn.
8. **`FrameGeometry` exposes the floored values that are actually drawn on the process canvas.** ARnft's `NFTWorker` historically used unfloored values via `getWindowSize()`, which can differ by 0.5–1 px on some portrait resolutions (documented in `test/unit/geometry.oracle.test.ts`).

---

## Development

```bash
npm install
npm run verify        # format:check + check:headers + typecheck + unit tests w/ coverage + build
npm run test:browser  # real-pixel tests in headless Chromium via Vitest Browser Mode + Playwright
npm run dev           # interactive demo at http://localhost:5173
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch and pull request workflow (`dev` integration branch, Conventional Commits) and [docs/testing.md](./docs/testing.md) for the testing strategy.

## License

[LGPL-3.0-or-later](./LICENSE) with the WebARKit linking exception.
