/*
 *  devices.test.ts
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
import {
    findCamera,
    getVideoDevices,
    openCameraStream,
    stopStream,
    withDeviceId,
} from "../../src/devices";
import { FakeMediaDevices, type FakeDeviceSpec, type FakeStream } from "../fakes/media";

const HINT: MediaStreamConstraints = {
    audio: false,
    video: { facingMode: "environment", width: { min: 480, max: 640 } },
};

const FRONT: FakeDeviceSpec = { deviceId: "d0", label: "Front Camera" };
const BACK: FakeDeviceSpec = { deviceId: "d1", label: "Back Camera" };
const WIDE: FakeDeviceSpec = { deviceId: "d2", label: "Back Ultra Wide Camera" };

type LabelCase = "none" | "match" | "nomatch";

interface Combo {
    label: LabelCase;
    labelsVisible: boolean;
    mobile: boolean;
    deviceCount: 0 | 1 | 3;
    exactFails: boolean;
    matchIsDefault: boolean;
}

function combos(): Combo[] {
    const out: Combo[] = [];
    for (const label of ["none", "match", "nomatch"] as const)
        for (const labelsVisible of [false, true])
            for (const mobile of [false, true])
                for (const deviceCount of [0, 1, 3] as const)
                    for (const exactFails of [false, true])
                        for (const matchIsDefault of [false, true])
                            out.push({
                                label,
                                labelsVisible,
                                mobile,
                                deviceCount,
                                exactFails,
                                matchIsDefault,
                            });
    return out;
}

function devicesFor(c: Combo): FakeDeviceSpec[] {
    const back = { ...BACK, failWith: c.exactFails ? "NotReadableError" : undefined };
    if (c.deviceCount === 0) return [];
    if (c.deviceCount === 1) return [back];
    return [FRONT, back, WIDE];
}

function labelFor(c: Combo): string | undefined {
    return c.label === "match" ? "back" : c.label === "nomatch" ? "Logitech" : undefined;
}

/**
 * The documented selection rules, written as a decision table (README,
 * "Camera selection"). Returns the expected deviceId, or the expected error name.
 */
function expected(c: Combo): { deviceId: string } | { error: string } {
    if (c.deviceCount === 0) return { error: "NotFoundError" };
    const defaultId = c.deviceCount === 1 || c.matchIsDefault ? "d1" : "d0";
    const lastId = c.deviceCount === 3 ? "d2" : "d1";
    const mobileOrDefault = c.mobile && c.deviceCount > 1 ? lastId : defaultId;

    if (c.label === "match") {
        if (!c.labelsVisible && defaultId === "d1") return { deviceId: "d1" }; // no reopen
        return { deviceId: c.exactFails ? defaultId : "d1" };
    }
    if (c.label === "nomatch" && !c.labelsVisible) return { deviceId: defaultId };
    return { deviceId: mobileOrDefault };
}

function label(c: Combo): string {
    return [
        `label=${c.label}`,
        c.labelsVisible ? "labels-visible" : "labels-hidden",
        c.mobile ? "mobile" : "desktop",
        `devices=${c.deviceCount}`,
        c.exactFails ? "exact-fails" : "exact-ok",
        c.matchIsDefault ? "match-is-default" : "match-not-default",
    ].join(" ");
}

describe("openCameraStream — every combination", () => {
    it.each(combos().map((c) => [label(c), c] as const))("%s", async (_name, c) => {
        const media = new FakeMediaDevices({
            devices: devicesFor(c),
            permissionGranted: c.labelsVisible,
            defaultDeviceId: c.deviceCount === 3 && c.matchIsDefault ? "d1" : undefined,
        });
        const warnings: unknown[][] = [];
        const want = expected(c);

        const result = openCameraStream(media, HINT, labelFor(c), {
            isMobile: c.mobile,
            warn: (...args) => warnings.push(args),
        });

        if ("error" in want) {
            await expect(result).rejects.toMatchObject({ name: want.error });
        } else {
            const stream = (await result) as unknown as FakeStream;
            expect(stream.videoTrack.deviceId).toBe(want.deviceId);
            expect(stream.stopped).toBe(false);
        }

        // no leaks: every stream opened and not returned is stopped
        const live = media.streams.filter((s) => !s.stopped);
        expect(live.length).toBeLessThanOrEqual(1);
        if ("error" in want) expect(live).toHaveLength(0);

        // never more than: default + exact + fallback
        expect(media.getUserMediaCalls.length).toBeLessThanOrEqual(3);
        // every request keeps the hint: no audio, same facing mode and width
        for (const call of media.getUserMediaCalls) {
            expect(call.audio).toBe(false);
            expect(call.video).toMatchObject(HINT.video as object);
        }

        if (c.label === "nomatch" && c.deviceCount > 0) {
            expect(warnings.some((w) => String(w[0]).includes("No camera matches"))).toBe(true);
        }
        if (c.label === "none") {
            expect(warnings).toHaveLength(0);
        }
    });
});

