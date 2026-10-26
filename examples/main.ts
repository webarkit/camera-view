/*
 *  main.ts
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

import { CameraView } from "@webarkit/camera-view";

const video = document.getElementById("video") as HTMLVideoElement;
const preview = document.getElementById("preview") as HTMLCanvasElement;
const previewCtx = preview.getContext("2d")!;
const info = document.getElementById("info") as HTMLPreElement;

const facingModeInput = document.getElementById("facingMode") as HTMLSelectElement;
const cameraLabelInput = document.getElementById("cameraLabel") as HTMLInputElement;
const fpsInput = document.getElementById("targetFrameRate") as HTMLInputElement;
const rotatePortraitInput = document.getElementById("rotatePortrait") as HTMLInputElement;
const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;

let view: CameraView | null = null;
let rafId = 0;

function renderStatus(extra?: string): void {
    if (!view) {
        info.textContent = extra ?? "Idle.";
        return;
    }
    let geometry: unknown = null;
    try {
        geometry = view.geometry;
    } catch {
        geometry = null;
    }
    info.textContent = JSON.stringify(
        {
            state: view.state,
            frame: view.frame,
            facing: view.facing,
            rotated: view.rotated,
            geometry,
            ...(extra ? { note: extra } : {}),
        },
        null,
        2,
    );
}

function tick(): void {
    if (!view || view.state !== "ready") return;
    const image = view.getImage();
    if (preview.width !== image.width || preview.height !== image.height) {
        preview.width = image.width;
        preview.height = image.height;
    }
    previewCtx.putImageData(image, 0, 0);

    // Draw the video footprint rectangle in green
    const g = view.geometry;
    previewCtx.strokeStyle = "#22c55e";
    previewCtx.lineWidth = 2;
    previewCtx.strokeRect(g.x + 1, g.y + 1, Math.max(0, g.width - 2), Math.max(0, g.height - 2));

    renderStatus();
    rafId = requestAnimationFrame(tick);
}

startBtn.addEventListener("click", async () => {
    view?.destroy();
    cancelAnimationFrame(rafId);

    view = new CameraView(video);
    view.addEventListener("geometrychange", () => renderStatus("geometrychange event fired"));
    view.addEventListener("ended", () => {
        cancelAnimationFrame(rafId);
        renderStatus("Track ended");
    });

    startBtn.disabled = true;
    renderStatus("Initializing...");
    try {
        await view.initialize({
            facingMode: facingModeInput.value,
            cameraLabel: cameraLabelInput.value.trim() || undefined,
            targetFrameRate: Number(fpsInput.value) || 30,
            rotatePortrait: rotatePortraitInput.checked,
        });
        await video.play();
        stopBtn.disabled = false;
        rafId = requestAnimationFrame(tick);
    } catch (error) {
        renderStatus(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    } finally {
        startBtn.disabled = false;
    }
});

stopBtn.addEventListener("click", () => {
    cancelAnimationFrame(rafId);
    view?.destroy();
    stopBtn.disabled = true;
    renderStatus("Destroyed.");
});
