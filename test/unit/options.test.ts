/*
 *  options.test.ts
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

import { describe, expect, it } from "vitest";
import { CameraViewError } from "../../src/errors";
import { buildConstraints, resolveOptions } from "../../src/options";

describe("resolveOptions", () => {
    it("applies ARnft's defaults", () => {
        expect(resolveOptions(undefined)).toEqual({
            facingMode: "environment",
            cameraLabel: undefined,
            width: undefined,
            targetFrameRate: 60,
            rotatePortrait: false,
        });
        expect(resolveOptions(null)).toEqual(resolveOptions({}));
    });

    it("accepts a full ARnft VideoSettingData object", () => {
        const resolved = resolveOptions({
            width: { min: 640, max: 800 },
            height: { min: 480, max: 600 },
            facingMode: "user",
            targetFrameRate: 30,
            rotatePortrait: true,
            cameraLabel: "Logitech",
        });
        expect(resolved).toEqual({
            facingMode: "user",
            cameraLabel: "Logitech",
            width: { min: 640, max: 800 },
            targetFrameRate: 30,
            rotatePortrait: true,
        });
    });

    it("treats null fields like missing ones (JSON configs)", () => {
        const resolved = resolveOptions({
            facingMode: null,
            cameraLabel: null,
            targetFrameRate: null,
            width: null,
            height: null,
            rotatePortrait: null,
        } as never);
        expect(resolved).toEqual(resolveOptions({}));
    });

    it("an empty cameraLabel or facingMode selects nothing", () => {
        expect(resolveOptions({ cameraLabel: "", facingMode: "" })).toMatchObject({
            cameraLabel: undefined,
            facingMode: "environment",
        });
    });

    it("rotatePortrait is opt-in: only `true` enables it", () => {
        for (const value of [1, "true", "yes", {}]) {
            expect(resolveOptions({ rotatePortrait: value as never }).rotatePortrait).toBe(false);
        }
        expect(resolveOptions({ rotatePortrait: true }).rotatePortrait).toBe(true);
    });

    it("accepts targetFrameRate: Infinity (no throttling) and fractional rates", () => {
        expect(resolveOptions({ targetFrameRate: Infinity }).targetFrameRate).toBe(Infinity);
        expect(resolveOptions({ targetFrameRate: 0.5 }).targetFrameRate).toBe(0.5);
    });

    it.each([
        ["targetFrameRate 0", { targetFrameRate: 0 }],
        ["targetFrameRate negative", { targetFrameRate: -30 }],
        ["targetFrameRate NaN", { targetFrameRate: NaN }],
        ["targetFrameRate string", { targetFrameRate: "30" }],
        ["width min > max", { width: { min: 800, max: 640 } }],
        ["width negative", { width: { min: -1, max: 640 } }],
        ["width missing max", { width: { min: 640 } }],
        ["width NaN", { width: { min: NaN, max: 640 } }],
        ["width not an object", { width: 640 }],
        ["height min > max", { height: { min: 600, max: 480 } }],
        ["cameraLabel number", { cameraLabel: 3 }],
        ["facingMode number", { facingMode: 1 }],
    ])("rejects %s with INVALID_OPTIONS", (_name, options) => {
        expect(() => resolveOptions(options as never)).toThrow(CameraViewError);
        try {
            resolveOptions(options as never);
        } catch (error) {
            expect((error as CameraViewError).code).toBe("INVALID_OPTIONS");
        }
    });

    it("rejects a non-object", () => {
        expect(() => resolveOptions("fast" as never)).toThrow(/options must be an object/);
    });
});

describe("buildConstraints", () => {
    it("builds ARnft's hint: no audio, facing mode and width, never the height", () => {
        const c = buildConstraints(
            resolveOptions({
                width: { min: 480, max: 640 },
                height: { min: 360, max: 480 },
                facingMode: "environment",
            }),
        );
        expect(c).toEqual({
            audio: false,
            video: { facingMode: "environment", width: { min: 480, max: 640 } },
        });
    });

    it("omits the width when not given", () => {
        expect(buildConstraints(resolveOptions({}))).toEqual({
            audio: false,
            video: { facingMode: "environment" },
        });
    });
});

describe("CameraViewError", () => {
    it("has a name, a code, a default message and an optional cause", () => {
        const cause = new Error("x");
        const error = new CameraViewError("NOT_SUPPORTED", undefined, { cause });
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("CameraViewError");
        expect(error.code).toBe("NOT_SUPPORTED");
        expect(error.message).toMatch(/getUserMedia/);
        expect(error.cause).toBe(cause);
        expect(new CameraViewError("DESTROYED", "custom").message).toBe("custom");
    });
});
