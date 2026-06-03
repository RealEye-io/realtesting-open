import { RealCamera } from "@realeye-io/realtesting-camera";

const deviceSelect = document.getElementById("deviceSelect") as HTMLSelectElement | null;
const refreshButton = document.getElementById("refreshDevices") as HTMLButtonElement | null;
const requestPermissionButton = document.getElementById(
  "requestPermission"
) as HTMLButtonElement | null;
const togglePhysicalButton = document.getElementById("togglePhysical") as HTMLButtonElement | null;
const startStreamButton = document.getElementById("startStream") as HTMLButtonElement | null;
const preview = document.getElementById("preview") as HTMLVideoElement | null;
const deviceList = document.getElementById("deviceList");
const statusEl = document.getElementById("status");
const virtualSelect = document.getElementById("virtualSelect") as HTMLSelectElement | null;
const virtualWidth = document.getElementById("virtualWidth") as HTMLInputElement | null;
const virtualHeight = document.getElementById("virtualHeight") as HTMLInputElement | null;
const virtualFps = document.getElementById("virtualFps") as HTMLInputElement | null;
const applyVirtualParamsButton = document.getElementById(
  "applyVirtualParams"
) as HTMLButtonElement | null;
const toggleVirtualButton = document.getElementById("toggleVirtual") as HTMLButtonElement | null;
const virtualImageInput = document.getElementById("virtualImage") as HTMLInputElement | null;
const virtualColorInput = document.getElementById("virtualColor") as HTMLInputElement | null;
const applyVirtualColorButton = document.getElementById(
  "applyVirtualColor"
) as HTMLButtonElement | null;
const applyTestPatternButton = document.getElementById(
  "applyTestPattern"
) as HTMLButtonElement | null;
const devtoolsPanel = document.getElementById("devtoolsPanel");
const devToolbar = document.getElementById("devToolbar");
const toggleDevtoolsButton = document.getElementById(
  "toggleDevtools"
) as HTMLButtonElement | null;

let physicalEnabled = true;
let physicalPermissionGranted = false;
const virtualImages = new Map<string, HTMLImageElement>();
const isDevtoolsPage =
  (window as Window & { __REALCAMERA_DEVTOOLS_PAGE__?: boolean })
    .__REALCAMERA_DEVTOOLS_PAGE__ === true;
const devtoolsEnabled = resolveDevtoolsEnabled();

RealCamera.install({
  mode: "proxy",
  virtualPermission: "allow",
  blockPhysicalDevices: false,
});

const virtualA = RealCamera.createVirtualDevice({
  label: "RealCamera Virtual A",
  defaultConstraints: { width: 640, height: 480, frameRate: 12 },
});
const virtualB = RealCamera.createVirtualDevice({
  label: "RealCamera Virtual B",
  defaultConstraints: { width: 640, height: 480, frameRate: 12 },
});

RealCamera.setVirtualSource(virtualA, {
  type: "callback",
  draw: (ctx, info) => {
    ctx.fillStyle = "#1f6feb";
    ctx.fillRect(0, 0, info.width, info.height);
    ctx.fillStyle = "white";
    ctx.font = "24px sans-serif";
    ctx.fillText("Virtual A", 24, 48);
  },
});

RealCamera.setVirtualSource(virtualB, {
  type: "callback",
  draw: (ctx, info) => {
    ctx.fillStyle = "#f97316";
    ctx.fillRect(0, 0, info.width, info.height);
    ctx.fillStyle = "white";
    ctx.font = "24px sans-serif";
    ctx.fillText("Virtual B", 24, 48);
  },
});

applyDevtoolsVisibility(devtoolsEnabled || isDevtoolsPage);

