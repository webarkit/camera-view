/*
 *  geometry.oracle.test.ts
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

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getProcessGeometry, toFrameGeometry } from "../../src/geometry";
import { arnftGetProcessGeometry } from "../oracle/arnft-geometry";

/** Resolutions cameras and phones actually deliver, both orientations. */
const COMMON = [
    [160, 120],
    [320, 240],
    [352, 288],
    [480, 360],
    [640, 360],
    [640, 480],
    [800, 600],
    [960, 540],
    [1024, 768],
    [1280, 720],
    [1280, 960],
    [1440, 1080],
    [1600, 720],
    [1920, 1080],
    [1920, 1440],
    [2340, 1080],
    [2400, 1080],
    [2532, 1170],
    [2560, 1440],
    [3200, 1440],
    [3840, 2160],
    [4032, 3024],
    [4096, 2160],
].flatMap(([w, h]) => [
    [w, h],
    [h, w],
]);

const BOOLS = [false, true];

describe("getProcessGeometry matches ARnft bit for bit (oracle)", () => {
    it.each(COMMON)("common resolution %i x %i, every flag combination", (vw, vh) => {
        for (const rotatePortrait of BOOLS) {
            for (const floor of BOOLS) {
                expect(getProcessGeometry(vw, vh, rotatePortrait, floor)).toStrictEqual(
                    arnftGetProcessGeometry(vw, vh, rotatePortrait, floor),
                );
            }
        }
    });

    it("dense grid 1..2048 (step 13) x 1..2048 (step 17), every flag combination", () => {
        let checked = 0;
        for (let vw = 1; vw <= 2048; vw += 13) {
            for (let vh = 1; vh <= 2048; vh += 17) {
                for (const rotatePortrait of BOOLS) {
                    for (const floor of BOOLS) {
                        const actual = getProcessGeometry(vw, vh, rotatePortrait, floor);
                        const expected = arnftGetProcessGeometry(vw, vh, rotatePortrait, floor);
                        if (
                            actual.rot !== expected.rot ||
                            !Object.is(actual.w, expected.w) ||
                            !Object.is(actual.h, expected.h) ||
                            !Object.is(actual.pw, expected.pw) ||
                            !Object.is(actual.ph, expected.ph) ||
                            !Object.is(actual.ox, expected.ox) ||
                            !Object.is(actual.oy, expected.oy)
                        ) {
                            expect.fail(
                                `mismatch for ${vw}x${vh} rotatePortrait=${rotatePortrait} floor=${floor}`,
                            );
                        }
                        checked++;
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(70_000);
    });

    it("random sizes and flags (property)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8192 }),
                fc.integer({ min: 1, max: 8192 }),
                fc.boolean(),
                fc.boolean(),
                (vw, vh, rotatePortrait, floor) => {
                    expect(getProcessGeometry(vw, vh, rotatePortrait, floor)).toStrictEqual(
                        arnftGetProcessGeometry(vw, vh, rotatePortrait, floor),
                    );
                },
            ),
            { numRuns: 5000 },
        );
    });
});

const size = fc.integer({ min: 1, max: 8192 });

describe("getProcessGeometry invariants (floored, as drawn by CameraView)", () => {
    it("every value is a finite non-negative integer", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                const g = getProcessGeometry(vw, vh, rotatePortrait, true);
                for (const value of [g.w, g.h, g.pw, g.ph, g.ox, g.oy]) {
                    expect(Number.isInteger(value)).toBe(true);
                    expect(value).toBeGreaterThanOrEqual(0);
                }
            }),
            { numRuns: 3000 },
        );
    });

    it("the frame is 4:3 landscape of at most 320 x 240 and at least 318 x 239", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                const { pw, ph } = getProcessGeometry(vw, vh, rotatePortrait, true);
                expect(pw).toBeLessThanOrEqual(320);
                expect(pw).toBeGreaterThanOrEqual(318);
                expect(ph).toBeLessThanOrEqual(240);
                expect(ph).toBeGreaterThanOrEqual(239);
                expect(Math.abs(pw * 3 - ph * 4)).toBeLessThanOrEqual(6);
            }),
            { numRuns: 3000 },
        );
    });

    it("the video footprint fits inside the frame and is centred (+-1 px)", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                const { w, h, pw, ph, ox, oy } = getProcessGeometry(vw, vh, rotatePortrait, true);
                expect(ox + w).toBeLessThanOrEqual(pw);
                expect(oy + h).toBeLessThanOrEqual(ph);
                expect(Math.abs(pw - w - ox - ox)).toBeLessThanOrEqual(1);
                expect(Math.abs(ph - h - oy - oy)).toBeLessThanOrEqual(1);
            }),
            { numRuns: 3000 },
        );
    });

    it("the footprint touches the frame on its long side", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                const { w, h, pw, ph } = getProcessGeometry(vw, vh, rotatePortrait, true);
                expect(pw - w <= 2 || ph - h <= 1).toBe(true);
            }),
            { numRuns: 3000 },
        );
    });

    it("the footprint keeps the video aspect ratio (within flooring error)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 64, max: 8192 }),
                fc.integer({ min: 64, max: 8192 }),
                fc.boolean(),
                (vw, vh, rotatePortrait) => {
                    const g = getProcessGeometry(vw, vh, rotatePortrait, true);
                    const [V, H] = g.rot ? [vh, vw] : [vw, vh];
                    // w/h ~ V/H  <=>  w*H ~ h*V, with one pixel of flooring on each side
                    expect(Math.abs(g.w * H - g.h * V)).toBeLessThanOrEqual(V + H);
                },
            ),
            { numRuns: 3000 },
        );
    });

    it("rotation happens exactly when rotatePortrait is set and the video is portrait", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                expect(getProcessGeometry(vw, vh, rotatePortrait, true).rot).toBe(
                    rotatePortrait && vh > vw,
                );
            }),
        );
    });

    it("without rotation, rotatePortrait never changes the geometry", () => {
        fc.assert(
            fc.property(size, size, (vw, vh) => {
                fc.pre(vh <= vw);
                expect(getProcessGeometry(vw, vh, true, true)).toEqual(
                    getProcessGeometry(vw, vh, false, true),
                );
            }),
        );
    });

    it("is scale invariant for exact multiples", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1024 }),
                fc.integer({ min: 1, max: 1024 }),
                fc.integer({ min: 2, max: 8 }),
                fc.boolean(),
                (vw, vh, k, rotatePortrait) => {
                    const a = getProcessGeometry(vw, vh, rotatePortrait, false);
                    const b = getProcessGeometry(vw * k, vh * k, rotatePortrait, false);
                    for (const key of ["w", "h", "pw", "ph", "ox", "oy"] as const) {
                        expect(b[key]).toBeCloseTo(a[key], 9);
                    }
                },
            ),
        );
    });

    it("FrameGeometry is structured-cloneable and frozen for any input", () => {
        fc.assert(
            fc.property(size, size, fc.boolean(), (vw, vh, rotatePortrait) => {
                const fg = toFrameGeometry(
                    vw,
                    vh,
                    getProcessGeometry(vw, vh, rotatePortrait, true),
                );
                expect(Object.isFrozen(fg)).toBe(true);
                expect(structuredClone(fg)).toEqual(fg);
            }),
            { numRuns: 500 },
        );
    });
});

describe("known divergence: CameraView floors, ARnft's worker does not", () => {
    // ARnft's NFTWorker sizes the tracker and rescales the projection with the
    // unfloored getWindowSize(), while CameraViewRenderer draws with floored
    // values. For most resolutions they agree; this records where they don't,
    // so the ARnft migration (step 2 of webarkit/ARnft#370) can fix it.
    it.each([
        [720, 1280, false],
        [1170, 2532, false],
        [1080, 2340, true],
    ])("%i x %i rotatePortrait=%s differs between floored and unfloored", (vw, vh, rp) => {
        const floored = getProcessGeometry(vw, vh, rp, true);
        const raw = getProcessGeometry(vw, vh, rp, false);
        expect(floored).not.toEqual(raw);
    });

    it.each([
        [640, 480],
        [1280, 720],
        [1920, 1080],
    ])("%i x %i is identical floored and unfloored", (vw, vh) => {
        expect(getProcessGeometry(vw, vh, false, true)).toEqual(
            getProcessGeometry(vw, vh, false, false),
        );
    });
});
