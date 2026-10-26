/*
 *  frame-source.ts
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

import { getProcessGeometry, toFrameGeometry } from "./geometry";
import type { FrameGeometry, ProcessGeometry } from "./types";

/** What the frame source needs to know about the video. */
export type VideoSource = CanvasImageSource & { videoWidth: number; videoHeight: number };

/**
 * The process canvas: fits the video into the processing frame and produces
 * frames, throttled to a target frame rate. The drawing is ARnft's
 * `CameraViewRenderer.drawFrame()` unchanged.
 */
export class FrameSource {
    public readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly now: () => number;

    private vw = 0;
    private vh = 0;
    private g: ProcessGeometry = { rot: false, w: 0, h: 0, pw: 0, ph: 0, ox: 0, oy: 0 };
    private frameGeometry: FrameGeometry | null = null;

    private cache: Uint8ClampedArray | null = null;
    private cacheStale = false;
    private lastCapture = -Infinity;
    private frameCount = 0;

    /** Maximum number of new frames per second. */
    public targetFrameRate = 60;

    constructor(createCanvas: () => HTMLCanvasElement, now: () => number) {
        this.canvas = createCanvas();
        const context = this.canvas.getContext("2d", { alpha: false, willReadFrequently: true });
        if (context == null) {
            throw new Error("Could not create a 2D canvas context for the process canvas.");
        }
        this.context = context;
        this.now = now;
    }

    /** The current geometry, `null` before the first {@link prepare}. */
    public get geometry(): FrameGeometry | null {
        return this.frameGeometry;
    }

    /** Number of frames captured so far. */
    public get frame(): number {
        return this.frameCount;
    }

    /** The video size used by the current geometry. */
    public get videoSize(): { width: number; height: number } {
        return { width: this.vw, height: this.vh };
    }

    /**
     * Compute the geometry for a video of size vw x vh, size the process canvas
     * and clear it to black (the letterbox). Returns the new geometry.
     */
    public prepare(vw: number, vh: number, rotatePortrait: boolean): FrameGeometry {
        this.vw = vw;
        this.vh = vh;
        this.g = getProcessGeometry(vw, vh, rotatePortrait, true);
        this.frameGeometry = toFrameGeometry(vw, vh, this.g);

        this.canvas.width = this.g.pw;
        this.canvas.height = this.g.ph;

        this.context.fillStyle = "black";
        this.context.fillRect(0, 0, this.g.pw, this.g.ph);

        // the cached pixels belong to the previous geometry: the next call draws a new frame
        this.lastCapture = -Infinity;
        return this.frameGeometry;
    }

    /** Forget the captured frames, e.g. before a new stream is opened. */
    public reset(): void {
        this.cache = null;
        this.cacheStale = false;
        this.lastCapture = -Infinity;
    }

    /**
     * Draws the current video frame onto the process canvas. When `rot` is true
     * (portrait video with rotatePortrait opted in) the frame is rotated 90
     * degrees clockwise so it fills the process canvas without letterboxing; the
     * destination footprint (ox, oy, w, h) is identical to the non-rotated case.
     * See https://github.com/webarkit/ARnft/issues/344
     */
    private drawFrame(video: VideoSource): void {
        const ctx = this.context;
        const { rot, w, h, pw, ox, oy } = this.g;
        if (rot) {
            ctx.save();
            ctx.translate(pw, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(video, 0, 0, this.vw, this.vh, oy, pw - ox - w, h, w);
            ctx.restore();
        } else {
            ctx.drawImage(video, 0, 0, this.vw, this.vh, ox, oy, w, h);
        }
    }

    /** Draw a new frame when the throttle interval has elapsed. */
    private captureIfDue(video: VideoSource): void {
        const now = this.now();
        if (now - this.lastCapture > 1000 / this.targetFrameRate) {
            this.drawFrame(video);
            this.lastCapture = now;
            this.frameCount++;
            this.cacheStale = true;
        }
    }

    /**
     * The current frame as `ImageData` of frameWidth x frameHeight. A new frame is
     * drawn at most `targetFrameRate` times per second; in between, a copy of the
     * last frame is returned.
     */
    public getImage(video: VideoSource): ImageData {
        this.captureIfDue(video);
        const { pw, ph } = this.g;
        if (this.cacheStale || this.cache == null) {
            const data = this.context.getImageData(0, 0, pw, ph).data;
            if (this.cache == null || this.cache.length !== data.length) {
                this.cache = data;
            } else {
                this.cache.set(data);
            }
            this.cacheStale = false;
        }
        return new ImageData(this.cache.slice(), pw, ph);
    }

    /**
     * The current frame as an `ImageBitmap`, throttled like {@link getImage} and
     * sharing its frame counter.
     */
    public getImageBitmap(
        video: VideoSource,
        createImageBitmap: (source: HTMLCanvasElement) => Promise<ImageBitmap>,
    ): Promise<ImageBitmap> {
        this.captureIfDue(video);
        return createImageBitmap(this.canvas);
    }
}