describe("openCameraStream — specific behaviours", () => {
    it("does not reopen the camera when the default one already matches the label (no flicker)", async () => {
        const media = new FakeMediaDevices({ devices: [BACK, FRONT] });
        await openCameraStream(media, HINT, "back", { isMobile: false, warn: () => {} });
        expect(media.requestedDeviceIds).toEqual([undefined]);
    });

    it("hidden labels: opens the default camera first, then the matching one", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK] });
        const stream = (await openCameraStream(media, HINT, "BACK", {
            isMobile: false,
            warn: () => {},
        })) as unknown as FakeStream;
        expect(media.requestedDeviceIds).toEqual([undefined, "d1"]);
        expect(media.streams[0].stopped).toBe(true);
        expect(stream.videoTrack.deviceId).toBe("d1");
        expect(media.enumerateCalls).toBe(2);
    });

    it("hidden labels: keeps the default stream when re-enumerating fails", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK], enumerateFailsOnCall: 2 });
        const warnings: unknown[][] = [];
        const stream = (await openCameraStream(media, HINT, "back", {
            isMobile: false,
            warn: (...a) => warnings.push(a),
        })) as unknown as FakeStream;
        expect(stream.videoTrack.deviceId).toBe("d0");
        expect(stream.stopped).toBe(false);
        expect(String(warnings[0][0])).toContain("Could not select the camera by cameraLabel");
    });

    it("hidden labels: keeps the default stream when it has no video track", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK] });
        const original = media.getUserMedia.bind(media);
        media.getUserMedia = async (c) => {
            const s = (await original(c)) as unknown as FakeStream;
            s.tracks.length = 0;
            return s as unknown as MediaStream;
        };
        const warnings: unknown[][] = [];
        const stream = await openCameraStream(media, HINT, "back", {
            isMobile: false,
            warn: (...a) => warnings.push(a),
        });
        expect(stream).toBe(media.streams[0]);
        expect(warnings).toHaveLength(1);
    });

    it("rejects when the first enumerateDevices call fails", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT], enumerateFailsOnCall: 1 });
        await expect(
            openCameraStream(media, HINT, undefined, { isMobile: false, warn: () => {} }),
        ).rejects.toMatchObject({ name: "NotAllowedError" });
        expect(media.getUserMediaCalls).toHaveLength(0);
    });

    it("works without enumerateDevices (old browsers): plain getUserMedia", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK], noEnumerateDevices: true });
        await openCameraStream(media, HINT, "back", { isMobile: true, warn: () => {} });
        // no device list: the label path opens the default camera and cannot reopen
        expect(media.requestedDeviceIds).toEqual([undefined]);
    });

    it("propagates the browser error unchanged when the default camera fails", async () => {
        const media = new FakeMediaDevices({
            devices: [FRONT],
            defaultFailsWith: "NotAllowedError",
        });
        await expect(
            openCameraStream(media, HINT, undefined, { isMobile: false, warn: () => {} }),
        ).rejects.toMatchObject({ name: "NotAllowedError" });
    });

    it("propagates the fallback error when both the matching and the default camera fail", async () => {
        const media = new FakeMediaDevices({
            devices: [FRONT, { ...BACK, failWith: "NotReadableError" }],
            permissionGranted: true,
            defaultFailsWith: "NotAllowedError",
        });
        await expect(
            openCameraStream(media, HINT, "back", { isMobile: false, warn: () => {} }),
        ).rejects.toMatchObject({ name: "NotAllowedError" });
        expect(media.streams).toHaveLength(0);
    });

    it("stops after the first stream when cancelled (destroy during initialize)", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK] });
        const stream = await openCameraStream(media, HINT, "back", {
            isMobile: false,
            warn: () => {},
            isCancelled: () => true,
        });
        expect(media.getUserMediaCalls).toHaveLength(1);
        expect(stream).toBe(media.streams[0]);
    });

    it("ignores non-video devices whose label matches", async () => {
        const media = new FakeMediaDevices({
            devices: [{ deviceId: "mic", label: "Back Microphone", kind: "audioinput" }, FRONT],
            permissionGranted: true,
        });
        const stream = (await openCameraStream(media, HINT, "back", {
            isMobile: false,
            warn: () => {},
        })) as unknown as FakeStream;
        expect(stream.videoTrack.deviceId).toBe("d0");
    });

    it("mobile with several cameras picks the last one", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK, WIDE] });
        await openCameraStream(media, HINT, undefined, { isMobile: true, warn: () => {} });
        expect(media.requestedDeviceIds).toEqual(["d2"]);
    });
});

describe("device helpers", () => {
    it("getVideoDevices filters video inputs", async () => {
        const media = new FakeMediaDevices({
            devices: [FRONT, { deviceId: "m", label: "Mic", kind: "audioinput" }, BACK],
            permissionGranted: true,
        });
        const list = await getVideoDevices(media);
        expect(list.map((d) => d.deviceId)).toEqual(["d0", "d1"]);
    });

    it("findCamera is case insensitive and warns with the available labels", async () => {
        const media = new FakeMediaDevices({ devices: [FRONT, BACK], permissionGranted: true });
        const list = await getVideoDevices(media);
        const warnings: unknown[][] = [];
        expect(findCamera(list, "bAcK", () => {})?.deviceId).toBe("d1");
        expect(findCamera(list, "Logitech", (...a) => warnings.push(a))).toBeUndefined();
        expect(warnings[0][1]).toEqual(["Front Camera", "Back Camera"]);
    });

    it("withDeviceId does not mutate the constraints", () => {
        const copy = structuredClone(HINT);
        const out = withDeviceId(HINT, "x");
        expect(HINT).toEqual(copy);
        expect(out.video).toMatchObject({ deviceId: { exact: "x" }, facingMode: "environment" });
        expect(withDeviceId({ video: true }, "y").video).toEqual({ deviceId: { exact: "y" } });
    });

    it("stopStream tolerates null and stops every track", async () => {
        expect(() => stopStream(null)).not.toThrow();
        const media = new FakeMediaDevices({ devices: [FRONT] });
        const s = await media.getUserMedia(HINT);
        stopStream(s);
        expect((s as unknown as FakeStream).stopped).toBe(true);
    });
});
