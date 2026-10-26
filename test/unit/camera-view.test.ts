/*
 *  camera-view.test.ts
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

import { describe, expect, it, vi } from "vitest";
import { CameraView } from "../../src/CameraView";
import { CameraViewError, type CameraViewErrorCode } from "../../src/errors";
import type { FrameGeometry } from "../../src/types";
import { createHarness } from "../fakes/harness";
import { flush } from "../fakes/media";

function expectCode(fn: () => unknown, code: CameraViewErrorCode): void {
    try {
        fn();
        expect.fail(`expected CameraViewError(${code})`);
    } catch (error) {
        expect(error).toBeInstanceOf(CameraViewError);
        expect((error as CameraViewError).code).toBe(code);
    }
}

async function expectAsyncCode(
    promise: Promise<unknown>,
    code: CameraViewErrorCode,
): Promise<void> {
    try {
        await promise;
        expect.fail(`expected CameraViewError(${code})`);
    } catch (error) {
        expect(error).toBeInstanceOf(CameraViewError);
        expect((error as CameraViewError).code).toBe(code);
    }
}

describe("CameraView — lifecycle and state machine", () => {
    it("starts in idle and transitions idle -> initializing -> ready -> destroyed", async () => {
        const { view, media, video } = createHarness();
        expect(view.state).toBe("idle");
        expect(view.video).toBe(video.asVideo());
        expect(view.frame).toBe(0);
        expect(view.getFrame()).toBe(0);
        expect(view.width).toBe(0);
        expect(view.height).toBe(0);
        expect(view.facing).toBe("environment");
        expect(view.rotated).toBe(false);

        const release = media.holdNextGetUserMedia();
        const initPromise = view.initialize({ facingMode: "user", targetFrameRate: 30 });
        expect(view.state).toBe("initializing");
        expect(view.facing).toBe("user");

        release();
        await initPromise;
        expect(view.state).toBe("ready");
        expect(view.width).toBe(640);
        expect(view.height).toBe(480);
        expect(view.geometry).toEqual({
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

        view.destroy();
        expect(view.state).toBe("destroyed");
        expect(media.streams[0].stopped).toBe(true);
        expect(video.srcObject).toBeNull();

        // destroy() is idempotent
        view.destroy();
        expect(view.state).toBe("destroyed");
    });

    it("throws NOT_INITIALIZED when accessing geometry, frames or canvasProcess before ready", async () => {
        const { view, media } = createHarness();
        expectCode(() => view.geometry, "NOT_INITIALIZED");
        expectCode(() => view.getImage(), "NOT_INITIALIZED");
        expectCode(() => view.image, "NOT_INITIALIZED");
        expectCode(() => view.canvasProcess, "NOT_INITIALIZED");
        await expectAsyncCode(view.getImageBitmap(), "NOT_INITIALIZED");

        const release = media.holdNextGetUserMedia();
        const initPromise = view.initialize();
        expectCode(() => view.geometry, "NOT_INITIALIZED");
        expectCode(() => view.getImage(), "NOT_INITIALIZED");
        release();
        await initPromise;
        expect(view.canvasProcess).toBeDefined();
    });

    it("throws ALREADY_INITIALIZED when initialize() is called in initializing or ready", async () => {
        const { view, media } = createHarness();
        const release = media.holdNextGetUserMedia();
        const p = view.initialize();
        await expectAsyncCode(view.initialize(), "ALREADY_INITIALIZED");
        release();
        await p;
        await expectAsyncCode(view.initialize(), "ALREADY_INITIALIZED");
    });

    it("throws DESTROYED on every operation after destroy()", async () => {
        const { view } = createHarness();
        await view.initialize();
        view.destroy();

        expectCode(() => view.geometry, "DESTROYED");
        expectCode(() => view.getImage(), "DESTROYED");
        expectCode(() => view.image, "DESTROYED");
        await expectAsyncCode(view.getImageBitmap(), "DESTROYED");
        await expectAsyncCode(view.initialize(), "DESTROYED");
    });

    it("returns to idle when getUserMedia fails and allows retrying initialize()", async () => {
        const { view, media, video } = createHarness({
            devices: [{ deviceId: "d0", label: "Cam", failWith: "NotReadableError" }],
            defaultFailsWith: "NotAllowedError",
        });

        await expect(view.initialize()).rejects.toMatchObject({ name: "NotAllowedError" });
        expect(view.state).toBe("idle");
        expect(video.srcObject).toBeNull();

        // Fix scenario and retry on the same instance
        (
            media as unknown as { scenario: { defaultFailsWith?: string } }
        ).scenario.defaultFailsWith = undefined;
        await view.initialize();
        expect(view.state).toBe("ready");
    });

    it("throws NOT_SUPPORTED when mediaDevices or getUserMedia is missing", async () => {
        const { view } = createHarness(undefined, { mediaDevices: undefined });
        await expectAsyncCode(view.initialize(), "NOT_SUPPORTED");
        expect(view.state).toBe("idle");
    });

    it("throws INVALID_OPTIONS without touching mediaDevices", async () => {
        const { view, media } = createHarness();
        await expectAsyncCode(view.initialize({ targetFrameRate: -5 }), "INVALID_OPTIONS");
        expect(media.getUserMediaCalls).toHaveLength(0);
        expect(view.state).toBe("idle");
    });
});

describe("CameraView — races and edge cases during initialize()", () => {
    it("destroy() while getUserMedia is pending stops the late stream and rejects DESTROYED", async () => {
        const { view, media, video } = createHarness();
        const release = media.holdNextGetUserMedia();
        const p = view.initialize();

        view.destroy();
        expect(view.state).toBe("destroyed");

        release();
        await expectAsyncCode(p, "DESTROYED");
        expect(media.streams[0].stopped).toBe(true);
        expect(video.srcObject).toBeNull();
    });

    it("destroy() while waiting for loadedmetadata stops the stream and rejects DESTROYED", async () => {
        const { view, media, video } = createHarness();
        video.autoMetadata = false;
        const p = view.initialize();
        await flush();
        expect(media.streams).toHaveLength(1);

        view.destroy();
        await expectAsyncCode(p, "DESTROYED");
        expect(media.streams[0].stopped).toBe(true);
        expect(video.srcObject).toBeNull();
    });

    it("destroy() when getUserMedia rejects still reports DESTROYED with the original cause", async () => {
        const { view, media } = createHarness({
            devices: [],
            defaultFailsWith: "NotAllowedError",
        });
        const release = media.holdNextGetUserMedia();
        const p = view.initialize();
        view.destroy();
        release();
        try {
            await p;
            expect.fail("expected rejection");
        } catch (error) {
            expect(error).toBeInstanceOf(CameraViewError);
            expect((error as CameraViewError).code).toBe("DESTROYED");
            expect((error as CameraViewError).cause).toMatchObject({ name: "NotAllowedError" });
        }
    });

    it("waits for a non-zero video size when loadedmetadata fires with 0x0 (Android WebView)", async () => {
        const { view, video } = createHarness();
        video.metadataSize = { width: 0, height: 0 };

        let settled = false;
        const p = view.initialize().then(() => {
            settled = true;
        });
        await flush();
        expect(settled).toBe(false);
        expect(view.state).toBe("initializing");

        // Still 0x0 on a spurious resize: keep waiting
        video.resize(0, 0);
        await flush();
        expect(settled).toBe(false);

        // Real size arrives on resize
        video.resize(1280, 720);
        await p;
        expect(view.state).toBe("ready");
        expect(view.geometry).toMatchObject({
            videoWidth: 1280,
            videoHeight: 720,
            frameWidth: 320,
            frameHeight: 240,
            x: 0,
            y: 30,
            width: 320,
            height: 180,
        });
    });

    it("cleans up video.srcObject if preparing the canvas throws", async () => {
        const { view, canvas, media, video } = createHarness();
        canvas.contextAvailable = false;
        await expect(view.initialize()).rejects.toThrow(/2D canvas/);
        expect(view.state).toBe("idle");
        expect(media.streams[0].stopped).toBe(true);
        expect(video.srcObject).toBeNull();
    });
});

describe("CameraView — events: geometrychange and ended", () => {
    it("dispatches geometrychange on video resize and ignores 0 or unchanged sizes", async () => {
        const { view, video } = createHarness({
            devices: [{ deviceId: "d0", label: "Cam", width: 1280, height: 720 }],
        });
        await view.initialize({ rotatePortrait: true });
        expect(view.rotated).toBe(false);

        const events: FrameGeometry[] = [];
        view.addEventListener("geometrychange", (e) => events.push(e.detail));

        // Unchanged size: no event
        video.resize(1280, 720);
        // Zero size: no event
        video.resize(0, 720);
        video.resize(1280, 0);
        expect(events).toHaveLength(0);

        // Rotate phone to portrait
        video.resize(720, 1280);
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
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
        expect(view.geometry).toBe(events[0]);
        expect(view.rotated).toBe(true);
        expect(view.width).toBe(720);
        expect(view.height).toBe(1280);
    });

    it("does not dispatch geometrychange on window (scoped to the instance)", async () => {
        const { view, video } = createHarness();
        const windowListener = vi.fn();
        window.addEventListener("videoResize", windowListener);
        window.addEventListener("geometrychange", windowListener);
        try {
            await view.initialize();
            video.resize(1280, 720);
            expect(windowListener).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener("videoResize", windowListener);
            window.removeEventListener("geometrychange", windowListener);
        }
    });

    it("ignores video resize after destroy()", async () => {
        const { view, video } = createHarness();
        await view.initialize();
        const listener = vi.fn();
        view.addEventListener("geometrychange", listener);
        view.destroy();
        video.resize(1280, 720);
        expect(listener).not.toHaveBeenCalled();
    });

    it("transitions to ended on track ended, throws STREAM_ENDED on frame access, and can reopen", async () => {
        const { view, media, video } = createHarness();
        await view.initialize();

        let endedFired = 0;
        view.addEventListener("ended", () => endedFired++);

        media.streams[0].videoTrack.endFromOutside();
        expect(view.state).toBe("ended");
        expect(endedFired).toBe(1);
        expect(video.srcObject).toBeNull();
        // geometry remains readable in ended state
        expect(view.geometry.videoWidth).toBe(640);
        expectCode(() => view.getImage(), "STREAM_ENDED");
        await expectAsyncCode(view.getImageBitmap(), "STREAM_ENDED");

        // Reopen from ended
        await view.initialize({ facingMode: "user" });
        expect(view.state).toBe("ready");
        expect(media.streams).toHaveLength(2);
        expect(view.getImage().width).toBe(320);
    });
});

describe("CameraView — frames and ARnft compatibility accessors", () => {
    it("getImage(), image getter, getImageBitmap() and frame counter work together", async () => {
        const { view, clock, bitmaps } = createHarness();
        await view.initialize({ targetFrameRate: 30 });

        const img1 = view.getImage();
        expect(img1.width).toBe(320);
        expect(img1.height).toBe(240);
        expect(view.frame).toBe(1);
        expect(view.getFrame()).toBe(1);

        // Throttled: image getter returns a fresh copy without incrementing frame
        const img2 = view.image;
        expect(view.frame).toBe(1);
        expect(img2.data === img1.data).toBe(false);

        clock.advance(40);
        const bmp = await view.getImageBitmap();
        expect(bmp).toEqual({ width: 320, height: 240 });
        expect(bitmaps).toHaveLength(1);
        expect(view.frame).toBe(2);
    });

    it("rejects getImageBitmap() with NOT_SUPPORTED when createImageBitmap is missing", async () => {
        const { view } = createHarness(undefined, { createImageBitmap: undefined });
        await view.initialize();
        await expectAsyncCode(view.getImageBitmap(), "NOT_SUPPORTED");
    });

    it("uses the default browser globals when no deps are injected", async () => {
        const { media, video, canvas } = createHarness();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const createSpy = vi
            .spyOn(document, "createElement")
            .mockImplementation(() => canvas.asCanvas());
        (globalThis as Record<string, unknown>).createImageBitmap = async (
            src: HTMLCanvasElement,
        ) => ({ width: src.width, height: src.height }) as ImageBitmap;
        try {
            const view = new CameraView(video.asVideo(), {
                mediaDevices: media.asMediaDevices(),
            });
            await view.initialize({ cameraLabel: "NonExistent" });
            expect(warnSpy).toHaveBeenCalled();
            expect(createSpy).toHaveBeenCalledWith("canvas");
            expect(view.getImage().width).toBe(320);
            expect(await view.getImageBitmap()).toEqual({ width: 320, height: 240 });
            view.destroy();
        } finally {
            warnSpy.mockRestore();
            createSpy.mockRestore();
            delete (globalThis as Record<string, unknown>).createImageBitmap;
        }
    });
});
