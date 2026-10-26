/*
 *  media.ts
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
 * Scriptable fakes for the media APIs CameraView uses: MediaDevices,
 * MediaStream, MediaStreamTrack, HTMLVideoElement, canvas and a clock.
 * They record everything so that tests can assert which cameras were
 * requested, in which order, and that every stream not in use was stopped.
 */

export interface FakeDeviceSpec {
    deviceId: string;
    label: string;
    kind?: MediaDeviceKind;
    /** Resolution the camera delivers. Default 640 x 480. */
    width?: number;
    height?: number;
    /** getUserMedia with this exact deviceId rejects with this error name. */
    failWith?: string;
}

export interface FakeMediaScenario {
    devices: FakeDeviceSpec[];
    /** Labels are hidden until a getUserMedia call succeeded (real browsers). Default true. */
    hideLabelsUntilPermission?: boolean;
    /** Permission already granted (labels visible from the start). Default false. */
    permissionGranted?: boolean;
    /** Device opened without an exact deviceId. Default: the first video device. */
    defaultDeviceId?: string;
    /** getUserMedia without an exact deviceId rejects with this error name. */
    defaultFailsWith?: string;
    /** No enumerateDevices function at all. */
    noEnumerateDevices?: boolean;
    /** enumerateDevices rejects, on the given call number (1-based), or always when 0. */
    enumerateFailsOnCall?: number;
}

export function domError(name: string, message = name): Error {
    const error = new Error(message);
    error.name = name;
    return error;
}

export class FakeTrack extends EventTarget {
    public readonly kind = "video";
    public stopped = false;
    public readyState: MediaStreamTrackState = "live";

    constructor(
        public readonly deviceId: string,
        public readonly width: number,
        public readonly height: number,
    ) {
        super();
    }

    stop(): void {
        // per spec, stop() does not fire "ended"
        this.stopped = true;
        this.readyState = "ended";
    }

    getSettings(): MediaTrackSettings {
        return { deviceId: this.deviceId, width: this.width, height: this.height };
    }

    /** Simulate the camera going away (unplugged, permission revoked). */
    endFromOutside(): void {
        this.readyState = "ended";
        this.dispatchEvent(new Event("ended"));
    }
}

let streamCounter = 0;

export class FakeStream {
    public readonly id = `stream-${++streamCounter}`;
    constructor(public readonly tracks: FakeTrack[]) {}

    getTracks(): FakeTrack[] {
        return this.tracks;
    }

    getVideoTracks(): FakeTrack[] {
        return this.tracks.filter((track) => track.kind === "video");
    }

    get stopped(): boolean {
        return this.tracks.every((track) => track.stopped);
    }

    get videoTrack(): FakeTrack {
        return this.tracks[0];
    }
}

interface Gate {
    promise: Promise<void>;
    release: () => void;
}

function gate(): Gate {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => (release = resolve));
    return { promise, release };
}

export class FakeMediaDevices {
    public readonly getUserMediaCalls: MediaStreamConstraints[] = [];
    public readonly streams: FakeStream[] = [];
    public enumerateCalls = 0;
    public permission: boolean;
    private readonly gates: Gate[] = [];
    private holdCount = 0;
    public enumerateDevices?: () => Promise<MediaDeviceInfo[]>;

    constructor(private readonly scenario: FakeMediaScenario) {
        this.permission = scenario.permissionGranted ?? false;
        if (!scenario.noEnumerateDevices) {
            this.enumerateDevices = () => this.enumerate();
        }
    }

    /** Make the next getUserMedia call wait until the returned function is called. */
    holdNextGetUserMedia(): () => void {
        const g = gate();
        this.gates.push(g);
        this.holdCount++;
        return g.release;
    }

    private async enumerate(): Promise<MediaDeviceInfo[]> {
        this.enumerateCalls++;
        const failOn = this.scenario.enumerateFailsOnCall;
        if (failOn != null && (failOn === 0 || failOn === this.enumerateCalls)) {
            throw domError("NotAllowedError", "enumerateDevices failed");
        }
        const hide = (this.scenario.hideLabelsUntilPermission ?? true) && !this.permission;
        return this.scenario.devices.map(
            (device) =>
                ({
                    deviceId: device.deviceId,
                    groupId: "",
                    kind: device.kind ?? "videoinput",
                    label: hide ? "" : device.label,
                    toJSON() {
                        return this;
                    },
                }) as MediaDeviceInfo,
        );
    }

    private videoDevices(): FakeDeviceSpec[] {
        return this.scenario.devices.filter((d) => (d.kind ?? "videoinput") === "videoinput");
    }

