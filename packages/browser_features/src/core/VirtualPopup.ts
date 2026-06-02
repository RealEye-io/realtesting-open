import type { VirtualPopupState } from "../types";

export type VirtualPopupHandle = Window & {
  __realtesting_virtual_popup_id__?: string;
};

export class VirtualPopup {
  readonly id: string;
  readonly state: VirtualPopupState;
  readonly handle: VirtualPopupHandle;

  private readonly opener: Window;

  constructor(args: { id: string; url: string; target?: string; opener: Window }) {
    this.id = args.id;
    this.opener = args.opener;
    this.state = {
      id: args.id,
      url: args.url,
      target: args.target,
      closed: false,
    };

    // A minimal Window-like surface that ET Platform code typically uses.
    const popup: any = {
      closed: false,
      location: { href: args.url },
      opener: this.opener,
      focus: () => undefined,
      blur: () => undefined,
      close: () => this.close(),
      postMessage: (message: any, targetOrigin?: string) => {
        // In browsers, window.postMessage sends to the *target* window. This virtual window
        // does not have its own browsing context, so we forward to opener as a convenience.
        try {
          const event = new MessageEvent("message", {
            data: message,
            origin: typeof targetOrigin === "string" ? targetOrigin : this.opener.location.origin,
            source: (popup as any) as Window,
          });
          this.opener.dispatchEvent(event);
        } catch {
          // ignore
        }
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    popup.__realtesting_virtual_popup_id__ = args.id;
    this.handle = popup as VirtualPopupHandle;
  }

  close(): void {
    if (this.state.closed) {
      return;
    }
    this.state.closed = true;
    try {
      (this.handle as any).closed = true;
    } catch {
      // ignore
    }
  }
}

