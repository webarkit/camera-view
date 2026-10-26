/*
 *  CameraView.ts
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

import { openCameraStream, stopStream } from "./devices";
import { CameraViewError } from "./errors";
import { FrameSource } from "./frame-source";
import {
    buildConstraints,
    DEFAULT_FACING_MODE,
    resolveOptions,
    type ResolvedOptions,
} from "./options";
import type {
    CameraViewDeps,
    CameraViewEventMap,
    CameraViewOptions,
    CameraViewState,
    FrameGeometry,
} from "./types";

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function defaultDeps(): CameraViewDeps {
    const hasNavigator = typeof navigator !== "undefined";
    return {
        mediaDevices: hasNavigator ? navigator.mediaDevices : undefined,
        now: () => performance.now(),
        createCanvas: () => document.createElement("canvas"),
        isMobile: () => hasNavigator && MOBILE_UA.test(navigator.userAgent),
        createImageBitmap:
            typeof createImageBitmap === "function"
                ? (source) => createImageBitmap(source)
                : undefined,
        warn: (...args) => console.warn(...args),
    };
}

export interface CameraView {
    addEventListener<K extends keyof CameraViewEventMap>(
        type: K,
        listener: (this: CameraView, event: CameraViewEventMap[K]) => unknown,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof CameraViewEventMap>(
        type: K,
        listener: (this: CameraView, event: CameraViewEventMap[K]) => unknown,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
    ): void;
}

/**
 * Opens the camera, fits the video into the processing frame and produces
 * frames for a tracker.
 *
 * ```ts
 * const view = new CameraView(videoElement);
 * await view.initialize({ facingMode: "environment", targetFrameRate: 30, rotatePortrait: true });
 * view.geometry;      // FrameGeometry, can be posted to a worker
 * view.getImage();    // ImageData at frameWidth x frameHeight
 * view.addEventListener("geometrychange", (e) => tracker.resize(e.detail));
 * view.destroy();
 * ```
 *
 * Events: `geometrychange` (`CustomEvent<FrameGeometry>`) when the video size
 * changes, e.g. when a phone is rotated; `ended` when the camera track ends
 * (camera unplugged, permission revoked).
 */
export class CameraView extends EventTarget {
    private readonly _video: HTMLVideoElement;
    private readonly deps: CameraViewDeps;
    private source: FrameSource | null = null;

    private _state: CameraViewState = "idle";
    private options: ResolvedOptions | null = null;
    private stream: MediaStream | null = null;
    private track: MediaStreamTrack | null = null;
    /** Bumped by destroy(): an initialize() that sees it change gives up. */
    private generation = 0;
    /** Rejects the pending wait for the video metadata, if any. */
    private cancelWait: ((error: unknown) => void) | null = null;

    private readonly onVideoResize = (): void => this.handleVideoResize();
    private readonly onTrackEnded = (): void => this.handleTrackEnded();

    /**
     * @param video the video element the camera stream is attached to. It should
     * be `autoplay`, `muted` and `playsinline`; CameraView does not call `play()`.
     * @param deps optional dependencies, for tests and advanced use; each one
     * defaults to the browser global.
     */
    constructor(video: HTMLVideoElement, deps: Partial<CameraViewDeps> = {}) {
        super();
        this._video = video;
        this.deps = { ...defaultDeps(), ...deps };
    }

    /** The lifecycle state. */
    public get state(): CameraViewState {
        return this._state;
    }

    /**
     * Where the video sits inside the processing frame. Plain frozen data,
     * structured-cloneable. Still available after the stream has ended.
     * @throws CameraViewError `NOT_INITIALIZED` before `initialize()` resolved,
     * `DESTROYED` after `destroy()`.
     */
    public get geometry(): FrameGeometry {
        this.assertNotDestroyed();
        const geometry = this.source?.geometry;
        if ((this._state !== "ready" && this._state !== "ended") || geometry == null) {
            throw new CameraViewError("NOT_INITIALIZED");
        }
        return geometry;
    }

