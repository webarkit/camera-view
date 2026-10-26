/*
 *  arnft-geometry.ts
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
 * ORACLE — DO NOT EDIT.
 *
 * Verbatim copy of `getProcessGeometry()` from webarkit/ARnft
 * `src/utils/ARnftUtils.ts` (branch `dev`, 2026-10-26), the implementation
 * `@webarkit/camera-view` was extracted from. `geometry.oracle.test.ts` checks
 * that the package's implementation returns exactly the same numbers for every
 * input, so the extraction keeps today's behaviour bit for bit.
 * If ARnft's formula is ever changed on purpose, update this file in the same
 * pull request as `src/geometry.ts`, and say so in the CHANGELOG.
 */

export interface ArnftProcessGeometry {
    rot: boolean;
    w: number;
    h: number;
    pw: number;
    ph: number;
    ox: number;
    oy: number;
}

export function arnftGetProcessGeometry(
    vw: number,
    vh: number,
    rotatePortrait = false,
    floor = false,
): ArnftProcessGeometry {
    const rot = rotatePortrait && vh > vw;
    const V = rot ? vh : vw;
    const H = rot ? vw : vh;
    const round = floor ? Math.floor : (n: number) => n;

    const pscale = 320 / Math.max(V, (H / 3) * 4);

    const w = round(V * pscale);
    const h = round(H * pscale);
    const pw = round(Math.max(w, (h / 3) * 4));
    const ph = round(Math.max(h, (w / 4) * 3));
    const ox = round((pw - w) / 2);
    const oy = round((ph - h) / 2);

    return { rot, w, h, pw, ph, ox, oy };
}