async function refreshDevices(): Promise<void> {
  if (!deviceSelect || !deviceList) {
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === "videoinput");
    deviceSelect.innerHTML = "";
    videoInputs.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${device.deviceId.slice(0, 6)}`;
      deviceSelect.appendChild(option);
    });
    deviceList.textContent = videoInputs
      .map((device) => `${device.label || "(no label)"} • ${device.deviceId}`)
      .join("\n");
    const hasPhysicalLabel = videoInputs.some(
      (device) => !device.deviceId.startsWith("realcamera") && device.label
    );
    if (!hasPhysicalLabel && physicalEnabled && !physicalPermissionGranted) {
      setStatus(
        "No physical labels yet. Click \"Request Physical Access\" to unlock real cameras."
      );
    } else {
      setStatus(`Loaded ${videoInputs.length} video input(s).`);
    }
  } catch (error) {
    setError(explainError(error, "enumerating devices"));
  }
}

function refreshVirtualControls(): void {
  if (!virtualSelect || !virtualWidth || !virtualHeight || !virtualFps) {
    return;
  }
  const devices = RealCamera.listVirtualDevices();
  virtualSelect.innerHTML = "";
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.label;
    virtualSelect.appendChild(option);
  });
  const selectedId = virtualSelect.value || devices[0]?.id;
  if (!selectedId) {
    return;
  }
  virtualSelect.value = selectedId;
  const selected = devices.find((device) => device.id === selectedId);
  if (!selected) {
    return;
  }
  const defaults = selected.defaultConstraints as MediaTrackConstraints;
  virtualWidth.value = String(defaults.width ?? 640);
  virtualHeight.value = String(defaults.height ?? 480);
  virtualFps.value = String(defaults.frameRate ?? 12);
  if (toggleVirtualButton) {
    toggleVirtualButton.textContent = selected.enabled ? "Disconnect" : "Connect";
  }
}

function getSelectedVirtualId(): string | null {
  if (!virtualSelect) {
    return null;
  }
  return virtualSelect.value || null;
}

async function applyVirtualParams(): Promise<void> {
  const deviceId = getSelectedVirtualId();
  if (!deviceId || !virtualWidth || !virtualHeight || !virtualFps) {
    return;
  }
  try {
    const width = Number(virtualWidth.value);
    const height = Number(virtualHeight.value);
    const frameRate = Number(virtualFps.value);
    RealCamera.updateVirtualDevice(deviceId, {
      defaultConstraints: { width, height, frameRate },
    });
    setStatus("Virtual params updated. Restart stream to apply new resolution.");
  } catch (error) {
    setError(explainError(error, "updating virtual constraints"));
  }
}

function applyColorSource(): void {
  const deviceId = getSelectedVirtualId();
  if (!deviceId) {
    return;
  }
  try {
    const color = virtualColorInput?.value ?? "#1f6feb";
    RealCamera.setVirtualSource(deviceId, {
      type: "callback",
      draw: (ctx, info) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, info.width, info.height);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.fillText(`Color ${color}`, 24, 48);
      },
    });
    setStatus("Virtual source set to solid color.");
  } catch (error) {
    setError(explainError(error, "setting color source"));
  }
}

function applyTestPattern(): void {
  const deviceId = getSelectedVirtualId();
  if (!deviceId) {
    return;
  }
  try {
    RealCamera.setVirtualSource(deviceId, {
      type: "callback",
      draw: (ctx, info) => {
        const gradient = ctx.createLinearGradient(0, 0, info.width, info.height);
        gradient.addColorStop(0, "#22d3ee");
        gradient.addColorStop(1, "#a855f7");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, info.width, info.height);
        ctx.fillStyle = "white";
        ctx.font = "22px sans-serif";
        ctx.fillText("RealCamera Test Pattern", 24, 48);
        ctx.fillText(`Frame ${info.frameIndex}`, 24, 78);
      },
    });
    setStatus("Virtual source set to test pattern.");
  } catch (error) {
    setError(explainError(error, "setting test pattern"));
  }
}

async function applyImageSource(file: File): Promise<void> {
  const deviceId = getSelectedVirtualId();
  if (!deviceId) {
    return;
  }
  try {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    virtualImages.set(deviceId, image);
    RealCamera.setVirtualSource(deviceId, {
      type: "image",
      element: image,
    });
    setStatus(`Virtual source replaced with ${file.name}.`);
  } catch (error) {
    setError(explainError(error, "loading the image file"));
  }
}

function toggleVirtualDevice(): void {
  const deviceId = getSelectedVirtualId();
  if (!deviceId) {
    return;
  }
  const current = RealCamera.listVirtualDevices().find(
    (device) => device.id === deviceId
  );
  if (!current) {
    return;
  }
  try {
    RealCamera.setVirtualEnabled(deviceId, !current.enabled);
    refreshDevices();
    refreshVirtualControls();
    setStatus(
      current.enabled ? "Virtual device disconnected." : "Virtual device connected."
    );
  } catch (error) {
    setError(explainError(error, "toggling the virtual device"));
  }
}

async function requestPhysicalPermission(): Promise<void> {
  try {
    setStatus("Requesting physical camera permission…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    physicalPermissionGranted = true;
    setStatus("Physical camera permission granted.");
    await refreshDevices();
  } catch (error) {
    setError(explainError(error, "requesting physical permission"));
  }
}

async function startStream(): Promise<void> {
  if (!deviceSelect || !preview) {
    return;
  }
  const deviceId = deviceSelect.value;
  try {
    setStatus("Starting stream…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
        : true,
      audio: false,
    });
    preview.srcObject = stream;
    await preview.play();
    setStatus("Streaming.");
  } catch (error) {
    setError(explainError(error, "starting the stream"));
  }
}

refreshButton?.addEventListener("click", () => {
  refreshDevices();
});

togglePhysicalButton?.addEventListener("click", () => {
  physicalEnabled = !physicalEnabled;
  RealCamera.setPhysicalDevicesEnabled(physicalEnabled);
  if (togglePhysicalButton) {
    togglePhysicalButton.textContent = physicalEnabled
      ? "Disable Physical Devices"
      : "Enable Physical Devices";
  }
  refreshDevices();
});

requestPermissionButton?.addEventListener("click", () => {
  requestPhysicalPermission();
});

startStreamButton?.addEventListener("click", () => {
  startStream();
});

virtualSelect?.addEventListener("change", () => {
  refreshVirtualControls();
});

applyVirtualParamsButton?.addEventListener("click", () => {
  applyVirtualParams();
});

applyVirtualColorButton?.addEventListener("click", () => {
  applyColorSource();
});

applyTestPatternButton?.addEventListener("click", () => {
  applyTestPattern();
});

virtualImageInput?.addEventListener("change", (event) => {
  const input = event.currentTarget as HTMLInputElement;
  if (!input.files || input.files.length === 0) {
    return;
  }
  applyImageSource(input.files[0]).catch((error) => {
    setStatus(
      `Failed to load image: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  });
});

