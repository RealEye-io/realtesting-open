import "./../style.css";

import {
  RealScreenCapture,
  type CaptureMode,
  type VirtualFrameSource,
} from "@realeye-io/realtesting-screen-capture";

const startButton = document.getElementById("startCapture") as HTMLButtonElement | null;
const stopButton = document.getElementById("stopCapture") as HTMLButtonElement | null;
const modeSelect = document.getElementById("captureMode") as HTMLSelectElement | null;
const blockNativeCheckbox = document.getElementById("blockNative") as HTMLInputElement | null;
const statusText = document.getElementById("statusText") as HTMLPreElement | null;
const errorBox = document.getElementById("errorBox") as HTMLDivElement | null;
const preview = document.getElementById("preview") as HTMLVideoElement | null;

const sourcePattern = document.getElementById("sourcePattern") as HTMLButtonElement | null;
const sourceGreen = document.getElementById("sourceGreen") as HTMLButtonElement | null;
const sourceRed = document.getElementById("sourceRed") as HTMLButtonElement | null;

let activeStream: MediaStream | null = null;
let virtualDisplayId: string | null = null;

function setError(error: unknown): void {
  if (!errorBox) {
    return;
  }
  const name =
    error && typeof error === "object" && "name" in error ? String((error as any).name) : "Error";
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as any).message)
      : String(error);
  errorBox.hidden = false;
  errorBox.textContent = `${name}: ${message}`;
}

function clearError(): void {
  if (!errorBox) {
    return;
  }
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

function updateStatus(): void {
  if (!statusText) {
    return;
  }
  const mode = RealScreenCapture.getCaptureMode();
  const blockNative = RealScreenCapture.getBlockNativeDisplayMedia();
  const videoCount = activeStream ? activeStream.getVideoTracks().length : 0;
  const audioCount = activeStream ? activeStream.getAudioTracks().length : 0;
  const streamActive = Boolean(activeStream);
  const displays = RealScreenCapture.listVirtualDisplays();

  statusText.textContent = JSON.stringify(
    {
      captureMode: mode,
      blockNativeDisplayMedia: blockNative,
      streamActive,
      tracks: { video: videoCount, audio: audioCount },
      virtualDisplays: displays,
    },
    null,
    2
  );

  if (startButton) {
    startButton.disabled = false;
  }
  if (stopButton) {
    stopButton.disabled = !streamActive;
  }
  if (modeSelect) {
    modeSelect.value = mode;
  }
  if (blockNativeCheckbox) {
    blockNativeCheckbox.checked = blockNative;
  }
}

async function setStream(stream: MediaStream | null): Promise<void> {
  if (activeStream) {
    stopTracks(activeStream);
  }
  activeStream = stream;
  if (preview) {
    preview.srcObject = stream;
    if (stream) {
      try {
        await preview.play();
      } catch {
        // autoplay might fail in some environments; the stream still exists for E2E sampling.
      }
    }
  }
  updateStatus();
}

async function startCapture(): Promise<void> {
  clearError();
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    await setStream(stream);
  } catch (error) {
    setError(error);
    await setStream(null);
  }
}

async function stopCapture(): Promise<void> {
  clearError();
  await setStream(null);
}

function setVirtualSource(source: VirtualFrameSource): void {
  if (!virtualDisplayId) {
    return;
  }
  RealScreenCapture.setVirtualSource(virtualDisplayId, source);
  updateStatus();
}

function bindUi(): void {
  startButton?.addEventListener("click", () => startCapture());
  stopButton?.addEventListener("click", () => stopCapture());

  modeSelect?.addEventListener("change", () => {
    const value = (modeSelect.value || "prefer-native") as CaptureMode;
    RealScreenCapture.setCaptureMode(value);
    updateStatus();
  });

  blockNativeCheckbox?.addEventListener("change", () => {
    RealScreenCapture.setBlockNativeDisplayMedia(Boolean(blockNativeCheckbox.checked));
    updateStatus();
  });

  sourcePattern?.addEventListener("click", () => {
    setVirtualSource({ type: "pattern", text: "RealTesting Pattern" });
  });
  sourceGreen?.addEventListener("click", () => {
    setVirtualSource({ type: "color", color: "#00ff00", text: "GREEN" });
  });
  sourceRed?.addEventListener("click", () => {
    setVirtualSource({ type: "color", color: "#ff0000", text: "RED" });
  });
}

function init(): void {
  RealScreenCapture.install({
    mode: "proxy",
    testApi: { autoEnable: true },
  });

  virtualDisplayId = RealScreenCapture.createVirtualDisplay({
    label: "RealTesting Virtual Screen",
    defaultConstraints: { width: 1280, height: 720, frameRate: 30 },
  });
  RealScreenCapture.setVirtualSource(virtualDisplayId, {
    type: "pattern",
    text: "RealTesting",
  });

  bindUi();
  updateStatus();
}

init();

