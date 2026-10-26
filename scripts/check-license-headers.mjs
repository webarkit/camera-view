/*
 *  check-license-headers.mjs
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

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const TEMPLATE_PATH = join(
    ROOT,
    ".agents",
    "skills",
    "license-header-adder",
    "resources",
    "HEADER.txt",
);
const TEMPLATE = readFileSync(TEMPLATE_PATH, "utf8").replace(/\r\n/g, "\n").trim();

const EXTENSIONS = new Set([".ts", ".js", ".mjs"]);
const EXCLUDED_DIRS = new Set([
    "node_modules",
    "dist",
    "coverage",
    ".git",
    ".vitest-attachments",
    "test-results",
    "playwright-report",
]);

const writeMode = process.argv.includes("--write");

function walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        if (EXCLUDED_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full, out);
        } else if (EXTENSIONS.has(extname(entry))) {
            out.push(full);
        }
    }
    return out;
}

function hasHeader(content, filename) {
    const head = content.slice(0, 1600);
    return head.includes("GNU Lesser General Public License") && head.includes(`*  ${filename}`);
}

const files = walk(ROOT);
const missing = [];

for (const file of files) {
    const name = basename(file);
    const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    if (hasHeader(raw, name)) continue;

    if (writeMode) {
        const header = TEMPLATE.replace("{{FILENAME}}", name);
        let next;
        if (raw.startsWith("#!")) {
            const newlineIdx = raw.indexOf("\n");
            const shebang = raw.slice(0, newlineIdx + 1);
            const rest = raw.slice(newlineIdx + 1).replace(/^\n+/, "");
            next = `${shebang}\n${header}\n\n${rest}`;
        } else {
            next = `${header}\n\n${raw.replace(/^\n+/, "")}`;
        }
        writeFileSync(file, next, "utf8");
        console.log(`Added license header: ${relative(ROOT, file)}`);
    } else {
        missing.push(relative(ROOT, file));
    }
}

if (!writeMode && missing.length > 0) {
    console.error("Missing or mismatched LGPL license header in:");
    for (const f of missing) {
        console.error(`  - ${f}`);
    }
    console.error(
        "Run `node scripts/check-license-headers.mjs --write` (or use the license-header-adder skill).",
    );
    process.exit(1);
}
