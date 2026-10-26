# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial extraction of `CameraView` and `getProcessGeometry()` from `webarkit/ARnft` ([#370](https://github.com/webarkit/ARnft/issues/370)).
- `view.geometry` (`FrameGeometry`, frozen and structured-cloneable) and `toFrameGeometry()`.
- `view.getImageBitmap()` returning a transferable `ImageBitmap` throttled with `getImage()`.
- Instance-scoped `"geometrychange"` (`CustomEvent<FrameGeometry>`) and `"ended"` events on `CameraView`.
- Explicit lifecycle `state` (`"idle" | "initializing" | "ready" | "ended" | "destroyed"`) and typed `CameraViewError` codes (`NOT_SUPPORTED`, `NOT_INITIALIZED`, `ALREADY_INITIALIZED`, `STREAM_ENDED`, `DESTROYED`, `INVALID_OPTIONS`).
- Interactive Vite demo in `examples/` and two-project Vitest suite (`unit` + `browser` with Playwright).
