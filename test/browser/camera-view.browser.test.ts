/*
 *  camera-view.browser.test.ts
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

import { afterEach, describe, expect, it } from "vitest";
import { CameraView } from "../../src/CameraView";
import type { FrameGeometry } from "../../src/types";

interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

const RED: Rgba = { r: 255, g: 0, b: 0, a: 255 };
const GREEN: Rgba = { r: 0, g: 255, b: 0, a: 255 };
const BLUE: Rgba = { r: 0, g: 0, b: 255, a: 255 };
const YELLOW: Rgba = { r: 255, g: 255, b: 0, a: 255 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 255 };

/**
 * Paint four solid-colour quadrants on the source canvas:
 *   top-left = red, top-right = green, bottom-left = blue, bottom-right = yellow.
 */
function paintQuadrants(canvas: HTMLCanvasElement, width: number, height: number): void {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const hw = width / 2;
    const hh = height / 2;
    ctx.fillStyle = "rgb(255, 0, 0)";
    ctx.fillRect(0, 0, hw, hh);
    ctx.fillStyle = "rgb(0, 255, 0)";
    ctx.fillRect(hw, 0, hw, hh);
    ctx.fillStyle = "rgb(0, 0, 255)";
    ctx.fillRect(0, hh, hw, hh);
    ctx.fillStyle = "rgb(255, 255, 0)";
    ctx.fillRect(hw, hh, hw, hh);
}

function readPixel(image: ImageData, x: number, y: number): Rgba {
    const idx = (y * image.width + x) * 4;
    return {
        r: image.data[idx],
        g: image.data[idx + 1],
        b: image.data[idx + 2],
        a: image.data[idx + 3],
    };
}

/** MediaStream encoding via captureStream can shift channel values slightly; allow a small tolerance. */
function expectColor(image: ImageData, x: number, y: number, expected: Rgba, tol = 25): void {
    const actual = readPixel(image, x, y);
    expect(
        Math.abs(actual.r - expected.r),
        `R at (${x},${y}) got ${JSON.stringify(actual)}`,
    ).toBeLessThanOrEqual(tol);
    expect(
        Math.abs(actual.g - expected.g),
        `G at (${x},${y}) got ${JSON.stringify(actual)}`,
    ).toBeLessThanOrEqual(tol);
    expect(
        Math.abs(actual.b - expected.b),
        `B at (${x},${y}) got ${JSON.stringify(actual)}`,
    ).toBeLessThanOrEqual(tol);
    expect(actual.a).toBe(255);
}

interface LiveRig {
    sourceCanvas: HTMLCanvasElement;
    video: HTMLVideoElement;
    view: CameraView;
    repaint: (width?: number, height?: number) => void;
    cleanup: () => void;
}

async function createLiveRig(
    width: number,
    height: number,
    rotatePortrait = false,
): Promise<LiveRig> {
    const sourceCanvas = document.createElement("canvas");
    paintQuadrants(sourceCanvas, width, height);

    const stream = sourceCanvas.captureStream(60);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    document.body.appendChild(video);

    let rafId = 0;
    const pump = (): void => {
        // Re-touch the source canvas every frame so captureStream keeps pushing frames
        const ctx = sourceCanvas.getContext("2d")!;
        ctx.fillStyle = "rgb(255, 0, 0)";
        ctx.fillRect(0, 0, 2, 2);
        rafId = requestAnimationFrame(pump);
    };
    rafId = requestAnimationFrame(pump);

    const mediaDevices: Pick<MediaDevices, "getUserMedia" | "enumerateDevices"> = {
        enumerateDevices: async () => [
            {
                deviceId: "canvas-cam",
                groupId: "g0",
                kind: "videoinput",
                label: "Canvas Test Camera",
                toJSON() {
                    return this;
                },
            } as MediaDeviceInfo,
        ],
        getUserMedia: async () => stream,
    };

    const view = new CameraView(video, {
        mediaDevices: mediaDevices as MediaDevices,
        // Allow every getImage() in the test to draw a fresh frame
        now: () => performance.now(),
    });

    await view.initialize({
        rotatePortrait,
        targetFrameRate: Infinity,
    });
    await video.play();
    // Wait until the video has decoded at least one non-black frame
    await waitForVideoFrame(video, sourceCanvas);

    return {
        sourceCanvas,
        video,
        view,
        repaint: (w = sourceCanvas.width, h = sourceCanvas.height) => {
            paintQuadrants(sourceCanvas, w, h);
        },
        cleanup: () => {
            cancelAnimationFrame(rafId);
            view.destroy();
            stream.getTracks().forEach((t) => t.stop());
            video.remove();
        },
    };
}

async function waitForVideoFrame(
    video: HTMLVideoElement,
    sourceCanvas: HTMLCanvasElement,
): Promise<void> {
    const probe = document.createElement("canvas");
    probe.width = 16;
    probe.height = 16;
    const pctx = probe.getContext("2d", { willReadFrequently: true })!;
    for (let i = 0; i < 60; i++) {
        paintQuadrants(sourceCanvas, sourceCanvas.width, sourceCanvas.height);
        pctx.drawImage(video, 0, 0, 16, 16);
        const d = pctx.getImageData(2, 2, 1, 1).data;
        if (d[0] > 200 && d[1] < 40 && d[2] < 40) {
            return;
        }
        await new Promise((r) => setTimeout(r, 20));
    }
}

