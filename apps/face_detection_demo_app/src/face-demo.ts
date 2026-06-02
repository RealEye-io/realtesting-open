import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { RealCamera } from "@realeye/realcamera";

declare global {
  interface Window {
    __realcameraFaceDemo?: {
      ready: boolean;
      error?: string;
      deviceId?: string;
      altDeviceId?: string;
      detections?: Array<{ score: number; boundingBox: Record<string, number> }>;
      devices?: MediaDeviceInfo[];
      settings?: MediaTrackSettings;
      altSettings?: MediaTrackSettings;
    };
  }
}

const statusEl = document.getElementById("status");
const showFaceButton = document.getElementById("showFace") as HTMLButtonElement | null;
const showNoFaceButton = document.getElementById("showNoFace") as HTMLButtonElement | null;
const useVirtualButton = document.getElementById("useVirtual") as HTMLButtonElement | null;
const usePhysicalButton = document.getElementById("usePhysical") as HTMLButtonElement | null;
const virtualControls = document.getElementById("virtualControls") as HTMLDivElement | null;
const physicalControls = document.getElementById("physicalControls") as HTMLDivElement | null;
const physicalSelect = document.getElementById("physicalSelect") as HTMLSelectElement | null;
const refreshPhysicalButton = document.getElementById(
  "refreshPhysical"
) as HTMLButtonElement | null;
const requestPhysicalButton = document.getElementById(
  "requestPhysical"
) as HTMLButtonElement | null;
const startPhysicalButton = document.getElementById(
  "startPhysical"
) as HTMLButtonElement | null;
const MEDIAPIPE_VERSION = "0.10.32";
const MEDIAPIPE_WASM_BASE =
  import.meta.env.VITE_MEDIAPIPE_WASM_BASE ??
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MEDIAPIPE_MODEL_URL =
  import.meta.env.VITE_MEDIAPIPE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.classList.remove("status--error");
    statusEl.textContent = message;
  }
}

function setError(message: string): void {
  if (statusEl) {
    statusEl.classList.add("status--error");
    statusEl.textContent = message;
  }
}

function explainError(error: unknown, context: string): string {
  if (error instanceof Event) {
    return `Failed while ${context}. MediaPipe assets could not be loaded (network/CORS).`;
  }
  const fallback = error instanceof Error ? error.message : String(error);
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    switch (name) {
      case "NotAllowedError":
        return `Permission denied while ${context}. Browser blocked camera access.`;
      case "NotFoundError":
        return `No matching device found while ${context}. Ensure the virtual camera is enabled.`;
      case "NotReadableError":
        return `Camera could not be started while ${context}. It may be in use by another app.`;
      case "OverconstrainedError":
        return `Requested constraints could not be satisfied while ${context}.`;
      case "NotSupportedError":
        return `The browser does not support this operation while ${context}.`;
      default:
        return `${name} while ${context}: ${fallback}`;
    }
  }
  return `Error while ${context}: ${fallback}`;
}

