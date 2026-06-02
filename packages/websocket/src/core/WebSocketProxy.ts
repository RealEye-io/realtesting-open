import type { WebSocketMode } from "../types";
import { VirtualWebSocket } from "./VirtualWebSocket";
import { VirtualWebSocketServerRegistry } from "./VirtualWebSocketServerRegistry";

type NativeCtor = typeof WebSocket;

function resolveDecision(params: {
  mode: WebSocketMode;
  blockNative: boolean;
  hasNative: boolean;
  hasVirtualServer: boolean;
}): "native" | "virtual" | "blocked" {
  const { mode, blockNative, hasNative, hasVirtualServer } = params;
  switch (mode) {
    case "virtual":
      return "virtual";
    case "native":
      return blockNative || !hasNative ? "blocked" : "native";
    case "prefer-virtual":
      if (hasVirtualServer) {
        return "virtual";
      }
      return blockNative || !hasNative ? "blocked" : "native";
    case "prefer-native":
    default:
      if (!blockNative && hasNative) {
        return "native";
      }
      return hasVirtualServer ? "virtual" : "blocked";
  }
}

export function createWebSocketProxy(params: {
  getMode: () => WebSocketMode;
  getBlockNative: () => boolean;
  nativeCtor: NativeCtor | null;
  registry: VirtualWebSocketServerRegistry;
}): NativeCtor {
  const Native = params.nativeCtor;
  const registry = params.registry;
  const blockedRegistry = new VirtualWebSocketServerRegistry();

  const Proxy = class WebSocketProxy {
    constructor(url: string | URL, protocols?: string | string[]) {
      const urlStr = typeof url === "string" ? url : url.toString();
      const mode = params.getMode();
      const blockNative = params.getBlockNative();
      const hasNative = typeof Native === "function";
      const hasVirtualServer = registry.resolveServer(urlStr) !== null;
      const decision = resolveDecision({ mode, blockNative, hasNative, hasVirtualServer });

      if (decision === "native") {
        return new (Native as NativeCtor)(url as any, protocols as any);
      }

      if (decision === "blocked") {
        // In strict-native mode (or when native is blocked/unavailable), fail deterministically
        // without attempting any network connection or virtual fallback.
        return new VirtualWebSocket(urlStr, protocols, blockedRegistry) as unknown as WebSocket;
      }

      return new VirtualWebSocket(urlStr, protocols, registry) as unknown as WebSocket;
    }
  } as unknown as NativeCtor;

  const constantsSource: any = Native ?? VirtualWebSocket;
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    try {
      (Proxy as any)[key] = constantsSource[key];
    } catch {
      // ignore
    }
  }

  if (Native) {
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key in Proxy) {
        continue;
      }
      try {
        (Proxy as any)[key] = (Native as any)[key];
      } catch {
        // ignore
      }
    }
  }

  return Proxy;
}
