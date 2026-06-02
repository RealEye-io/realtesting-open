import { patchGetter, patchValue, type PatchRestore } from "../utils/patch";
import { getRealTestingTiming } from "../utils/realtestingTiming";

type GestureHooks = {
  isRequired: () => boolean;
  consume: () => boolean;
};

function notAllowedError(message: string): Error {
  return typeof DOMException !== "undefined"
    ? new DOMException(message, "NotAllowedError")
    : (Object.assign(new Error(message), { name: "NotAllowedError" }) as Error);
}

type FullscreenState = {
  element: Element | null;
};

export class FullscreenProxy {
  private installed = false;
  private state: FullscreenState = { element: null };

  private gestureHooks: GestureHooks = {
    isRequired: () => false,
    consume: () => true,
  };

  private restores: PatchRestore[] = [];

  setGestureHooks(hooks: GestureHooks): void {
    this.gestureHooks = hooks;
  }

  install(): void {
    if (this.installed) {
      return;
    }
    if (typeof document === "undefined" || typeof window === "undefined") {
      throw new Error("RealTesting: window/document are not available.");
    }

    // Patch requestFullscreen variants used by ET Platform.
    const self = this;
    const request = function (this: Element) {
      return self.requestFullscreenForElement(this);
    };
    this.patchElementMethod("requestFullscreen", request);
    this.patchElementMethod("requestFullScreen", request);
    this.patchElementMethod("webkitRequestFullscreen", request);
    this.patchElementMethod("webkitRequestFullScreen", request);
    this.patchElementMethod("mozRequestFullScreen", request);
    this.patchElementMethod("msRequestFullscreen", request);

    // Patch exitFullscreen variants used by ET Platform.
    const exit = function (this: Document) {
      void this;
      return self.exitFullscreen();
    };
    this.patchDocumentMethod("exitFullscreen", exit);
    this.patchDocumentMethod("webkitExitFullscreen", exit);
    this.patchDocumentMethod("mozCancelFullScreen", exit);
    this.patchDocumentMethod("msExitFullscreen", exit);

    // Patch fullscreenElement getters so app code can observe virtual fullscreen state.
    this.patchDocumentGetter("fullscreenElement", () => this.state.element);
    this.patchDocumentGetter("webkitFullscreenElement", () => this.state.element);
    this.patchDocumentGetter("mozFullScreenElement", () => this.state.element);
    this.patchDocumentGetter("msFullscreenElement", () => this.state.element);

    this.patchDocumentGetter("fullscreenEnabled", () => true);
    this.patchDocumentGetter("webkitFullscreenEnabled", () => true);

    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }
    this.state.element = null;
    this.restores.forEach((restore) => restore());
    this.restores = [];
    this.installed = false;
  }

  isFullscreenActive(): boolean {
    return Boolean(this.state.element);
  }

  private patchElementMethod(key: string, fn: (...args: any[]) => any): void {
    try {
      const restore = patchValue((Element.prototype as any), key, fn);
      this.restores.push(restore);
    } catch {
      // ignore
    }
  }

  private patchDocumentMethod(key: string, fn: (...args: any[]) => any): void {
    try {
      const restore = patchValue((Document.prototype as any), key, fn);
      this.restores.push(restore);
    } catch {
      // ignore
    }
  }

  private patchDocumentGetter(key: string, getter: () => unknown): void {
    try {
      const restore = patchGetter((Document.prototype as any), key, getter);
      this.restores.push(restore);
    } catch {
      // ignore
    }
  }

  private async requestFullscreenForElement(element: Element): Promise<void> {
    if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
      throw notAllowedError("Fullscreen requires a user gesture.");
    }

    const timing = getRealTestingTiming("browser-features");
    if (timing.enabled) {
      await timing.delay("features.userAction");
    }

    this.state.element = element;
    try {
      document.dispatchEvent(new Event("fullscreenchange"));
    } catch {
      // ignore
    }
  }

  private async exitFullscreen(): Promise<void> {
    const timing = getRealTestingTiming("browser-features");
    if (timing.enabled) {
      await timing.delay("features.userAction");
    }
    this.state.element = null;
    try {
      document.dispatchEvent(new Event("fullscreenchange"));
    } catch {
      // ignore
    }
  }
}
