/*
 *  devices.ts
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
 * Camera selection. The logic is ARnft's `CameraViewRenderer.openCameraStream()`
 * unchanged, rewritten over an injected `MediaDevices` so that every
 * combination of devices, labels and failures can be tested.
 */

/** Context of {@link openCameraStream}. */
export interface OpenCameraContext {
    /** Whether the device is a smartphone/tablet (rear camera heuristic). */
    isMobile: boolean;
    /** Warning sink, `console.warn` by default. */
    warn: (...args: unknown[]) => void;
    /**
     * Polled between the two `getUserMedia` calls of the label path: when it
     * returns true the first stream is returned as is (the caller stops it)
     * instead of opening a second camera.
     */
    isCancelled?: () => boolean;
}

/** Stop every track of a stream. */
export function stopStream(stream: MediaStream | null | undefined): void {
    stream?.getTracks().forEach((track) => track.stop());
}

/** The video input devices, or an empty list when they can't be enumerated. */
export async function getVideoDevices(
    mediaDevices: Partial<Pick<MediaDevices, "enumerateDevices">>,
): Promise<MediaDeviceInfo[]> {
    if (typeof mediaDevices.enumerateDevices !== "function") {
        return [];
    }
    const devices = await mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
}

/**
 * Find the first camera whose label contains `label` (case insensitive). Warns
 * with the labels of the available cameras when none matches.
 */
export function findCamera(
    videoDevices: MediaDeviceInfo[],
    label: string,
    warn: OpenCameraContext["warn"],
): MediaDeviceInfo | undefined {
    const camera = videoDevices.find((device) =>
        device.label.toLowerCase().includes(label.toLowerCase()),
    );
    if (camera == null) {
        warn(
            'No camera matches the cameraLabel "' + label + '", available cameras:',
            videoDevices.map((device) => device.label),
        );
    }
    return camera;
}

/** A copy of `constraints` requesting exactly `deviceId`. */
export function withDeviceId(
    constraints: MediaStreamConstraints,
    deviceId: string,
): MediaStreamConstraints {
    const video = typeof constraints.video === "object" ? constraints.video : {};
    return { ...constraints, video: { ...video, deviceId: { exact: deviceId } } };
}

/**
 * Open the camera selected by the label, falling back to the default camera
 * when it can't be opened (e.g. it is in use by another application).
 */
async function openCamera(
    mediaDevices: Pick<MediaDevices, "getUserMedia">,
    constraints: MediaStreamConstraints,
    camera: MediaDeviceInfo,
    warn: OpenCameraContext["warn"],
): Promise<MediaStream> {
    try {
        return await mediaDevices.getUserMedia(withDeviceId(constraints, camera.deviceId));
    } catch (error) {
        warn('Could not open the camera "' + camera.label + '", using the default camera:', error);
        return mediaDevices.getUserMedia(constraints);
    }
}

/**
 * Open the camera stream. With a `label` the first camera whose label contains
 * that text is used. Otherwise smartphones use the last camera (the regular lens
 * on multi-camera devices) and desktop browsers use the camera chosen by the user.
 *
 * Camera labels are only exposed after the camera permission has been granted:
 * on a first visit with a label, the default camera is opened to get the
 * permission, then the matching camera is opened if it is a different one, and
 * the first stream is stopped.
 *
 * Every stream opened here and not returned is stopped.
 */
export async function openCameraStream(
    mediaDevices: Pick<MediaDevices, "getUserMedia"> &
        Partial<Pick<MediaDevices, "enumerateDevices">>,
    constraints: MediaStreamConstraints,
    label: string | undefined,
    context: OpenCameraContext,
): Promise<MediaStream> {
    const { warn } = context;
    const videoDevices = await getVideoDevices(mediaDevices);
    const labelsAvailable = videoDevices.some((device) => device.label !== "");

    if (label && !labelsAvailable) {
        const stream = await mediaDevices.getUserMedia(constraints);
        if (context.isCancelled?.()) {
            return stream;
        }
        let camera: MediaDeviceInfo | undefined;
        try {
            camera = findCamera(await getVideoDevices(mediaDevices), label, warn);
            if (
                camera == null ||
                camera.deviceId === stream.getVideoTracks()[0].getSettings().deviceId
            ) {
                return stream;
            }
        } catch (error) {
            // keep using the open default camera instead of leaving its stream running
            warn("Could not select the camera by cameraLabel, using the default camera:", error);
            return stream;
        }
        stopStream(stream);
        return openCamera(mediaDevices, constraints, camera, warn);
    }

    const camera = label ? findCamera(videoDevices, label, warn) : undefined;
    if (camera != null) {
        return openCamera(mediaDevices, constraints, camera, warn);
    }
    if (context.isMobile && videoDevices.length > 1) {
        const last = videoDevices[videoDevices.length - 1];
        return mediaDevices.getUserMedia(withDeviceId(constraints, last.deviceId));
    }
    return mediaDevices.getUserMedia(constraints);
}