async function run(): Promise<void> {
  window.__realcameraFaceDemo = { ready: false };
  setStatus("Installing RealCamera…");

  RealCamera.install({
    mode: "proxy",
    virtualPermission: "allow",
    blockPhysicalDevices: true,
  });

  const deviceId = RealCamera.createVirtualDevice({
    label: "RealCamera Face Fixture",
    defaultConstraints: { width: 640, height: 480, frameRate: 10 },
  });
  const altDeviceId = RealCamera.createVirtualDevice({
    label: "RealCamera Color Fixture",
    defaultConstraints: { width: 640, height: 480, frameRate: 10 },
  });

  const fixture = document.getElementById("faceSource") as HTMLImageElement | null;
  if (!fixture) {
    throw new Error("Fixture image not found.");
  }
  await fixture.decode();

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = 640;
  sourceCanvas.height = 480;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Source canvas context not found.");
  }

  let sourceMode: "face" | "blank" = "face";
  const startTime = performance.now();
  let lastFrameTime = 0;
  const maxFps = 24;

  const renderSource = (timestamp: number) => {
    if (timestamp - lastFrameTime < 1000 / maxFps) {
      requestAnimationFrame(renderSource);
      return;
    }
    lastFrameTime = timestamp;
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);

    if (sourceMode === "face") {
      sourceCtx.fillStyle = "#111827";
      sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      const elapsed = (timestamp - startTime) / 1000;
      const offsetX = Math.sin(elapsed * 1.3) * 12;
      const offsetY = Math.cos(elapsed * 1.1) * 8;
      const targetWidth = 420;
      const targetHeight = 420;
      const x = (sourceCanvas.width - targetWidth) / 2 + offsetX;
      const y = (sourceCanvas.height - targetHeight) / 2 + offsetY;
      sourceCtx.drawImage(fixture, x, y, targetWidth, targetHeight);
    } else {
      sourceCtx.fillStyle = "#0f172a";
      sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceCtx.fillStyle = "#94a3b8";
      sourceCtx.font = "24px sans-serif";
      sourceCtx.fillText("NO FACE", 24, 48);
    }

    requestAnimationFrame(renderSource);
  };
  requestAnimationFrame(renderSource);

  const updateModeButtons = () => {
    if (showFaceButton) {
      showFaceButton.classList.toggle("active", sourceMode === "face");
    }
    if (showNoFaceButton) {
      showNoFaceButton.classList.toggle("active", sourceMode === "blank");
    }
  };
  updateModeButtons();

  showFaceButton?.addEventListener("click", () => {
    sourceMode = "face";
    updateModeButtons();
  });
  showNoFaceButton?.addEventListener("click", () => {
    sourceMode = "blank";
    updateModeButtons();
  });

  RealCamera.setVirtualSource(deviceId, {
    type: "canvas",
    element: sourceCanvas,
  });
  RealCamera.setVirtualSource(altDeviceId, {
    type: "callback",
    draw: (ctx, info) => {
      ctx.fillStyle = "#9b5de5";
      ctx.fillRect(0, 0, info.width, info.height);
      ctx.fillStyle = "white";
      ctx.font = "28px sans-serif";
      ctx.fillText("Alt Device", 24, 48);
    },
  });

  const video = document.getElementById("virtualVideo") as HTMLVideoElement | null;
  if (!video) {
    throw new Error("Video element not found.");
  }

  let currentStream: MediaStream | null = null;
  let currentMode: "virtual" | "physical" = "virtual";

  const attachStream = async (stream: MediaStream): Promise<void> => {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }
    currentStream = stream;
    video.srcObject = stream;
    video.play().catch(() => undefined);
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      video.addEventListener("loadeddata", () => resolve(), { once: true });
    });
  };

  const updateModeUi = (): void => {
    if (useVirtualButton) {
      useVirtualButton.classList.toggle("active", currentMode === "virtual");
    }
    if (usePhysicalButton) {
      usePhysicalButton.classList.toggle("active", currentMode === "physical");
    }
    if (virtualControls) {
      virtualControls.hidden = currentMode !== "virtual";
    }
    if (physicalControls) {
      physicalControls.hidden = currentMode !== "physical";
    }
  };

  const startVirtualStream = async (): Promise<MediaStream> => {
    setStatus("Requesting virtual camera stream…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: 640,
        height: 480,
        frameRate: 10,
      },
      audio: false,
    });
    await attachStream(stream);
    currentMode = "virtual";
    updateModeUi();
    return stream;
  };

  const startPhysicalStream = async (): Promise<void> => {
    RealCamera.setPhysicalDevicesEnabled(true);
    setStatus("Requesting real webcam stream…");
    const selectedId = physicalSelect?.value ?? "";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: selectedId ? { deviceId: { exact: selectedId } } : true,
      audio: false,
    });
    await attachStream(stream);
    currentMode = "physical";
    updateModeUi();
  };

  updateModeUi();
  const stream = await startVirtualStream();

  const overlay = document.getElementById("overlay") as HTMLCanvasElement | null;
  if (!overlay) {
    throw new Error("Overlay canvas not found.");
  }
  overlay.width = 640;
  overlay.height = 480;
  const ctx = overlay.getContext("2d");
  if (!ctx) {
    throw new Error("Overlay context not found.");
  }

  setStatus("Loading MediaPipe Face Detector…");
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  const detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_MODEL_URL,
    },
    runningMode: "VIDEO",
  });

  setStatus("Running detection…");
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const runDetection = () => {
    if (video.readyState < 2 || video.videoWidth === 0) {
      return [];
    }
    const result = detector.detectForVideo(video, performance.now());
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#30e0a1";

    const detections = (result?.detections ?? []).map((detection) => {
      const box = detection.boundingBox ?? {
        originX: 0,
        originY: 0,
        width: 0,
        height: 0,
      };
      ctx.strokeRect(box.originX, box.originY, box.width, box.height);
      return {
        score: detection.categories?.[0]?.score ?? 0,
        boundingBox: {
          originX: box.originX,
          originY: box.originY,
          width: box.width,
          height: box.height,
        },
      };
    });

    if (window.__realcameraFaceDemo) {
      window.__realcameraFaceDemo.detections = detections;
    }

    setStatus(
      detections.length > 0
        ? `Detection complete: ${detections.length} face(s).`
        : "No faces detected."
    );

    return detections;
  };

  let detections = runDetection();
  for (let i = 0; i < 9 && detections.length === 0; i += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    detections = runDetection();
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const settings = stream.getVideoTracks()[0]?.getSettings();
  let altSettings: MediaTrackSettings | undefined;
  try {
    const altStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: altDeviceId }, width: 320, height: 240 },
      audio: false,
    });
    altSettings = altStream.getVideoTracks()[0]?.getSettings();
    altStream.getTracks().forEach((track) => track.stop());
  } catch {
    altSettings = undefined;
  }

  window.__realcameraFaceDemo = {
    ready: true,
    deviceId,
    devices,
    detections,
    settings,
    altDeviceId,
    altSettings,
  };

  const loopIntervalMs = 300;
  let lastTick = 0;
  const detectionLoop = () => {
    const now = performance.now();
    if (now - lastTick >= loopIntervalMs) {
      lastTick = now;
      detections = runDetection();
    }
    requestAnimationFrame(detectionLoop);
  };
  detectionLoop();

  const refreshPhysicalDevices = async (): Promise<void> => {
    if (!physicalSelect) {
      return;
    }
    try {
      RealCamera.setPhysicalDevicesEnabled(true);
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const physicalDevices = allDevices.filter(
        (device) =>
          device.kind === "videoinput" && !device.deviceId.startsWith("realcamera")
      );
      const previous = physicalSelect.value;
      physicalSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select a real webcam";
      physicalSelect.appendChild(placeholder);
      physicalDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${device.deviceId.slice(0, 6)}`;
        physicalSelect.appendChild(option);
      });
      if (previous) {
        physicalSelect.value = previous;
      }
      if (currentMode === "physical") {
        if (physicalDevices.length === 0) {
          setStatus("No real webcams found. Plug one in or request access.");
        } else {
          setStatus(`Found ${physicalDevices.length} real webcam(s).`);
        }
      }
    } catch (error) {
      setError(explainError(error, "refreshing real webcams"));
    }
  };

  const requestPhysicalAccess = async (): Promise<void> => {
    try {
      RealCamera.setPhysicalDevicesEnabled(true);
      setStatus("Requesting real webcam permission…");
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());
      setStatus("Real webcam permission granted.");
      await refreshPhysicalDevices();
    } catch (error) {
      setError(explainError(error, "requesting real webcam permission"));
    }
  };

  useVirtualButton?.addEventListener("click", () => {
    startVirtualStream().catch((error) =>
      setError(explainError(error, "starting virtual stream"))
    );
  });

  usePhysicalButton?.addEventListener("click", () => {
    refreshPhysicalDevices()
      .then(() => startPhysicalStream())
      .catch((error) =>
        setError(explainError(error, "starting real webcam"))
      );
  });

  refreshPhysicalButton?.addEventListener("click", () => {
    refreshPhysicalDevices();
  });

  requestPhysicalButton?.addEventListener("click", () => {
    requestPhysicalAccess();
  });

  startPhysicalButton?.addEventListener("click", () => {
    startPhysicalStream().catch((error) =>
      setError(explainError(error, "starting real webcam"))
    );
  });

  physicalSelect?.addEventListener("change", () => {
    if (currentMode !== "physical") {
      return;
    }
    startPhysicalStream().catch((error) =>
      setError(explainError(error, "switching real webcam"))
    );
  });

}

run().catch((error) => {
  window.__realcameraFaceDemo = {
    ready: true,
    error: explainError(error, "running the demo"),
  };
  setError(explainError(error, "running the demo"));
});

window.addEventListener("error", (event) => {
  setError(explainError(event.error ?? event.message, "processing the page"));
});

window.addEventListener("unhandledrejection", (event) => {
  setError(explainError(event.reason, "processing the page"));
});
