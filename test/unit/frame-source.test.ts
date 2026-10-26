/*
 *  frame-source.test.ts
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

import { beforeEach, describe, expect, it } from "vitest";
import { FrameSource, type VideoSource } from "../../src/frame-source";
import { FakeCanvas, FakeClock } from "../fakes/media";

const video = { videoWidth: 0, videoHeight: 0 } as unknown as VideoSource;

function setup(): { canvas: FakeCanvas; clock: FakeClock; source: FrameSource } {
    const canvas = new FakeCanvas();
    const clock = new FakeClock();
    const source = new FrameSource(() => canvas.asCanvas(), clock.now);
    return { canvas, clock, source };
}

describe("FrameSource — process canvas", () => {
    it("asks for an opaque, read-frequently 2D context", () => {
        const { canvas } = setup();
        expect(canvas.context.options).toEqual({ alpha: false, willReadFrequently: true });
    });

    it("throws when no 2D context is available", () => {
        const canvas = new FakeCanvas();
        canvas.contextAvailable = false;
        expect(
            () =>
                new FrameSource(
                    () => canvas.asCanvas(),
                    () => 0,
                ),
        ).toThrow(/2D canvas/);
    });

    it("prepare sizes the canvas and clears it to black", () => {
        const { canvas, source } = setup();
        const g = source.prepare(1280, 720, false);
        expect(canvas.width).toBe(320);
        expect(canvas.height).toBe(240);
        expect(canvas.context.calls).toContainEqual({
            op: "fillRect",
            args: [0, 0, 320, 240],
            fillStyle: "black",
        });
        expect(g).toMatchObject({ frameWidth: 320, frameHeight: 240, x: 0, y: 30, height: 180 });
        expect(source.geometry).toBe(g);
        expect(source.videoSize).toEqual({ width: 1280, height: 720 });
    });

    it("geometry is null before prepare", () => {
        expect(setup().source.geometry).toBeNull();
    });
});

describe("FrameSource — drawing (ARnft drawFrame, unchanged)", () => {
    it("landscape: one drawImage into the letterbox footprint", () => {
        const { canvas, source } = setup();
        source.prepare(1280, 720, false);
        canvas.context.calls = [];
        source.getImage(video);
        expect(canvas.context.calls.filter((c) => c.op !== "getImageData")).toEqual([
            { op: "drawImage", args: [0, 0, 1280, 720, 0, 30, 320, 180] },
        ]);
    });

    it("portrait without rotatePortrait: letterboxed left and right", () => {
        const { canvas, source } = setup();
        source.prepare(720, 1280, false);
        canvas.context.calls = [];
        source.getImage(video);
        expect(canvas.context.calls[0]).toEqual({
            op: "drawImage",
            args: [0, 0, 720, 1280, 92, 0, 135, 240],
        });
    });

    it("portrait with rotatePortrait: rotated 90 degrees clockwise around the frame", () => {
        const { canvas, source } = setup();
        source.prepare(720, 1280, true);
        canvas.context.calls = [];
        source.getImage(video);
        // ox=0, oy=30, w=320, h=180, pw=320 -> drawImage(v, 0,0,vw,vh, oy, pw-ox-w, h, w)
        expect(canvas.context.calls.slice(0, 5)).toEqual([
            { op: "save" },
            { op: "translate", x: 320, y: 0 },
            { op: "rotate", angle: Math.PI / 2 },
            { op: "drawImage", args: [0, 0, 720, 1280, 30, 0, 180, 320] },
            { op: "restore" },
        ]);
    });

    it("square video with rotatePortrait is not rotated", () => {
        const { canvas, source } = setup();
        source.prepare(720, 720, true);
        canvas.context.calls = [];
        source.getImage(video);
        expect(canvas.context.calls.some((c) => c.op === "rotate")).toBe(false);
    });
});

describe("FrameSource — throttling", () => {
    let s: ReturnType<typeof setup>;
    beforeEach(() => {
        s = setup();
        s.source.prepare(640, 480, false);
    });

    it("the first call always captures", () => {
        s.source.getImage(video);
        expect(s.source.frame).toBe(1);
        expect(s.canvas.context.draws).toBe(1);
    });

    it("the first call captures even when the clock starts at 0", () => {
        s.clock.t = 0;
        s.source.getImage(video);
        expect(s.source.frame).toBe(1);
    });

    it.each([
        [60, 1000 / 60],
        [30, 1000 / 30],
        [15, 1000 / 15],
        [1, 1000],
    ])("at %i fps a new frame needs strictly more than %f ms", (fps, interval) => {
        s.clock.t = 0;
        s.source.targetFrameRate = fps;
        s.source.getImage(video);
        s.clock.t = interval;
        s.source.getImage(video);
        expect(s.source.frame).toBe(1); // exactly the interval: not yet (ARnft uses ">")
        s.clock.t = interval + 0.001;
        s.source.getImage(video);
        expect(s.source.frame).toBe(2);
    });

    it("produces about targetFrameRate frames per simulated second", () => {
        for (const fps of [15, 24, 30, 60]) {
            const t = setup();
            t.source.prepare(640, 480, false);
            t.source.targetFrameRate = fps;
            // poll at 240 Hz for one second
            for (let i = 0; i < 240; i++) {
                t.source.getImage(video);
                t.clock.advance(1000 / 240);
            }
            expect(t.source.frame).toBeGreaterThanOrEqual(fps - 1);
            expect(t.source.frame).toBeLessThanOrEqual(fps + 1);
        }
    });

    it("Infinity captures whenever the clock advanced, not on duplicate timestamps", () => {
        s.source.targetFrameRate = Infinity;
        s.source.getImage(video);
        s.source.getImage(video);
        expect(s.source.frame).toBe(1);
        s.clock.advance(0.01);
        s.source.getImage(video);
        expect(s.source.frame).toBe(2);
    });

    it("a clock going backwards never produces a new frame", () => {
        s.source.getImage(video);
        s.clock.advance(-5000);
        s.source.getImage(video);
        expect(s.source.frame).toBe(1);
    });

    it("between captures returns copies of the same cached frame without reading back", () => {
        const a = s.source.getImage(video);
        const reads = s.canvas.context.calls.filter((c) => c.op === "getImageData").length;
        const b = s.source.getImage(video);
        expect(s.canvas.context.calls.filter((c) => c.op === "getImageData").length).toBe(reads);
        expect(b.data.length).toBe(a.data.length);
        expect(b.data[0]).toBe(a.data[0]);
        expect(b.data === a.data).toBe(false); // a fresh copy each time, as ARnft
        b.data[0] = 99;
        expect(s.source.getImage(video).data[0]).not.toBe(99);
    });

    it("returns ImageData of frameWidth x frameHeight", () => {
        const image = s.source.getImage(video);
        expect(image.width).toBe(320);
        expect(image.height).toBe(240);
        expect(image.data.length).toBe(320 * 240 * 4);
    });
});

describe("FrameSource — geometry changes", () => {
    it("draws a new frame right after prepare, with the new geometry", () => {
        const { canvas, source } = setup();
        source.prepare(1280, 720, false);
        source.getImage(video);
        source.prepare(720, 1280, false);
        canvas.context.calls = [];
        source.getImage(video); // same timestamp: still a new frame
        expect(source.frame).toBe(2);
        expect(canvas.context.calls[0]).toMatchObject({ op: "drawImage" });
    });

    // Regression (ARnft): imageDataCache.set() with a different frame size throws
    // RangeError, and new ImageData(cache.slice(), pw, ph) throws IndexSizeError.
    // An iPhone 12-15 portrait stream (1170x2532) gives a 318x239 frame, its
    // landscape stream (2532x1170) a 320x240 one: rotating the phone crashed getImage().
    it("survives frame size changes 320x240 -> 318x239 -> 320x240 (iPhone rotation)", () => {
        const { source } = setup();
        source.prepare(2532, 1170, false);
        expect(source.getImage(video).data.length).toBe(320 * 240 * 4);
        source.prepare(1170, 2532, false);
        const portrait = source.getImage(video);
        expect([portrait.width, portrait.height]).toEqual([318, 239]);
        expect(portrait.data.length).toBe(318 * 239 * 4);
        source.prepare(2532, 1170, false);
        expect(source.getImage(video).data.length).toBe(320 * 240 * 4);
    });

    it("reset forgets the cache and the throttle but keeps the frame counter", () => {
        const { source, canvas } = setup();
        source.prepare(640, 480, false);
        source.getImage(video);
        source.reset();
        source.getImage(video);
        expect(source.frame).toBe(2);
        expect(canvas.context.draws).toBe(2);
    });
});

describe("FrameSource — ImageBitmap", () => {
    it("draws when due, shares the frame counter, and passes the process canvas", async () => {
        const { source, canvas, clock } = setup();
        source.prepare(640, 480, false);
        const seen: unknown[] = [];
        const create = async (c: HTMLCanvasElement) => {
            seen.push(c);
            return { width: c.width, height: c.height } as ImageBitmap;
        };
        await source.getImageBitmap(video, create);
        expect(source.frame).toBe(1);
        expect(seen[0]).toBe(canvas);
        await source.getImageBitmap(video, create);
        expect(source.frame).toBe(1);
        clock.advance(100);
        await source.getImageBitmap(video, create);
        expect(source.frame).toBe(2);
    });

    it("getImage after a bitmap capture returns that frame, read back lazily", async () => {
        const { source, canvas, clock } = setup();
        source.prepare(640, 480, false);
        const reads = () => canvas.context.calls.filter((c) => c.op === "getImageData").length;
        expect(source.getImage(video).data[0]).toBe(1); // draw 1
        clock.advance(100);
        const before = reads();
        await source.getImageBitmap(video, async () => ({}) as ImageBitmap); // draw 2
        expect(reads()).toBe(before); // the bitmap path never reads pixels back
        const image = source.getImage(video); // throttled: no draw, but a read back
        expect(source.frame).toBe(2);
        expect(image.data[0]).toBe(2);
        expect(reads()).toBe(before + 1);
    });
});
