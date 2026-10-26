/*
 *  geometry.ts
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

import type { FrameGeometry, ProcessGeometry } from "./types";

/** Width, in pixels, of the processing frame's long side. */
export const PROCESS_SIZE = 320;

/**
 * Compute the geometry used to fit a video of size vw x vh onto the (always
 * landscape, 4:3) process canvas. When `rotatePortrait` is true and the video is
 * portrait (vh > vw), the long/short sides are swapped before applying the
 * formula so the video can be drawn rotated 90 degrees instead of being
 * letterboxed. With `rotatePortrait` false/omitted, or for a landscape video,
 * this is the original (unrotated) formula.
 *
 * Kept bit for bit identical to ARnft's `getProcessGeometry()`
 * (`src/utils/ARnftUtils.ts`); `test/unit/geometry.oracle.test.ts` enforces it.
 * See https://github.com/webarkit/ARnft/issues/344
 *
 * @param vw the video width
 * @param vh the video height
 * @param rotatePortrait opt-in rotation of portrait videos
 * @param floor whether to floor the computed values. `CameraView` always
 * floors (these are the values actually drawn); ARnft's `getWindowSize`
 * historically did not.
 * @returns the process canvas geometry
 */
export function getProcessGeometry(
    vw: number,
    vh: number,
    rotatePortrait = false,
    floor = false,
): ProcessGeometry {
    const rot = rotatePortrait && vh > vw;
    const V = rot ? vh : vw;
    const H = rot ? vw : vh;
    const round = floor ? Math.floor : (n: number) => n;

    const pscale = PROCESS_SIZE / Math.max(V, (H / 3) * 4);

    const w = round(V * pscale);
    const h = round(H * pscale);
    const pw = round(Math.max(w, (h / 3) * 4));
    const ph = round(Math.max(h, (w / 4) * 3));
    const ox = round((pw - w) / 2);
    const oy = round((ph - h) / 2);

    return { rot, w, h, pw, ph, ox, oy };
}

/**
 * Convert a {@link ProcessGeometry} into the public, self-describing
 * {@link FrameGeometry}. The returned object is frozen plain data.
 * @param vw the video width
 * @param vh the video height
 * @param geometry the geometry returned by {@link getProcessGeometry}
 */
export function toFrameGeometry(vw: number, vh: number, geometry: ProcessGeometry): FrameGeometry {
    return Object.freeze({
        frameWidth: geometry.pw,
        frameHeight: geometry.ph,
        videoWidth: vw,
        videoHeight: vh,
        x: geometry.ox,
        y: geometry.oy,
        width: geometry.w,
        height: geometry.h,
        rotated: geometry.rot,
    });
}