    /**
     * Open the camera and prepare the processing frame.
     * @throws CameraViewError (`NOT_SUPPORTED`, `INVALID_OPTIONS`,
     * `ALREADY_INITIALIZED`, `DESTROYED`), or the browser's `getUserMedia`
     * error unchanged (`NotAllowedError`, `NotFoundError`, ...).
     */
    public async initialize(options?: CameraViewOptions): Promise<void> {
        this.assertNotDestroyed();
        if (this._state === "initializing" || this._state === "ready") {
            throw new CameraViewError("ALREADY_INITIALIZED");
        }
        const resolved = resolveOptions(options);
        const mediaDevices = this.deps.mediaDevices;
        if (mediaDevices == null || typeof mediaDevices.getUserMedia !== "function") {
            throw new CameraViewError("NOT_SUPPORTED");
        }

        this._state = "initializing";
        this.options = resolved;
        const generation = this.generation;
        const cancelled = (): boolean => generation !== this.generation;
        let stream: MediaStream | null = null;

        try {
            stream = await openCameraStream(
                mediaDevices,
                buildConstraints(resolved),
                resolved.cameraLabel,
                { isMobile: this.deps.isMobile(), warn: this.deps.warn, isCancelled: cancelled },
            );
            if (cancelled()) {
                throw new CameraViewError("DESTROYED");
            }
            this._video.srcObject = stream;
            await this.waitForVideoSize();
            if (cancelled()) {
                throw new CameraViewError("DESTROYED");
            }

            if (this.source == null) {
                this.source = new FrameSource(this.deps.createCanvas, this.deps.now);
            }
            this.source.reset();
            this.source.targetFrameRate = resolved.targetFrameRate;
            this.source.prepare(
                this._video.videoWidth,
                this._video.videoHeight,
                resolved.rotatePortrait,
            );

            this.stream = stream;
            this.track = stream.getVideoTracks()[0] ?? null;
            this._video.addEventListener("resize", this.onVideoResize);
            this.track?.addEventListener("ended", this.onTrackEnded);
            this._state = "ready";
        } catch (error) {
            stopStream(stream);
            if (cancelled()) {
                // destroy() already released the video element and set the state
                throw error instanceof CameraViewError && error.code === "DESTROYED"
                    ? error
                    : new CameraViewError("DESTROYED", undefined, { cause: error });
            }
            if (stream != null && this._video.srcObject === stream) {
                this._video.srcObject = null;
            }
            this._state = "idle";
            throw error;
        }
    }

