/*
 *  errors.ts
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

/** Error codes of {@link CameraViewError}. */
export type CameraViewErrorCode =
    | "NOT_SUPPORTED"
    | "NOT_INITIALIZED"
    | "ALREADY_INITIALIZED"
    | "STREAM_ENDED"
    | "DESTROYED"
    | "INVALID_OPTIONS";

const MESSAGES: Record<CameraViewErrorCode, string> = {
    NOT_SUPPORTED:
        "Sorry, your device does not support this experience (getUserMedia unavailable).",
    NOT_INITIALIZED: "The CameraView is not ready: call and await initialize() first.",
    ALREADY_INITIALIZED: "The CameraView is already initialized or initializing.",
    STREAM_ENDED: "The camera stream has ended: call initialize() again to reopen it.",
    DESTROYED: "The CameraView has been destroyed.",
    INVALID_OPTIONS: "Invalid CameraView options.",
};

/**
 * Errors raised by `@webarkit/camera-view` itself. Errors coming from the
 * browser (`NotAllowedError`, `NotFoundError`, `OverconstrainedError`,
 * `NotReadableError`, ...) are re-thrown unchanged.
 */
export class CameraViewError extends Error {
    public readonly code: CameraViewErrorCode;

    constructor(code: CameraViewErrorCode, message?: string, options?: { cause?: unknown }) {
        super(message ?? MESSAGES[code], options);
        this.name = "CameraViewError";
        this.code = code;
    }
}
