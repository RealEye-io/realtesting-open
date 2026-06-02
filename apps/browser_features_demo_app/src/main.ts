import "./../style.css";

import {
  RealBrowserFeatures,
  type PopupMode,
} from "@realeye/realtesting-browser-features";

const enterFullscreenButton = document.getElementById("enterFullscreen") as HTMLButtonElement | null;
const exitFullscreenButton = document.getElementById("exitFullscreen") as HTMLButtonElement | null;

const popupModeSelect = document.getElementById("popupMode") as HTMLSelectElement | null;
const openPopupButton = document.getElementById("openPopup") as HTMLButtonElement | null;
const closeLastPopupButton = document.getElementById("closeLastPopup") as HTMLButtonElement | null;
const closeAllPopupsButton = document.getElementById("closeAllPopups") as HTMLButtonElement | null;

const clipboardInput = document.getElementById("clipboardInput") as HTMLInputElement | null;
const execCommandInput = document.getElementById("execCommandInput") as HTMLInputElement | null;
const copyClipboardApiButton = document.getElementById("copyClipboardApi") as HTMLButtonElement | null;
const pasteClipboardApiButton = document.getElementById("pasteClipboardApi") as HTMLButtonElement | null;
const copyExecCommandButton = document.getElementById("copyExecCommand") as HTMLButtonElement | null;
const clipboardReadback = document.getElementById("clipboardReadback") as HTMLPreElement | null;

const statusText = document.getElementById("statusText") as HTMLPreElement | null;
const errorBox = document.getElementById("errorBox") as HTMLDivElement | null;

let lastPopup: Window | null = null;

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

function updateStatus(): void {
  if (!statusText) {
    return;
  }

  const popupMode = RealBrowserFeatures.getPopupMode();
  const clipboardText = RealBrowserFeatures.getClipboardText();
  const fullscreenActive = RealBrowserFeatures.isFullscreenActive();
  const virtualPopups = RealBrowserFeatures.listVirtualPopups();
  const docFullscreen = Boolean((document as any).fullscreenElement);

  statusText.textContent = JSON.stringify(
    {
      popupMode,
      fullscreen: { active: fullscreenActive, documentFullscreenElement: docFullscreen },
      clipboard: { text: clipboardText },
      virtualPopups,
      lastPopup: lastPopup
        ? {
            closed: (lastPopup as any).closed === true,
            href: (lastPopup as any).location?.href,
            virtualPopupId: (lastPopup as any).__realtesting_virtual_popup_id__,
          }
        : null,
    },
    null,
    2
  );
}

async function enterFullscreen(): Promise<void> {
  clearError();
  try {
    const el = document.documentElement;
    const fn =
      (el as any).requestFullscreen ||
      (el as any).requestFullScreen ||
      (el as any).webkitRequestFullscreen ||
      (el as any).webkitRequestFullScreen ||
      (el as any).mozRequestFullScreen ||
      (el as any).msRequestFullscreen;
    if (typeof fn !== "function") {
      throw new Error("requestFullscreen is not available");
    }
    await fn.call(el);
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

async function exitFullscreen(): Promise<void> {
  clearError();
  try {
    const doc: any = document;
    const fn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
    if (typeof fn !== "function") {
      throw new Error("exitFullscreen is not available");
    }
    await fn.call(document);
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

function onPopupModeChange(): void {
  if (!popupModeSelect) {
    return;
  }
  const value = (popupModeSelect.value || "prefer-native") as PopupMode;
  RealBrowserFeatures.setPopupMode(value);
  updateStatus();
}

function openPopup(): void {
  clearError();
  try {
    lastPopup = window.open("about:blank?realtesting=1", "_blank");
  } catch (err) {
    setError(err);
    lastPopup = null;
  } finally {
    updateStatus();
  }
}

function closeLastPopup(): void {
  clearError();
  try {
    if (lastPopup && typeof (lastPopup as any).close === "function") {
      (lastPopup as any).close();
    }
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

function closeAllPopups(): void {
  clearError();
  try {
    RealBrowserFeatures.closeAllPopups();
    lastPopup = null;
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

async function copyViaClipboardApi(): Promise<void> {
  clearError();
  try {
    const text = clipboardInput?.value ?? "";
    await navigator.clipboard.writeText(text);
    RealBrowserFeatures.setClipboardText(text);
    if (clipboardReadback) {
      clipboardReadback.textContent = `writeText("${text}")`;
    }
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

async function pasteViaClipboardApi(): Promise<void> {
  clearError();
  try {
    const text = await navigator.clipboard.readText();
    if (clipboardReadback) {
      clipboardReadback.textContent = `readText() -> "${text}"`;
    }
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

function copyViaExecCommand(): void {
  clearError();
  try {
    if (execCommandInput) {
      execCommandInput.focus();
      execCommandInput.select();
    }
    const ok = document.execCommand("copy");
    if (clipboardReadback) {
      clipboardReadback.textContent = `execCommand("copy") -> ${ok ? "true" : "false"}`;
    }
  } catch (err) {
    setError(err);
  } finally {
    updateStatus();
  }
}

function bindUi(): void {
  enterFullscreenButton?.addEventListener("click", () => void enterFullscreen());
  exitFullscreenButton?.addEventListener("click", () => void exitFullscreen());

  popupModeSelect?.addEventListener("change", () => onPopupModeChange());
  openPopupButton?.addEventListener("click", () => openPopup());
  closeLastPopupButton?.addEventListener("click", () => closeLastPopup());
  closeAllPopupsButton?.addEventListener("click", () => closeAllPopups());

  copyClipboardApiButton?.addEventListener("click", () => void copyViaClipboardApi());
  pasteClipboardApiButton?.addEventListener("click", () => void pasteViaClipboardApi());
  copyExecCommandButton?.addEventListener("click", () => copyViaExecCommand());

  document.addEventListener("fullscreenchange", () => updateStatus());
}

function init(): void {
  RealBrowserFeatures.install({
    popupMode: "virtual",
    testApi: { autoEnable: true },
  });

  bindUi();
  if (popupModeSelect) {
    popupModeSelect.value = RealBrowserFeatures.getPopupMode();
  }
  updateStatus();
}

init();

