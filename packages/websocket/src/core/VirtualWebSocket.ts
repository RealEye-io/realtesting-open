import type { VirtualWebSocketServerClient, VirtualWebSocketServerConfig } from "../types";
import { VirtualWebSocketServerRegistry } from "./VirtualWebSocketServerRegistry";
import { getRealTestingTiming } from "../utils/realtestingTiming";

function safeEvent(name: string): Event {
  try {
    return new Event(name);
  } catch {
    return { type: name } as unknown as Event;
  }
}

function safeMessageEvent(data: unknown): MessageEvent {
  try {
    return new MessageEvent("message", { data });
  } catch {
    const event = new Event("message") as MessageEvent;
    (event as any).data = data;
    return event;
  }
}

function safeCloseEvent(code: number, reason: string): CloseEvent {
  try {
    return new CloseEvent("close", { code, reason, wasClean: true });
  } catch {
    const event = new Event("close") as CloseEvent;
    (event as any).code = code;
    (event as any).reason = reason;
    (event as any).wasClean = true;
    return event;
  }
}

function normalizeProtocols(protocols?: string | string[]): string[] {
  if (!protocols) {
    return [];
  }
  if (Array.isArray(protocols)) {
    return protocols.map(String);
  }
  return [String(protocols)];
}

export class VirtualWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly CONNECTING = VirtualWebSocket.CONNECTING;
  readonly OPEN = VirtualWebSocket.OPEN;
  readonly CLOSING = VirtualWebSocket.CLOSING;
  readonly CLOSED = VirtualWebSocket.CLOSED;

  readonly url: string;
  readonly protocol: string = "";
  readonly extensions: string = "";

  binaryType: BinaryType = "blob";
  bufferedAmount = 0;

  readyState = VirtualWebSocket.CONNECTING;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  private registry: VirtualWebSocketServerRegistry;
  private protocols: string[];
  private serverId: string | null = null;
  private serverConfig: VirtualWebSocketServerConfig | null = null;
  private serverClient: VirtualWebSocketServerClient | null = null;
  private closed = false;
  private connectTimer?: number;
  private closeTimer?: number;

  constructor(
    url: string,
    protocols: string | string[] | undefined,
    registry: VirtualWebSocketServerRegistry
  ) {
    super();
    this.url = String(url);
    this.protocols = normalizeProtocols(protocols);
    this.registry = registry;

    const timing = getRealTestingTiming("websocket");
    const connectDelayMs = timing.enabled ? timing.sampleMs("websocket.connect") : 0;

    const resolved = this.registry.resolveServer(this.url);
    if (!resolved) {
      this.connectTimer = window.setTimeout(
        () => this.failConnection(),
        Math.max(0, connectDelayMs)
      );
      return;
    }

    this.serverId = resolved.id;
    this.serverConfig = resolved.config;
    this.serverClient = {
      url: this.url,
      protocols: this.protocols,
      push: (data) => this.receiveFromServer(data),
      close: (code, reason) => this.serverClose(code, reason),
    };

    this.registry.attachClient(this.serverId, this.serverClient);

    this.connectTimer = window.setTimeout(
      () => this.open(),
      Math.max(0, connectDelayMs)
    );
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== VirtualWebSocket.OPEN || this.closed) {
      throw new DOMException("WebSocket is not open.", "InvalidStateError");
    }
    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.message") : 0;
    window.setTimeout(() => {
      if (this.closed || this.readyState !== VirtualWebSocket.OPEN) {
        return;
      }
      this.serverConfig?.onMessage?.(this.serverClient!, data);
    }, Math.max(0, delayMs));
  }

  close(code: number = 1000, reason: string = ""): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = VirtualWebSocket.CLOSING;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }

    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.close") : 0;
    this.closeTimer = window.setTimeout(() => {
      if (this.readyState === VirtualWebSocket.CLOSED) {
        return;
      }
      try {
        this.serverConfig?.onClose?.(this.serverClient!, code, reason);
      } catch {
        // ignore server close failures
      }

      this.detachFromRegistry();
      this.readyState = VirtualWebSocket.CLOSED;
      const event = safeCloseEvent(code, reason);
      this.dispatchEvent(event);
      this.onclose?.(event);
    }, Math.max(0, delayMs));
  }

  private open(): void {
    if (this.closed || this.readyState !== VirtualWebSocket.CONNECTING) {
      return;
    }
    this.readyState = VirtualWebSocket.OPEN;
    const event = safeEvent("open");
    this.dispatchEvent(event);
    this.onopen?.(event);

    try {
      this.serverConfig?.onConnect?.(this.serverClient!);
    } catch {
      // ignore server failures on connect
    }
  }

  private receiveFromServer(data: string | ArrayBuffer | Blob): void {
    if (this.closed || this.readyState !== VirtualWebSocket.OPEN) {
      return;
    }
    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.message") : 0;
    window.setTimeout(() => {
      if (this.closed || this.readyState !== VirtualWebSocket.OPEN) {
        return;
      }
      const event = safeMessageEvent(data);
      this.dispatchEvent(event);
      this.onmessage?.(event);
    }, Math.max(0, delayMs));
  }

  private serverClose(code: number = 1000, reason: string = ""): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
    this.detachFromRegistry();
    this.readyState = VirtualWebSocket.CLOSED;
    const event = safeCloseEvent(code, reason);
    this.dispatchEvent(event);
    this.onclose?.(event);
  }

  private failConnection(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = VirtualWebSocket.CLOSED;
    const errorEvent = safeEvent("error");
    this.dispatchEvent(errorEvent);
    this.onerror?.(errorEvent);

    const closeEvent = safeCloseEvent(1006, "Virtual WebSocket server not found");
    this.dispatchEvent(closeEvent);
    this.onclose?.(closeEvent);
  }

  private detachFromRegistry(): void {
    if (!this.serverId || !this.serverClient) {
      return;
    }
    this.registry.detachClient(this.serverId, this.serverClient);
  }
}

