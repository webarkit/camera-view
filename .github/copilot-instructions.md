# GitHub Copilot instructions — camera-view

The full guidance is in **[`AGENTS.md`](../AGENTS.md)** (source of truth). Key rules inlined because Copilot injects this file directly:

- **What this package is:** `@webarkit/camera-view`, a standalone, zero-dependency TypeScript package extracted from `webarkit/ARnft` ([#370](https://github.com/webarkit/ARnft/issues/370)). It opens the camera (`getUserMedia`, `cameraLabel`, mobile rear-camera selection, fallbacks), fits the video into the 320 px 4:3 processing frame (`getProcessGeometry`, `rotatePortrait`), produces throttled `ImageData` (`getImage()`) and `ImageBitmap` (`getImageBitmap()`), and exposes a frozen, structured-cloneable `geometry: FrameGeometry` plus `"geometrychange"` and `"ended"` events.
- **Bit-for-bit geometry parity:** `getProcessGeometry()` in `src/geometry.ts` must stay bit-for-bit identical to `test/oracle/arnft-geometry.ts` (enforced by `test/unit/geometry.oracle.test.ts`).
- **Commands (run in this order):**
  - `npm install`
  - `npm run format:check` (Prettier, 4-space indent, `printWidth: 100`, double quotes)
  - `npm run check:headers` (LGPL-3.0-or-later header on every `.ts`/`.js`/`.mjs` file; add with `node scripts/check-license-headers.mjs --write`)
  - `npm run typecheck` (`tsc -p tsconfig.json --noEmit`)
  - `npm run test:coverage` (Vitest `unit` project in `happy-dom`, ≥ 90 % coverage thresholds)
  - `npm run test:browser` (Vitest `browser` project in headless Chromium via Playwright)
  - `npm run build` (Vite ESM + UMD bundle in `dist/` and `.d.ts` in `dist/types/`)
- **Git & PR workflow:** always branch from `dev` and open PRs against **`dev`**, never `main` (`main` is reserved for stable releases). Follow **Conventional Commits** (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci` with optional scopes `geometry`, `devices`, `frames`, `core`, `examples`, `ci`, `docs`). Never use closing keywords (`Closes #NNN`, `Fixes #NNN`) in commits or PR descriptions.
- **Language:** every repository artifact — code, comments, commit messages, PR titles and bodies, issues, docs — is written in English.