toggleVirtualButton?.addEventListener("click", () => {
  toggleVirtualDevice();
});

toggleDevtoolsButton?.addEventListener("click", () => {
  if (!devtoolsPanel) {
    return;
  }
  const nextHidden = !devtoolsPanel.hidden;
  devtoolsPanel.hidden = nextHidden;
  if (toggleDevtoolsButton) {
    toggleDevtoolsButton.textContent = nextHidden ? "Show" : "Hide";
  }
});

function setStatus(message: string): void {
  if (!statusEl) {
    return;
  }
  statusEl.classList.remove("status--error");
  statusEl.textContent = message;
}

function setError(message: string): void {
  if (!statusEl) {
    return;
  }
  statusEl.classList.add("status--error");
  statusEl.textContent = message;
}

function explainError(error: unknown, context: string): string {
  const fallback = error instanceof Error ? error.message : String(error);
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    switch (name) {
      case "NotAllowedError":
        return `Permission denied while ${context}. The browser blocked camera access or permission was not granted.`;
      case "NotFoundError":
        return `No matching device found while ${context}. Check the selected camera or enable a virtual device.`;
      case "NotReadableError":
        return `The camera could not be started while ${context}. It may be in use by another app.`;
      case "OverconstrainedError":
        return `Requested constraints could not be satisfied while ${context}. Try a lower resolution or FPS.`;
      case "NotSupportedError":
        return `The browser does not support this operation while ${context}.`;
      default:
        return `${name} while ${context}: ${fallback}`;
    }
  }
  return `Error while ${context}: ${fallback}`;
}

window.addEventListener("error", (event) => {
  setError(explainError(event.error ?? event.message, "processing the page"));
});

window.addEventListener("unhandledrejection", (event) => {
  setError(explainError(event.reason, "processing the page"));
});

refreshDevices();
refreshVirtualControls();

function resolveDevtoolsEnabled(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("devtools") === "0" || params.get("devtools") === "off") {
    localStorage.removeItem("realcamera.devtools");
    return false;
  }
  if (params.has("devtools")) {
    localStorage.setItem("realcamera.devtools", "1");
    return true;
  }
  if ((window as Window & { __REALCAMERA_DEVTOOLS__?: boolean }).__REALCAMERA_DEVTOOLS__) {
    return true;
  }
  return localStorage.getItem("realcamera.devtools") === "1";
}

function applyDevtoolsVisibility(enabled: boolean): void {
  if (devtoolsPanel) {
    devtoolsPanel.hidden = !enabled;
  }
  if (devToolbar) {
    devToolbar.hidden = !enabled || isDevtoolsPage;
  }
  if (toggleDevtoolsButton && devtoolsPanel) {
    toggleDevtoolsButton.textContent = devtoolsPanel.hidden ? "Show" : "Hide";
  }
}