    async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
        this.getUserMediaCalls.push(structuredClone(constraints));
        if (this.holdCount > 0) {
            this.holdCount--;
            await this.gates.shift()!.promise;
        }
        const video = constraints.video as MediaTrackConstraints | undefined;
        const exact = (video?.deviceId as ConstrainDOMStringParameters | undefined)?.exact as
            string | undefined;
        let device: FakeDeviceSpec | undefined;
        if (exact != null) {
            device = this.videoDevices().find((d) => d.deviceId === exact);
            if (device == null) {
                throw domError("OverconstrainedError", `no device ${exact}`);
            }
            if (device.failWith) {
                throw domError(device.failWith, `device ${exact} failed`);
            }
        } else {
            if (this.scenario.defaultFailsWith) {
                throw domError(this.scenario.defaultFailsWith);
            }
            const id = this.scenario.defaultDeviceId;
            device = id
                ? this.videoDevices().find((d) => d.deviceId === id)
                : this.videoDevices()[0];
            if (device == null) {
                throw domError("NotFoundError", "no camera");
            }
        }
        this.permission = true;
        const stream = new FakeStream([
            new FakeTrack(device.deviceId, device.width ?? 640, device.height ?? 480),
        ]);
        this.streams.push(stream);
        return stream as unknown as MediaStream;
    }

    /** The deviceId requested by each getUserMedia call (undefined = default). */
    get requestedDeviceIds(): (string | undefined)[] {
        return this.getUserMediaCalls.map((c) => {
            const video = c.video as MediaTrackConstraints | undefined;
            return (video?.deviceId as ConstrainDOMStringParameters | undefined)?.exact as
                string | undefined;
        });
    }

    asMediaDevices(): MediaDevices {
        return this as unknown as MediaDevices;
    }
}

/**
 * A video element: when a FakeStream is attached it fires `loadedmetadata`
 * on the next macrotask with the track's resolution (unless `autoMetadata` is off).
 */
export class FakeVideo extends EventTarget {
    public videoWidth = 0;
    public videoHeight = 0;
    public autoMetadata = true;
    /** Size reported at loadedmetadata, overriding the track's (e.g. 0 x 0). */
    public metadataSize: { width: number; height: number } | null = null;
    private _srcObject: MediaStream | null = null;

    get srcObject(): MediaStream | null {
        return this._srcObject;
    }

    set srcObject(value: MediaStream | null) {
        this._srcObject = value;
        this.videoWidth = 0;
        this.videoHeight = 0;
        if (value != null && this.autoMetadata) {
            const track = (value as unknown as FakeStream).videoTrack;
            const size = this.metadataSize ?? { width: track.width, height: track.height };
            setTimeout(() => {
                if (this._srcObject === value) {
                    this.fireMetadata(size.width, size.height);
                }
            }, 0);
        }
    }

    fireMetadata(width: number, height: number): void {
        this.videoWidth = width;
        this.videoHeight = height;
        this.dispatchEvent(new Event("loadedmetadata"));
    }

    resize(width: number, height: number): void {
        this.videoWidth = width;
        this.videoHeight = height;
        this.dispatchEvent(new Event("resize"));
    }

    asVideo(): HTMLVideoElement {
        return this as unknown as HTMLVideoElement;
    }
}

export type DrawCall =
    | { op: "save" | "restore" }
    | { op: "translate"; x: number; y: number }
    | { op: "rotate"; angle: number }
    | { op: "drawImage"; args: number[] }
    | { op: "fillRect"; args: number[]; fillStyle: unknown }
    | { op: "getImageData"; args: number[] };

/** A 2D context recording its calls. getImageData returns pixels whose value is the draw count. */
export class FakeContext {
    public calls: DrawCall[] = [];
    public fillStyle: unknown = "";
    public draws = 0;
    public options: unknown;

    constructor(private readonly canvas: FakeCanvas) {}

    save(): void {
        this.calls.push({ op: "save" });
    }
    restore(): void {
        this.calls.push({ op: "restore" });
    }
    translate(x: number, y: number): void {
        this.calls.push({ op: "translate", x, y });
    }
    rotate(angle: number): void {
        this.calls.push({ op: "rotate", angle });
    }
    drawImage(_source: unknown, ...args: number[]): void {
        this.draws++;
        this.calls.push({ op: "drawImage", args });
    }
    fillRect(...args: number[]): void {
        this.calls.push({ op: "fillRect", args, fillStyle: this.fillStyle });
    }
    getImageData(...args: number[]): { data: Uint8ClampedArray; width: number; height: number } {
        this.calls.push({ op: "getImageData", args });
        const [, , w, h] = args;
        const data = new Uint8ClampedArray(w * h * 4).fill(this.draws % 256);
        return { data, width: w, height: h };
    }
    get canvasSize(): { width: number; height: number } {
        return { width: this.canvas.width, height: this.canvas.height };
    }
}

export class FakeCanvas {
    public width = 300;
    public height = 150;
    public readonly context = new FakeContext(this);
    public contextAvailable = true;

    getContext(_type: string, options?: unknown): FakeContext | null {
        this.context.options = options;
        return this.contextAvailable ? this.context : null;
    }

    asCanvas(): HTMLCanvasElement {
        return this as unknown as HTMLCanvasElement;
    }
}

export class FakeClock {
    public t = 1000;
    now = (): number => this.t;
    advance(ms: number): void {
        this.t += ms;
    }
}

/** Wait for pending macrotasks (FakeVideo fires metadata on setTimeout 0). */
export function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