const cleanups: Array<() => void> = [];
afterEach(() => {
    while (cleanups.length > 0) {
        cleanups.pop()!();
    }
});

describe("CameraView in a real browser (Chromium)", () => {
    it("4:3 landscape (640x480) fills the 320x240 frame with no letterbox", async () => {
        const rig = await createLiveRig(640, 480, false);
        cleanups.push(rig.cleanup);

        expect(rig.view.geometry).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 640,
            videoHeight: 480,
            x: 0,
            y: 0,
            width: 320,
            height: 240,
            rotated: false,
        });

        const img = rig.view.getImage();
        expectColor(img, 80, 60, RED);
        expectColor(img, 240, 60, GREEN);
        expectColor(img, 80, 180, BLUE);
        expectColor(img, 240, 180, YELLOW);
    });

    it("16:9 landscape (640x360) is letterboxed top and bottom with black bars", async () => {
        const rig = await createLiveRig(640, 360, false);
        cleanups.push(rig.cleanup);

        expect(rig.view.geometry).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 640,
            videoHeight: 360,
            x: 0,
            y: 30,
            width: 320,
            height: 180,
            rotated: false,
        });

        const img = rig.view.getImage();
        // Top and bottom letterbox bars
        expectColor(img, 160, 10, BLACK, 5);
        expectColor(img, 160, 225, BLACK, 5);
        // Quadrants inside [0..320, 30..210]
        expectColor(img, 80, 75, RED);
        expectColor(img, 240, 75, GREEN);
        expectColor(img, 80, 165, BLUE);
        expectColor(img, 240, 165, YELLOW);
    });

    it("9:16 portrait (360x640) without rotatePortrait is letterboxed left and right", async () => {
        const rig = await createLiveRig(360, 640, false);
        cleanups.push(rig.cleanup);

        expect(rig.view.geometry).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 360,
            videoHeight: 640,
            x: 92,
            y: 0,
            width: 135,
            height: 240,
            rotated: false,
        });

        const img = rig.view.getImage();
        // Left and right pillarbox bars
        expectColor(img, 40, 120, BLACK, 5);
        expectColor(img, 280, 120, BLACK, 5);
        // Quadrants inside [92..227, 0..240]
        expectColor(img, 125, 60, RED);
        expectColor(img, 195, 60, GREEN);
        expectColor(img, 125, 180, BLUE);
        expectColor(img, 195, 180, YELLOW);
    });

    it("9:16 portrait (360x640) with rotatePortrait=true rotates 90 deg clockwise (ARnft #344)", async () => {
        const rig = await createLiveRig(360, 640, true);
        cleanups.push(rig.cleanup);

        expect(rig.view.geometry).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 360,
            videoHeight: 640,
            x: 0,
            y: 30,
            width: 320,
            height: 180,
            rotated: true,
        });

        const img = rig.view.getImage();
        // Top and bottom letterbox bars
        expectColor(img, 160, 10, BLACK, 5);
        expectColor(img, 160, 225, BLACK, 5);
        // 90 deg clockwise: video top edge lands on canvas right edge:
        //   top-left (RED) -> top-right (240, 75)
        //   top-right (GREEN) -> bottom-right (240, 165)
        //   bottom-left (BLUE) -> top-left (80, 75)
        //   bottom-right (YELLOW) -> bottom-left (80, 165)
        expectColor(img, 240, 75, RED);
        expectColor(img, 240, 165, GREEN);
        expectColor(img, 80, 75, BLUE);
        expectColor(img, 80, 165, YELLOW);
    });

    it("getImageBitmap() returns an ImageBitmap with the same pixels as getImage()", async () => {
        const rig = await createLiveRig(640, 360, false);
        cleanups.push(rig.cleanup);

        const bitmap = await rig.view.getImageBitmap();
        expect(bitmap.width).toBe(320);
        expect(bitmap.height).toBe(240);

        const copy = document.createElement("canvas");
        copy.width = bitmap.width;
        copy.height = bitmap.height;
        const ctx = copy.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const bmpData = ctx.getImageData(0, 0, 320, 240);
        expectColor(bmpData, 160, 10, BLACK, 5);
        expectColor(bmpData, 80, 75, RED);
        expectColor(bmpData, 240, 75, GREEN);
        expectColor(bmpData, 80, 165, BLUE);
        expectColor(bmpData, 240, 165, YELLOW);
    });

    it("recomputes geometry and fires geometrychange when the live video stream resizes", async () => {
        const rig = await createLiveRig(640, 360, true);
        cleanups.push(rig.cleanup);

        const seen = new Promise<FrameGeometry>((resolve) => {
            rig.view.addEventListener("geometrychange", (e) => resolve(e.detail), { once: true });
        });

        rig.repaint(360, 640);
        const detail = await seen;
        expect(detail).toEqual({
            frameWidth: 320,
            frameHeight: 240,
            videoWidth: 360,
            videoHeight: 640,
            x: 0,
            y: 30,
            width: 320,
            height: 180,
            rotated: true,
        });
    });
});
