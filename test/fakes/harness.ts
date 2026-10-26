/*
 *  harness.ts
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

import { CameraView } from "../../src/CameraView";
import type { CameraViewDeps } from "../../src/types";
import {
    FakeCanvas,
    FakeClock,
    FakeMediaDevices,
    FakeVideo,
    type FakeMediaScenario,
} from "./media";

export interface Harness {
    media: FakeMediaDevices;
    video: FakeVideo;
    canvas: FakeCanvas;
    clock: FakeClock;
    warnings: unknown[][];
    bitmaps: HTMLCanvasElement[];
    view: CameraView;
}

export const DEFAULT_SCENARIO: FakeMediaScenario = {
    devices: [{ deviceId: "d0", label: "Integrated Camera", width: 640, height: 480 }],
};

/** A CameraView wired to fakes only: no browser API is touched. */
export function createHarness(
    scenario: FakeMediaScenario = DEFAULT_SCENARIO,
    overrides: Partial<CameraViewDeps> & { mobile?: boolean } = {},
): Harness {
    const media = new FakeMediaDevices(scenario);
    const video = new FakeVideo();
    const canvas = new FakeCanvas();
    const clock = new FakeClock();
    const warnings: unknown[][] = [];
    const bitmaps: HTMLCanvasElement[] = [];
    const { mobile, ...deps } = overrides;
    const view = new CameraView(video.asVideo(), {
        mediaDevices: media.asMediaDevices(),
        now: clock.now,
        createCanvas: () => canvas.asCanvas(),
        isMobile: () => mobile ?? false,
        createImageBitmap: async (source) => {
            bitmaps.push(source);
            return { width: source.width, height: source.height } as ImageBitmap;
        },
        warn: (...args) => warnings.push(args),
        ...deps,
    });
    return { media, video, canvas, clock, warnings, bitmaps, view };
}
