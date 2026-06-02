import { patchValue, type PatchRestore } from "../utils/patch";
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

type ClipboardLike = {
  writeText: (text: string) => Promise<void>;
  readText: () => Promise<string>;
};

export class ClipboardProxy {
  private installed = false;
  private text = "";

  private gestureHooks: GestureHooks = {
    isRequired: () => false,
    consume: () => true,
  };

  private restoreNavigatorClipboard: PatchRestore | null = null;
  private restoreExecCommand: PatchRestore | null = null;

  private originalExecCommand?: Document["execCommand"];

  setGestureHooks(hooks: GestureHooks): void {
    this.gestureHooks = hooks;
  }

  install(initialText?: string): void {
    if (this.installed) {
      if (typeof initialText === "string") {
        this.text = initialText;
      }
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("RealTesting: window/document are not available.");
    }
    if (typeof initialText === "string") {
      this.text = initialText;
    }

    const clipboard: ClipboardLike = {
      writeText: async (value: string) => {
        if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
          throw notAllowedError("Clipboard writeText requires a user gesture.");
        }
        const timing = getRealTestingTiming("browser-features");
        if (timing.enabled) {
          await timing.delay("features.userAction");
        }
        this.text = String(value);
      },
      readText: async () => this.text,
    };

    // Wrap readText to preserve `this` binding and allow async delay.
    clipboard.readText = async () => {
      if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
        throw notAllowedError("Clipboard readText requires a user gesture.");
      }
      const timing = getRealTestingTiming("browser-features");
      if (timing.enabled) {
        await timing.delay("features.userAction");
      }
      return this.text;
    };

    try {
      // navigator.clipboard may be missing or restricted on insecure origins. We override it in tests.
      this.restoreNavigatorClipboard = patchValue(navigator as any, "clipboard", clipboard);
    } catch {
      this.restoreNavigatorClipboard = null;
    }

    this.originalExecCommand = document.execCommand ? document.execCommand.bind(document) : undefined;
    try {
      this.restoreExecCommand = patchValue(document as any, "execCommand", this.execCommandProxy.bind(this));
    } catch {
      this.restoreExecCommand = null;
    }

    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }
    this.restoreNavigatorClipboard?.();
    this.restoreNavigatorClipboard = null;
    this.restoreExecCommand?.();
    this.restoreExecCommand = null;
    this.installed = false;
  }

  setText(text: string): void {
    this.text = String(text);
  }

  getText(): string {
    return this.text;
  }

  private execCommandProxy(commandId: string, showUI?: boolean, value?: string): boolean {
    if (String(commandId).toLowerCase() === "copy") {
      if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
        return false;
      }
      const active = document.activeElement;
      if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        const start = active.selectionStart ?? 0;
        const end = active.selectionEnd ?? active.value.length;
        const selection = active.value.slice(start, end);
        this.text = selection.length > 0 ? selection : active.value;
        return true;
      }
      // Best-effort: no active text input, but still report success for deterministic tests.
      return true;
    }
    if (this.originalExecCommand) {
      return this.originalExecCommand(commandId, showUI, value);
    }
    return false;
  }
}

