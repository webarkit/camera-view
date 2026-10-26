---
name: license-header-adder
description: Adds the camera-view LGPL-3.0-or-later license header (with the WebARKit linking exception) to source files, replacing the filename placeholder. Use when creating a new .ts/.js/.mjs file or when `npm run check:headers` fails.
---

# License Header Adder Skill

Every source file in this repository starts with the same LGPLv3 license header. This skill tells you how to add it consistently.

## Instructions

1. **Read the template** in [`resources/HEADER.txt`](./resources/HEADER.txt).
2. **Replace the placeholder**: substitute `{{FILENAME}}` with the basename of the target file (e.g. `CameraView.ts`).
3. **Supported files**: apply the header to
    - `.ts` files (including `.d.ts` written by hand, tests and config files),
    - `.js` and `.mjs` files.
4. **Application logic**:
    - If the file already starts with a license header (its first comment contains `GNU Lesser General Public License`), skip it.
    - **Exclusions**: never apply it to `node_modules/`, `dist/`, `coverage/`, generated files, or third-party vendored code.
    - Insert the header at the very top of the file. If the file starts with a shebang (`#!/usr/bin/env node`), keep the shebang on line 1 and put the header right after it.
    - Leave exactly one blank line between the header and the original content.
    - Do not change the year of an existing header; new files use the current year in `Copyright <year> WebARKit.`
5. **Verify**: run `npm run check:headers` ([`scripts/check-license-headers.mjs`](../../../scripts/check-license-headers.mjs)); CI runs the same check.

## Example

Applying to `src/geometry.ts`:

```ts
/*
 *  geometry.ts
 *  camera-view
 *
 *  This file is part of camera-view - WebARKit.
 *  ...
 *  Copyright 2026 WebARKit.
 *
 *  Author(s): Walter Perdan @kalwalt https://github.com/kalwalt
 *
 */

import type { ProcessGeometry } from "./types";
```