    /** Resolve once the video has its metadata and a non-zero size. */
    private waitForVideoSize(): Promise<void> {
        const video = this._video;
        return new Promise<void>((resolve, reject) => {
            const cleanup = (): void => {
                video.removeEventListener("loadedmetadata", check);
                video.removeEventListener("resize", check);
                this.cancelWait = null;
            };
            const check = (): void => {
                // some Android WebViews report a zero size at loadedmetadata:
                // keep waiting for the first resize with a real size
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    cleanup();
                    resolve();
                }
            };
            this.cancelWait = (error) => {
                cleanup();
                reject(error);
            };
            video.addEventListener("loadedmetadata", check);
            video.addEventListener("resize", check);
        });
    }

    /**
     * Called when the camera stream changes resolution, e.g. when a mobile device
     * is rotated and the stream swaps width and height. Recomputes the geometry
     * and dispatches `geometrychange`.
     */
    private handleVideoResize(): void {
        const source = this.source;
        if (this._state !== "ready" || source == null || this.options == null) {
            return;
        }
        const vw = this._video.videoWidth;
        const vh = this._video.videoHeight;
        const current = source.videoSize;
        if (vw === 0 || vh === 0 || (vw === current.width && vh === current.height)) {
            return;
        }
        const geometry = source.prepare(vw, vh, this.options.rotatePortrait);
        this.dispatchEvent(new CustomEvent<FrameGeometry>("geometrychange", { detail: geometry }));
    }

    private handleTrackEnded(): void {
        if (this._state !== "ready") {
            return;
        }
        this.release();
        this._state = "ended";
        this.dispatchEvent(new Event("ended"));
    }

    /** Remove the listeners, stop the tracks and detach the stream from the video. */
    private release(): void {
        this._video.removeEventListener("resize", this.onVideoResize);
        this.track?.removeEventListener("ended", this.onTrackEnded);
        stopStream(this.stream);
        if (this.stream != null && this._video.srcObject === this.stream) {
            this._video.srcObject = null;
        }
        this.stream = null;
        this.track = null;
    }

    /**
     * Stop the camera and release every resource. Safe to call more than once and
     * during `initialize()`, which then rejects with `DESTROYED`. Unlike ARnft's
     * `CameraViewRenderer.destroy()`, it stops the tracks immediately and does not
     * touch the DOM.
     */
    public destroy(): void {
        if (this._state === "destroyed") {
            return;
        }
        this.generation++;
        const initializing = this._state === "initializing";
        this.release();
        if (initializing) {
            this._video.srcObject = null;
        }
        this._state = "destroyed";
        this.cancelWait?.(new CameraViewError("DESTROYED"));
    }

    private assertNotDestroyed(): void {
        if (this._state === "destroyed") {
            throw new CameraViewError("DESTROYED");
        }
    }

    private readySource(): FrameSource {
        this.assertNotDestroyed();
        if (this._state === "ended") {
            throw new CameraViewError("STREAM_ENDED");
        }
        if (this._state !== "ready" || this.source == null) {
            throw new CameraViewError("NOT_INITIALIZED");
        }
        return this.source;
    }

    /**
     * The current frame as `ImageData` of frameWidth x frameHeight. A new frame
     * is drawn at most `targetFrameRate` times per second; in between, a copy of
     * the last frame is returned. Each call returns a new `ImageData`.
     */
    public getImage(): ImageData {
        return this.readySource().getImage(this._video);
    }

    /**
     * The current frame as an `ImageBitmap`, which can be transferred to a worker
     * without copying. Throttled like {@link getImage}, sharing its frame counter.
     */
    public getImageBitmap(): Promise<ImageBitmap> {
        let source: FrameSource;
        try {
            source = this.readySource();
        } catch (error) {
            return Promise.reject(error);
        }
        const create = this.deps.createImageBitmap;
        if (create == null) {
            return Promise.reject(
                new CameraViewError("NOT_SUPPORTED", "createImageBitmap is not available."),
            );
        }
        return source.getImageBitmap(this._video, create);
    }

    // ARnft-compatible accessors (ICameraViewRenderer)

    /** Same as {@link getImage}. */
    public get image(): ImageData {
        return this.getImage();
    }

    /** Number of frames captured so far. */
    public get frame(): number {
        return this.source?.frame ?? 0;
    }

    /** Same as {@link frame}. */
    public getFrame(): number {
        return this.frame;
    }

    /** The camera video width, 0 before the first geometry. */
    public get width(): number {
        return this.source?.geometry?.videoWidth ?? 0;
    }

    /** The camera video height, 0 before the first geometry. */
    public get height(): number {
        return this.source?.geometry?.videoHeight ?? 0;
    }

    /** The facing mode requested, `"environment"` by default. */
    public get facing(): string {
        return this.options?.facingMode ?? DEFAULT_FACING_MODE;
    }

    /** True when the video is drawn rotated 90 degrees onto the process canvas. */
    public get rotated(): boolean {
        return this.source?.geometry?.rotated ?? false;
    }

    /** The video element given to the constructor. */
    public get video(): HTMLVideoElement {
        return this._video;
    }

    /**
     * The process canvas the frames are drawn on, created on the first
     * `initialize()`.
     * @throws CameraViewError `NOT_INITIALIZED` before that.
     */
    public get canvasProcess(): HTMLCanvasElement {
        if (this.source == null) {
            throw new CameraViewError("NOT_INITIALIZED");
        }
        return this.source.canvas;
    }
}
