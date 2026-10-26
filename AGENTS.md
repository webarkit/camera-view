# AGENTS.md — camera-view

> Canonical instructions for AI coding agents (Claude Code, GitHub Copilot, Cursor, Antigravity, Codex, …).
> This is the **single source of truth**; [`CLAUDE.md`](./CLAUDE.md), [`.agents/instructions.md`](./.agents/instructions.md), and [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) point here.

## What this project is

**`@webarkit/camera-view`** is a small, standalone, tracker-agnostic TypeScript package for the [webarkit](https://github.com/webarkit) organization, extracted from [webarkit/ARnft](https://github.com/webarkit/ARnft) ([webarkit/ARnft#370](https://github.com/webarkit/ARnft/issues/370)). It owns:

1. **Opening the camera:** `getUserMedia`, selecting the camera by `cameraLabel`, selecting the rear camera on multi-camera phones, and falling back to the default camera when a requested device cannot be opened.
2. **Fitting the video into the processing frame:** the 320 px 4:3 letterbox (`getProcessGeometry`), the opt-in `rotatePortrait` 90° clockwise rotation, and recomputation on video resize.
3. **Producing frames:** `getImage()` (`ImageData`) and `getImageBitmap()` (`ImageBitmap`) throttled to `targetFrameRate`, plus a frozen, structured-cloneable `geometry: FrameGeometry` value and a `"geometrychange"` event.

See [README.md](./README.md) for the public API and [`docs/design/0001-camera-view.md`](./docs/design/0001-camera-view.md) for the accepted design and decision log.

## Environment & commands

- **Node:** version pinned in [`.nvmrc`](./.nvmrc) (v24.21.0); `package.json` sets a floor of `>=18`. **Package manager:** npm.
- Install: `npm install`
- Format check: `npm run format:check` (`npm run format` to write)
- License header check: `npm run check:headers` (`node scripts/check-license-headers.mjs --write` or the [`license-header-adder`](./.agents/skills/license-header-adder/SKILL.md) skill to add headers)
- Typecheck: `npm run typecheck` (`tsc -p tsconfig.json --noEmit`, covering `src/`, `test/`, `examples/`, and `*.config.ts`)
- Unit tests + coverage: `npm run test:coverage` (Vitest `unit` project in `happy-dom`, ≥ 90 % coverage thresholds on `src/`)
- Browser tests: `npm run test:browser` (Vitest `browser` project in headless Chromium via Playwright; requires `npx playwright install chromium` in CI or falls back to system Chrome locally)
- Build: `npm run build` (Vite library build emitting `dist/camera-view.mjs` + `dist/camera-view.umd.cjs`, then `tsc -p tsconfig.build.json` emitting `dist/types/`)
- Full local gate: `npm run verify && npm run test:browser`

Do not claim a change is verified without running `npm run verify` and `npm run test:browser`.

## Architecture — read this before editing

- **Zero runtime dependencies.** Do not add entries to `"dependencies"` in `package.json`.
- **Capture-only.** This package opens the camera, fits the video into the processing frame, and produces `ImageData` / `ImageBitmap` + `FrameGeometry`. It does not touch the host page's DOM outside the `<video>` element passed to `new CameraView(video)`, and it contains no tracker or 3D-renderer glue.
- **Bit-for-bit geometry parity with ARnft.** `getProcessGeometry()` in [`src/geometry.ts`](./src/geometry.ts) is guarded by [`test/unit/geometry.oracle.test.ts`](./test/unit/geometry.oracle.test.ts) against [`test/oracle/arnft-geometry.ts`](./test/oracle/arnft-geometry.ts). Do not alter the formula without an explicit design decision and a matching update in the oracle and `CHANGELOG.md`.
- **Module boundaries (`src/`):**
  - `src/geometry.ts` — pure functions (`getProcessGeometry`, `toFrameGeometry`). No DOM or media imports.
  - `src/options.ts` — pure validation and `getUserMedia` constraint builder (`resolveOptions`, `buildConstraints`).
  - `src/devices.ts` — camera selection over an injected `MediaDevices` (`openCameraStream`, `findCamera`, `getVideoDevices`, `stopStream`). Every intermediate stream opened and not returned **must** be stopped.
  - `src/frame-source.ts` — process canvas sizing, letterbox clearing, `drawFrame()` (including `rotatePortrait` 90° clockwise rotation), `ImageData` buffer reuse, and frame-rate throttling.
  - `src/CameraView.ts` — public `CameraView` class (`extends EventTarget`), lifecycle state machine (`idle | initializing | ready | ended | destroyed`), and ARnft-compatible accessors.
  - `src/errors.ts` — `CameraViewError` and `CameraViewErrorCode`. Browser `getUserMedia` errors are re-thrown unchanged.
  - `src/index.ts` — public exports only.

## Conventions

- **Language:** every repository artifact — code, comments, commit messages, PR titles and bodies, issues, docs — is written in English, whatever language the conversation with the agent uses.
- **Formatting is Prettier's job:** 4-space indentation for code (2-space for Markdown/YAML/JSON), `printWidth: 100`, double quotes, trailing commas ([`.prettierrc.json`](./.prettierrc.json)). Run `npm run format` before finishing.
- **License headers:** every `.ts`, `.js`, and `.mjs` file in `src/`, `test/`, `examples/`, `scripts/`, and root configs must carry the LGPL-3.0-or-later header (with the WebARKit linking exception). Use the [`license-header-adder`](./.agents/skills/license-header-adder/SKILL.md) skill or `node scripts/check-license-headers.mjs --write`, and verify with `npm run check:headers`.
- **Design records:** live in [`docs/design/`](./docs/design/). Read [`docs/design/0001-camera-view.md`](./docs/design/0001-camera-view.md) before changing lifecycle states, error codes, or geometry semantics.

## Git & contribution workflow

- **Start always from `dev` and open PRs against `dev` — never `main`.** `dev` is the development/integration branch; `main` is reserved exclusively for stable releases.
- **One branch per task/issue**, branched from an up-to-date `dev`.
- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):** `<type>(<optional scope>): <summary>` — e.g. `feat(geometry): …`, `fix(devices): …`, `test(browser): …`, `docs: …`, `chore: …`, `refactor: …`, `ci: …`.
  - Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
  - Scopes: `geometry`, `devices`, `frames`, `core`, `examples`, `ci`, `docs` (omit scope for repo-wide changes).
- **Changelog:** any PR that changes observable behaviour adds a line under `## [Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md).
- **No closing keywords (`Closes #NNN`, `Fixes #NNN`) in commit messages or PR descriptions:** PRs target `dev`, not `main`, and GitHub matches closing tokens even inside negations when a commit later reaches `main`. Reference issues as `#NNN` and close them manually with a comment after merge (see [`CONTRIBUTING.md`](./CONTRIBUTING.md)).
