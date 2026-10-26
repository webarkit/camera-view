# Contributing to `@webarkit/camera-view`

Thank you for your interest in contributing to `@webarkit/camera-view`! By following these guidelines, you help keep the project clean, well-tested, and easy to maintain across the [WebARKit](https://github.com/webarkit) organization.

## Pull Request Workflow

1. **Always start from the `dev` branch**: `dev` is the active development and integration branch. Ensure your local copy is up to date before starting new work:
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. **Create a feature/fix branch from `dev`**:
   ```bash
   git checkout -b feat/your-topic
   ```
3. **Develop, format, and test**:
   - Every `.ts`, `.js`, and `.mjs` file must carry the LGPL-3.0-or-later header (run `node scripts/check-license-headers.mjs --write` or follow [`.agents/skills/license-header-adder/SKILL.md`](./.agents/skills/license-header-adder/SKILL.md)).
   - Run the full verification suite locally (see [Testing](#testing)).
4. **Update [`CHANGELOG.md`](./CHANGELOG.md)**: if your change affects observable behaviour (a new option, a bug fix, a new export, or an error condition), add an entry under `## [Unreleased]` in the same pull request.
5. **Open a Pull Request against `dev`**:
   - **Target branch:** always `dev` — never `main`. The `main` branch is reserved exclusively for stable releases.
   - **Title:** follow [Conventional Commits](#commit-message-conventions).
6. **Reference issues without closing keywords**:
   - Name each issue your pull request addresses (`#NNN`) in the PR description so GitHub links it.
   - **Do not use closing keywords (`Closes #NNN`, `Fixes #NNN`, `Resolves #NNN`)** in PR descriptions or commit messages, not even to negate them (e.g. write `#NNN stays open` instead of `does not close #NNN`). Because PRs target `dev` rather than `main`, closing keywords in PR bodies do nothing on merge, and closing tokens in commit messages fire unexpectedly later when `dev` is merged into `main`. Issues are closed manually with a comment naming the PR or commit that resolved them.

> **Important:** All pull requests must be opened against the `dev` branch. The `main` branch is only updated via release pull requests from `dev`.

---

## Commit Message Conventions

This repository strictly follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<optional scope>): <concise imperative summary>
```

### 1. Allowed Types

- **`feat`**: A new feature or public capability.
- **`fix`**: A bug fix.
- **`docs`**: Documentation-only changes.
- **`refactor`**: A code change that neither fixes a bug nor adds a feature.
- **`test`**: Adding missing tests or improving existing ones.
- **`chore`**: Changes to the build process, dependencies, or auxiliary scripts.
- **`ci`**: Changes to GitHub Actions workflows or CI configuration.

### 2. Project Scopes

Use one of the following scopes when a change is confined to one area:

- **`geometry`**: `src/geometry.ts` (`getProcessGeometry`, `toFrameGeometry`, `FrameGeometry`).
- **`devices`**: `src/devices.ts` (`openCameraStream`, camera enumeration, `cameraLabel` matching).
- **`frames`**: `src/frame-source.ts` (process canvas, `drawFrame`, rotation, throttling, `ImageBitmap`).
- **`core`**: `src/CameraView.ts`, `src/options.ts`, `src/errors.ts`, lifecycle and events.
- **`examples`**: The interactive Vite demo under `examples/`.
- **`ci`**: GitHub Actions workflows under `.github/workflows/`.
- **`docs`**: Documentation files (`README.md`, `docs/`).

Omit the scope for changes spanning the whole repository.

### 3. Examples

- `feat(frames): add getImageBitmap transferable frame capture`
- `fix(devices): stop initial permission stream when reopening by cameraLabel`
- `test(geometry): add fast-check property tests against ARnft oracle`
- `docs: document differences from ARnft CameraViewRenderer`
- `ci: add Playwright browser test job`

If a change introduces a breaking API change, append `!` after the type/scope (e.g. `feat(core)!: ...`) and include a `BREAKING CHANGE:` footer.

---

## Testing

Before committing or opening a pull request, run all checks that CI runs:

```bash
# 1. Install dependencies
npm install

# 2. Check formatting (or run `npm run format` to fix)
npm run format:check

# 3. Verify LGPL license headers on all source/test/config files
npm run check:headers

# 4. Type-check src/, test/, examples/, and config files
npm run typecheck

# 5. Run unit tests + v8 coverage thresholds (>= 90%)
npm run test:coverage

# 6. Build ESM, UMD, and .d.ts outputs
npm run build

# 7. Run real-pixel browser tests in headless Chromium (Vitest Browser Mode + Playwright)
npm run test:browser
```

`npm run verify` runs steps 2–6 in one command. See [`docs/testing.md`](./docs/testing.md) for how the four test layers (oracle/property, 144-combination device matrix, lifecycle/fakes, and real-pixel Chromium browser tests) are organized.

---

## Releasing

Releases are cut by @kalwalt from `dev` into `main` (the only pull request that targets `main`):

1. Verify `dev` is green on `npm run verify && npm run test:browser`.
2. Bump `"version"` in `package.json` (and `package-lock.json`), move `## [Unreleased]` in `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD`, and open a fresh `## [Unreleased]` section above it.
3. Open the release pull request from `dev` into `main` titled `chore(release): vX.Y.Z`, with that version's changelog section as its body, and merge it with a merge commit.
4. Create an annotated tag `vX.Y.Z` on the merge commit on `main`, push the tag, create the GitHub Release, and (once public registry publishing is enabled) run `npm publish`.

---

## Code of Conduct

We adopt the [Contributor Covenant](./CODE_OF_CONDUCT.md) to promote an inclusive and respectful environment for all contributors.
