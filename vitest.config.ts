/*
 *  vitest.config.ts
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

import { existsSync } from "node:fs";
import { playwright } from "@vitest/browser-playwright";
import { chromium } from "playwright";
import { defineConfig } from "vitest/config";

// Prefer Playwright's downloaded Chromium (used in CI after `npx playwright install chromium`);
// fall back to the system Chrome when a contributor has not downloaded Playwright's browser yet.
const hasPlaywrightChromium = (() => {
    try {
        return existsSync(chromium.executablePath());
    } catch {
        return false;
    }
})();

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts", "src/types.ts"],
            reporter: ["text", "html", "lcov"],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90,
            },
        },
        projects: [
            {
                test: {
                    name: "unit",
                    environment: "happy-dom",
                    include: ["test/unit/**/*.test.ts"],
                    restoreMocks: true,
                },
            },
            {
                test: {
                    name: "browser",
                    include: ["test/browser/**/*.test.ts"],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright({
                            launchOptions: {
                                channel: hasPlaywrightChromium ? undefined : "chrome",
                                args: [
                                    "--use-fake-ui-for-media-stream",
                                    "--use-fake-device-for-media-stream",
                                ],
                            },
                        }),
                        instances: [{ browser: "chromium" }],
                    },
                },
            },
        ],
    },
});
