# Testing Strategy

`@webarkit/camera-view` sits at the boundary between browser media APIs (`navigator.mediaDevices`, `HTMLVideoElement`) and 2D canvas pixel manipulation (`drawImage`, `getImageData`, `createImageBitmap`). No single test environment covers both well:

- DOM emulators (`happy-dom`, `jsdom`) do not decode video streams or rasterize rotated `drawImage` calls onto a canvas.
- A real browser is slow and awkward for permuting 144 combinations of multi-camera device lists, hidden permission labels, busy cameras, and mid-initialization cancellations.

We therefore split the suite into **two Vitest projects** configured in [`vitest.config.ts`](../vitest.config.ts) and **four testing layers**.

---

## Projects and commands

| Command | Project | Environment | What it runs |
|---|---|---|---|
| `npm run test:unit` | `unit` | `happy-dom` | `test/unit/**/*.test.ts` (312 tests: oracle, property, combinatorial device matrix, frame source, lifecycle) |
| `npm run test:coverage` | `unit` | `happy-dom` + v8 | Same as `test:unit` with ≥ 90 % line/branch/function/statement thresholds on `src/` |
| `npm run test:browser` | `browser` | Headless Chromium (Playwright) | `test/browser/**/*.test.ts` (real `<canvas>` + `captureStream()` + `<video>` pixel tests) |
| `npm test` | both | both | Runs `unit` and `browser` |

---

## Layer 1 — Geometry oracle & property tests (`test/unit/geometry*.test.ts`)

1. **Bit-for-bit ARnft oracle** ([`test/oracle/arnft-geometry.ts`](../test/oracle/arnft-geometry.ts) + [`test/unit/geometry.oracle.test.ts`](../test/unit/geometry.oracle.test.ts)):
   - Holds a frozen, verbatim copy of ARnft's `getProcessGeometry()`.
   - Verifies exact equality (`Object.is` on every field) across 46 common camera/phone resolutions, an 80,000+ point dense grid (`1..2048`), and 5,000 `fast-check` random property runs (`1..8192 × 1..8192 × rotatePortrait × floor`).
2. **Hand-calculated table** ([`test/unit/geometry.test.ts`](../test/unit/geometry.test.ts)):
   - Checks 4:3, 16:9, 9:16, 3:4, 1:1, 2:1, 1×1, extreme aspect ratios (`4096×1`, `1×4096`), and iPhone portrait (`1170×2532` where `pw×ph` is `318×239`).
3. **Mathematical invariants** (`fast-check`):
   - Every floored output is a non-negative integer.
   - `318 <= pw <= 320` and `239 <= ph <= 240` (4:3 within flooring error).
   - `ox + w <= pw`, `oy + h <= ph`, and letterbox margins are symmetric within ±1 px.
   - `rotated === (rotatePortrait && vh > vw)`.
   - `toFrameGeometry()` produces a frozen plain object that survives `structuredClone` and JSON round-trips.

---

## Layer 2 — Exhaustive camera-selection matrix (`test/unit/devices.test.ts`)

[`test/fakes/media.ts`](../test/fakes/media.ts) provides a deterministic `FakeMediaDevices` that models browser permission state (labels hidden until the first `getUserMedia` succeeds), per-device failures (`NotReadableError`), and track settings.

`devices.test.ts` runs all **144 combinations** of:

- `cameraLabel`: `none` × `matching ("back")` × `non-matching ("Logitech")`
- initial labels: `hidden` (first visit before permission) × `visible` (permission already granted)
- platform: `desktop` × `mobile` (multi-camera rear-lens heuristic)
- video input count: `0` × `1` × `3`
- exact device open: `succeeds` × `fails (busy camera fallback)`
- default camera: `already the matching device` × `a different device`

For every combination it asserts:
- the selected `deviceId` (or thrown browser error) matches the specification;
- **zero stream leaks:** at most one `MediaStream` remains live after `openCameraStream` settles, and zero on error;
- no redundant reopen when the initial permission-granting stream already opened the matching camera;
- `audio: false` and the caller's `facingMode`/`width` constraints are preserved on every call.

---

## Layer 3 — Frame source, lifecycle & bug regressions (`test/unit/frame-source.test.ts`, `test/unit/camera-view.test.ts`)

Using [`test/fakes/harness.ts`](../test/fakes/harness.ts):

- **State machine:** verifies every transition (`idle` → `initializing` → `ready` → `ended` → `destroyed`, plus error recovery back to `idle` and re-initialization from `ended`) and asserts the exact `CameraViewErrorCode` on invalid calls.
- **Cancellation races:** calls `destroy()` while `getUserMedia` is pending and while `loadedmetadata` is pending; verifies that the late stream is stopped and `initialize()` rejects with `DESTROYED`.
- **Android WebView `0×0` metadata:** verifies that `initialize()` waits for the first non-zero `resize` event before computing geometry.
- **iPhone rotation buffer resize (`320×240` ↔ `318×239`):** regression test for the `Uint8ClampedArray.set` `RangeError` when the floored frame size changes by 1–2 px on resize.
- **Throttling:** uses an injected `FakeClock` to check boundary conditions at 1, 15, 24, 30, 60 and `Infinity` fps, clock rollback, and lazy readback after `getImageBitmap()`.

---

## Layer 4 — Real-pixel browser tests (`test/browser/camera-view.browser.test.ts`)

Runs inside headless Chromium via `@vitest/browser-playwright`:

1. Paints a synthetic `<canvas>` with four solid-colour quadrants (top-left Red, top-right Green, bottom-left Blue, bottom-right Yellow), streams it via `canvas.captureStream()`, and feeds it to `CameraView` on a real `<video>` element.
2. Reads actual pixels from `view.getImage()` and `await view.getImageBitmap()` and asserts:
   - **4:3 (`640×480`):** all four quadrants land in their corners with no black bars.
   - **16:9 (`640×360`):** top (`y < 30`) and bottom (`y >= 210`) letterbox bars are black; the four quadrants land inside the `320×180` footprint.
   - **9:16 (`360×640`, `rotatePortrait: false`):** left (`x < 92`) and right (`x >= 227`) pillarbox bars are black; the quadrants land inside the `135×240` footprint.
   - **9:16 (`360×640`, `rotatePortrait: true`):** rotated 90° clockwise — the source top-left (Red) lands at the top-right of the footprint, top-right (Green) at bottom-right, bottom-left (Blue) at top-left, and bottom-right (Yellow) at bottom-left.
   - **Live stream resize (`640×360` → `360×640`):** the browser fires the real `<video>` `resize` event, `CameraView` dispatches `geometrychange`, and `view.geometry` updates.
