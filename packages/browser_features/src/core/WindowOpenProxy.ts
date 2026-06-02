import type { PopupMode, VirtualPopupState } from "../types";
import { patchValue, type PatchRestore } from "../utils/patch";
import { VirtualPopup } from "./VirtualPopup";

type GestureHooks = {
  isRequired: () => boolean;
  consume: () => boolean;
};

export class WindowOpenProxy {
  private installed = false;
  private popupMode: PopupMode = "prefer-native";

  private originalOpen?: Window["open"];
  private restoreOpen: PatchRestore | null = null;

  private nextId = 1;
  private virtualPopups = new Map<string, VirtualPopup>();

  private gestureHooks: GestureHooks = {
    isRequired: () => false,
    consume: () => true,
  };

  setGestureHooks(hooks: GestureHooks): void {
    this.gestureHooks = hooks;
  }

  install(initialMode: PopupMode): void {
    if (this.installed) {
      this.popupMode = initialMode;
      return;
    }
    if (typeof window === "undefined") {
      throw new Error("RealTesting: window is not available.");
    }
    this.popupMode = initialMode;
    this.originalOpen = window.open ? window.open.bind(window) : undefined;

    try {
      this.restoreOpen = patchValue(window, "open", this.openProxy.bind(this));
    } catch {
      // Best-effort fallback for environments where defineProperty is restricted.
      const original = window.open;
      (window as any).open = this.openProxy.bind(this);
      this.restoreOpen = () => {
        try {
          (window as any).open = original;
        } catch {
          // ignore
        }
      };
    }
    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }
    this.restoreOpen?.();
    this.restoreOpen = null;
    this.installed = false;
    this.virtualPopups.clear();
  }

  setPopupMode(mode: PopupMode): void {
    this.popupMode = mode;
  }

  getPopupMode(): PopupMode {
    return this.popupMode;
  }

  listVirtualPopups(): VirtualPopupState[] {
    return Array.from(this.virtualPopups.values()).map((p) => ({ ...p.state }));
  }

  closeAllVirtualPopups(): void {
    this.virtualPopups.forEach((p) => p.close());
    this.virtualPopups.clear();
  }

  private openProxy(url?: string | URL, target?: string, features?: string): Window | null {
    const mode = this.popupMode;
    const resolvedUrl = typeof url === "string" ? url : url?.toString() ?? "about:blank";

    if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
      // Match common browser behavior: popup blocked.
      return null;
    }

    if (mode === "block") {
      return null;
    }

    if (mode === "native") {
      return this.originalOpen ? this.originalOpen(resolvedUrl, target, features) : null;
    }

    if (mode === "virtual") {
      return this.createVirtualPopup(resolvedUrl, target).handle;
    }

    if (mode === "prefer-virtual") {
      return this.createVirtualPopup(resolvedUrl, target).handle;
    }

    // prefer-native
    const native = this.originalOpen ? this.originalOpen(resolvedUrl, target, features) : null;
    if (native) {
      return native;
    }
    return this.createVirtualPopup(resolvedUrl, target).handle;
  }

  private createVirtualPopup(url: string, target?: string): VirtualPopup {
    const id = `realtesting-popup-${this.nextId++}`;
    const popup = new VirtualPopup({ id, url, target, opener: window });
    this.virtualPopups.set(id, popup);
    return popup;
  }
}
