/*
 *  geometry.test.ts
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

import { describe, expect, it } from "vitest";
import { getProcessGeometry, PROCESS_SIZE, toFrameGeometry } from "../../src/geometry";

type Row = [
    label: string,
    vw: number,
    vh: number,
    rotatePortrait: boolean,
    expected: {
        rot: boolean;
        w: number;
        h: number;
        pw: number;
        ph: number;
        ox: number;
        oy: number;
    },
];

// Hand-checked values (floored, as CameraView draws them).
// prettier-ignore
const TABLE: Row[] = [
    ["4:3 landscape", 640, 480, false, { rot: false, w: 320, h: 240, pw: 320, ph: 240, ox: 0, oy: 0 }],
    ["4:3 landscape, rotatePortrait has no effect", 640, 480, true, { rot: false, w: 320, h: 240, pw: 320, ph: 240, ox: 0, oy: 0 }],
    ["4:3 at process size", 320, 240, false, { rot: false, w: 320, h: 240, pw: 320, ph: 240, ox: 0, oy: 0 }],
    ["16:9 landscape (720p)", 1280, 720, false, { rot: false, w: 320, h: 180, pw: 320, ph: 240, ox: 0, oy: 30 }],
    ["16:9 landscape (1080p)", 1920, 1080, false, { rot: false, w: 320, h: 180, pw: 320, ph: 240, ox: 0, oy: 30 }],
    ["16:9 landscape (4K)", 3840, 2160, false, { rot: false, w: 320, h: 180, pw: 320, ph: 240, ox: 0, oy: 30 }],
    ["2:1 landscape", 1280, 640, false, { rot: false, w: 320, h: 160, pw: 320, ph: 240, ox: 0, oy: 40 }],
    ["9:16 portrait, letterboxed", 720, 1280, false, { rot: false, w: 135, h: 240, pw: 320, ph: 240, ox: 92, oy: 0 }],
    ["9:16 portrait, rotated", 720, 1280, true, { rot: true, w: 320, h: 180, pw: 320, ph: 240, ox: 0, oy: 30 }],
    ["9:16 portrait 1080p, letterboxed", 1080, 1920, false, { rot: false, w: 135, h: 240, pw: 320, ph: 240, ox: 92, oy: 0 }],
    ["9:16 portrait 1080p, rotated", 1080, 1920, true, { rot: true, w: 320, h: 180, pw: 320, ph: 240, ox: 0, oy: 30 }],
    ["3:4 portrait, letterboxed", 480, 640, false, { rot: false, w: 180, h: 240, pw: 320, ph: 240, ox: 70, oy: 0 }],
    ["3:4 portrait, rotated fills the frame", 480, 640, true, { rot: true, w: 320, h: 240, pw: 320, ph: 240, ox: 0, oy: 0 }],
    ["1:1 square", 720, 720, false, { rot: false, w: 240, h: 240, pw: 320, ph: 240, ox: 40, oy: 0 }],
    ["1:1 square is not portrait", 720, 720, true, { rot: false, w: 240, h: 240, pw: 320, ph: 240, ox: 40, oy: 0 }],
    ["1x1 video", 1, 1, false, { rot: false, w: 240, h: 240, pw: 320, ph: 240, ox: 40, oy: 0 }],
    ["extreme landscape: zero-height footprint", 4096, 1, false, { rot: false, w: 320, h: 0, pw: 320, ph: 240, ox: 0, oy: 120 }],
    ["extreme portrait: zero-width footprint", 1, 4096, false, { rot: false, w: 0, h: 240, pw: 320, ph: 240, ox: 160, oy: 0 }],
    // iPhone 12-15 portrait stream: the frame is NOT 320 x 240 (see frame-source tests)
    ["iPhone portrait 1170x2532, letterboxed", 1170, 2532, false, { rot: false, w: 110, h: 239, pw: 318, ph: 239, ox: 104, oy: 0 }],
    ["iPhone portrait 1170x2532, rotated", 1170, 2532, true, { rot: true, w: 320, h: 147, pw: 320, ph: 240, ox: 0, oy: 46 }],
];

describe("getProcessGeometry — hand-checked table", () => {
    it.each(TABLE)(
        "%s (%i x %i, rotatePortrait=%s)",
        (_label, vw, vh, rotatePortrait, expected) => {
            expect(getProcessGeometry(vw, vh, rotatePortrait, true)).toEqual(expected);
        },
    );

    it("does not floor by default (ARnft getWindowSize semantics)", () => {
        const g = getProcessGeometry(720, 1280);
        expect(g.ox).toBe(92.5);
        expect(getProcessGeometry(720, 1280, false, true).ox).toBe(92);
    });

    it("uses a 320 px processing size", () => {
        expect(PROCESS_SIZE).toBe(320);
    });

    it("a rotated portrait has the geometry of the swapped landscape", () => {
        const rotated = getProcessGeometry(1080, 1920, true, true);
        const landscape = getProcessGeometry(1920, 1080, false, true);
        expect({ ...rotated, rot: false }).toEqual(landscape);
        expect(rotated.rot).toBe(true);
    });
});

describe("toFrameGeometry", () => {
    it("maps the ARnft names to the FrameGeometry names", () => {
        const g = getProcessGeometry(720, 1280, true, true);
        expect(toFrameGeometry(720, 1280, g)).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 720,
            videoHeight: 1280,
            x: 0,
            y: 30,
            width: 320,
            height: 180,
            rotated: true,
        });
    });

    it("is frozen plain data that survives structuredClone", () => {
        const fg = toFrameGeometry(1280, 720, getProcessGeometry(1280, 720, false, true));
        expect(Object.isFrozen(fg)).toBe(true);
        expect(Object.getPrototypeOf(fg)).toBe(Object.prototype);
        expect(structuredClone(fg)).toEqual(fg);
        expect(JSON.parse(JSON.stringify(fg))).toEqual(fg);
    });
});
