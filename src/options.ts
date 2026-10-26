/*
 *  options.ts
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

import { CameraViewError } from "./errors";
import type { CameraViewOptions, Range } from "./types";

/** Default `targetFrameRate`, as in ARnft's `CameraViewRenderer`. */
export const DEFAULT_TARGET_FRAME_RATE = 60;

/** Default `facingMode`, as in ARnft's `CameraViewRenderer`. */
export const DEFAULT_FACING_MODE = "environment";

/** {@link CameraViewOptions} after defaults and validation. */
export interface ResolvedOptions {
    facingMode: string;
    cameraLabel: string | undefined;
    width: Range | undefined;
    targetFrameRate: number;
    rotatePortrait: boolean;
}

function invalid(message: string): CameraViewError {
    return new CameraViewError("INVALID_OPTIONS", "Invalid CameraView options: " + message);
}

function checkRange(name: string, range: unknown): Range | undefined {
    if (range == null) {
        return undefined;
    }
    if (typeof range !== "object") {
        throw invalid(`${name} must be an object { min, max }.`);
    }
    const { min, max } = range as Partial<Range>;
    if (
        typeof min !== "number" ||
        Number.isNaN(min) ||
        typeof max !== "number" ||
        Number.isNaN(max)
    ) {
        throw invalid(`${name}.min and ${name}.max must be numbers.`);
    }
    if (min < 0 || max < 0) {
        throw invalid(`${name}.min and ${name}.max must not be negative.`);
    }
    if (min > max) {
        throw invalid(`${name}.min (${min}) is greater than ${name}.max (${max}).`);
    }
    return { min, max };
}

/**
 * Apply the defaults to the options and validate them. `null` is treated like
 * `undefined`, since config files written for ARnft may contain it.
 * @throws CameraViewError with code `INVALID_OPTIONS`
 */
export function resolveOptions(options: CameraViewOptions | undefined | null): ResolvedOptions {
    const o: CameraViewOptions = options ?? {};
    if (typeof o !== "object") {
        throw invalid("options must be an object.");
    }

    let facingMode = DEFAULT_FACING_MODE;
    if (o.facingMode != null && o.facingMode !== "") {
        if (typeof o.facingMode !== "string") {
            throw invalid("facingMode must be a string.");
        }
        facingMode = o.facingMode;
    }

    let cameraLabel: string | undefined;
    if (o.cameraLabel != null) {
        if (typeof o.cameraLabel !== "string") {
            throw invalid("cameraLabel must be a string.");
        }
        // an empty label selects nothing, exactly as in ARnft (falsy check)
        cameraLabel = o.cameraLabel === "" ? undefined : o.cameraLabel;
    }

    let targetFrameRate = DEFAULT_TARGET_FRAME_RATE;
    if (o.targetFrameRate != null) {
        if (
            typeof o.targetFrameRate !== "number" ||
            Number.isNaN(o.targetFrameRate) ||
            o.targetFrameRate <= 0
        ) {
            throw invalid("targetFrameRate must be a number greater than 0.");
        }
        targetFrameRate = o.targetFrameRate;
    }

    const width = checkRange("width", o.width);
    // validated for config compatibility, never sent to getUserMedia (as in ARnft)
    checkRange("height", o.height);

    return {
        facingMode,
        cameraLabel,
        width,
        targetFrameRate,
        rotatePortrait: o.rotatePortrait === true,
    };
}

/**
 * The `getUserMedia` constraints, as built by ARnft: no audio, the facing mode
 * and the width range. The height range is deliberately not sent.
 */
export function buildConstraints(options: ResolvedOptions): MediaStreamConstraints {
    const video: MediaTrackConstraints = { facingMode: options.facingMode };
    if (options.width) {
        video.width = { min: options.width.min, max: options.width.max };
    }
    return { audio: false, video };
}
