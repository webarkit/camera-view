/*
 *  vite.config.ts
 *  camera-view
 *
 *  This file is part of camera-view - WebARKit.
 *
 *  camera-view is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  camera-view is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with camera-view.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  As a special exception, the copyright holders of this library give you
 *  permission to link this library with independent modules to produce an
 *  executable, regardless of the license terms of these independent modules, and to
 *  copy and distribute the resulting executable under terms of your choice,
 *  provided that you also meet, for each linked independent module, the terms and
 *  conditions of the license of that module. An independent module is a module
 *  which is neither derived from nor based on this library. If you modify this
 *  library, you may extend this exception to your version of the library, but you
 *  are not obligated to do so. If you do not wish to do so, delete this exception
 *  statement from your version.
 *
 *  Copyright 2026 WebARKit.
 *
 *  Author(s): Walter Perdan @kalwalt https://github.com/kalwalt
 *
 */

import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library build: ESM for bundlers, UMD for <script> tags (global `CameraView`).
// Type declarations are emitted separately by `tsc -p tsconfig.build.json`.
export default defineConfig({
    build: {
        target: "es2020",
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: resolve(import.meta.dirname, "src/index.ts"),
            name: "CameraView",
            formats: ["es", "umd"],
            fileName: (format) => (format === "es" ? "camera-view.mjs" : "camera-view.umd.cjs"),
        },
    },
});
