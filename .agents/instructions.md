# Agent instructions

The canonical instructions for this repository live in **[`AGENTS.md`](../AGENTS.md)** at the project root.

Please read that file first. It covers:

- **Purpose & architecture:** `@webarkit/camera-view` — tracker-agnostic camera capture, 320 px 4:3 letterbox / `rotatePortrait` geometry (`FrameGeometry`), and throttled `ImageData` / `ImageBitmap` frame production, with zero runtime dependencies.
- **Verification commands:** `npm install`, `npm run format:check`, `npm run check:headers`, `npm run typecheck`, `npm run test:coverage` (Vitest `unit` project), `npm run test:browser` (Vitest `browser` project with Playwright), and `npm run build` (Vite library mode + `tsc` declarations).
- **License header skill:** [`.agents/skills/license-header-adder/SKILL.md`](./skills/license-header-adder/SKILL.md) — every `.ts`, `.js`, and `.mjs` file carries the LGPL-3.0-or-later header with the WebARKit linking exception.
- **Git workflow:** always branch from `dev` and open pull requests against **`dev`**, never `main` (`main` is for stable releases only). Use **Conventional Commits** (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`) and never use GitHub closing keywords (`Closes #NNN`, `Fixes #NNN`).
