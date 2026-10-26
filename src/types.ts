/*
 *  types.ts
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

/**
 * Geometry of the process canvas, in the historical ARnft naming.
 * All values are in pixels of the process canvas except `vw`/`vh` which are
 * not part of it (see {@link FrameGeometry} for the public, self-describing shape).
 */
export interface ProcessGeometry {
    /** true when the source was rotated 90 degrees onto the process canvas. */
    rot: boolean;
    /** width of the video footprint on the process canvas. */
    w: number;
    /** height of the video footprint on the process canvas. */
    h: number;
    /** process canvas width. */
    pw: number;
    /** process canvas height. */
    ph: number;
    /** horizontal offset of the video footprint (letterbox). */
    ox: number;
    /** vertical offset of the video footprint (letterbox). */
    oy: number;
}

/**
 * Where the video sits inside the processing frame. Plain data: it can be
 * structured-cloned and posted to a worker. This is the value expected by
 * the jsartoolkitNFT facade's `projectionFor(viewport, geometry)`.
 */
export interface FrameGeometry {
    /** processing frame width (pw). */
    readonly frameWidth: number;
    /** processing frame height (ph). */
    readonly frameHeight: number;
    /** camera video width (vw). */
    readonly videoWidth: number;
    /** camera video height (vh). */
    readonly videoHeight: number;
    /** x offset of the video footprint inside the frame (ox). */
    readonly x: number;
    /** y offset of the video footprint inside the frame (oy). */
    readonly y: number;
    /** width of the video footprint inside the frame (w). */
    readonly width: number;
    /** height of the video footprint inside the frame (h). */
    readonly height: number;
    /** true when the video is drawn rotated 90 degrees clockwise (rot). */
    readonly rotated: boolean;
}

/** A `{ min, max }` range, as in ARnft's `ScreenData`. */
export interface Range {
    min: number;
    max: number;
}

/**
 * Options of {@link CameraView.initialize}. A superset of ARnft's
 * `VideoSettingData`; every field is optional.
 */
export interface CameraViewOptions {
    /** `getUserMedia` facing mode. Default `"environment"`. */
    facingMode?: string;
    /**
     * Use the first camera whose label contains this text (case insensitive),
     * e.g. "Logitech". Without it, smartphones use the last camera (the regular
     * lens on multi-camera devices) and desktop browsers use the camera chosen
     * by the user.
     */
    cameraLabel?: string;
    /** Requested video width range, sent to `getUserMedia`. */
    width?: Range;
    /**
     * Accepted for compatibility with ARnft's config files. Like ARnft, it is
     * **not** sent to `getUserMedia`.
     */
    height?: Range;
    /** Maximum number of new frames per second produced by `getImage()`. Default 60. */
    targetFrameRate?: number;
    /**
     * Opt-in (default false). When true and the camera stream is portrait, the
     * video is rotated 90 degrees onto the process canvas instead of being
     * letterboxed. Landscape streams are unaffected.
     * See https://github.com/webarkit/ARnft/issues/344
     */
    rotatePortrait?: boolean;
}

/**
 * Injectable dependencies. Every field defaults to the browser global; they
 * exist for tests and for advanced embedding (e.g. a custom device list).
 */
export interface CameraViewDeps {
    /** Defaults to `navigator.mediaDevices`. */
    mediaDevices: MediaDevices | undefined;
    /** Monotonic clock in milliseconds. Defaults to `performance.now()`. */
    now: () => number;
    /** Defaults to `document.createElement("canvas")`. */
    createCanvas: () => HTMLCanvasElement;
    /** Defaults to a user agent test, as in ARnft. */
    isMobile: () => boolean;
    /** Defaults to the global `createImageBitmap`. */
    createImageBitmap: ((source: HTMLCanvasElement) => Promise<ImageBitmap>) | undefined;
    /** Defaults to `console.warn`. */
    warn: (...args: unknown[]) => void;
}

/** Lifecycle states of a {@link CameraView}. */
export type CameraViewState = "idle" | "initializing" | "ready" | "ended" | "destroyed";

/** The `geometrychange` event. */
export type GeometryChangeEvent = CustomEvent<FrameGeometry>;

/** Event map of {@link CameraView}. */
export interface CameraViewEventMap {
    geometrychange: GeometryChangeEvent;
    ended: Event;
}
