type DataChannelState = "connecting" | "open" | "closing" | "closed";

import { getRealTestingTiming } from "../utils/realtestingTiming";

function safeMessageEvent(data: unknown): MessageEvent {
  try {
    return new MessageEvent("message", { data });
  } catch {
    const event = new Event("message") as MessageEvent;
    (event as any).data = data;
    return event;
  }
}

function payloadSize(data: unknown): number {
  if (typeof data === "string") {
    return data.length;
  }
  if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.size;
  }
  return 1;
}

export class VirtualRTCDataChannel extends EventTarget {
  readonly label: string;
  readonly id: number | null;
  readonly negotiated: boolean;
  readonly ordered: boolean;
  readonly maxPacketLifeTime: number | null;
  readonly maxRetransmits: number | null;

  readyState: DataChannelState = "connecting";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  binaryType: BinaryType = "blob";

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onbufferedamountlow: ((ev: Event) => void) | null = null;

  private peer: VirtualRTCDataChannel | null = null;
  private closeReason: { code?: number; reason?: string } | null = null;

  constructor(label: string, init: RTCDataChannelInit = {}) {
    super();
    this.label = label;
    this.id = typeof init.id === "number" ? init.id : null;
    this.negotiated = init.negotiated === true;
    this.ordered = init.ordered !== false;
    this.maxPacketLifeTime =
      typeof init.maxPacketLifeTime === "number" ? init.maxPacketLifeTime : null;
    this.maxRetransmits =
      typeof init.maxRetransmits === "number" ? init.maxRetransmits : null;
  }

  _linkPeer(peer: VirtualRTCDataChannel): void {
    this.peer = peer;
  }

  _open(): void {
    if (this.readyState === "closed") {
      return;
    }
    this.readyState = "open";
    const event = new Event("open");
    this.dispatchEvent(event);
    this.onopen?.(event);
  }

  _receive(data: unknown): void {
    if (this.readyState !== "open") {
      return;
    }
    const event = safeMessageEvent(data);
    this.dispatchEvent(event);
    this.onmessage?.(event);
  }

  _remoteClose(code?: number, reason?: string): void {
    if (this.readyState === "closed") {
      return;
    }
    this.closeReason = { code, reason };
    this.readyState = "closed";
    const event = new Event("close");
    this.dispatchEvent(event);
    this.onclose?.(event);
  }

  send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== "open") {
      throw new DOMException("DataChannel is not open.", "InvalidStateError");
    }
    const size = payloadSize(data);
    this.bufferedAmount += size;

    const timing = getRealTestingTiming("webrtc");
    const delayMs = timing.enabled ? timing.sampleMs("webrtc.datachannel.message") : 0;
    const schedule = (fn: () => void) => {
      if (delayMs <= 0) {
        queueMicrotask(fn);
      } else {
        window.setTimeout(fn, Math.max(0, delayMs));
      }
    };

    schedule(() => {
      this.bufferedAmount = Math.max(0, this.bufferedAmount - size);
      this.peer?._receive(data);
      if (this.bufferedAmount <= this.bufferedAmountLowThreshold) {
        const low = new Event("bufferedamountlow");
        this.dispatchEvent(low);
        this.onbufferedamountlow?.(low);
      }
    });
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === "closed") {
      return;
    }
    this.readyState = "closed";
    const event = new Event("close");
    this.dispatchEvent(event);
    this.onclose?.(event);
    this.peer?._remoteClose(code, reason);
  }
}

