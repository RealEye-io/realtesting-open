import type { WebRtcMode } from "../types";
import { notAllowedError } from "../utils/errors";
import { VirtualRTCPeerConnection } from "./VirtualRTCPeerConnection";

type NativeCtor = typeof RTCPeerConnection;

function shouldUseVirtual(mode: WebRtcMode, blockNative: boolean, hasNative: boolean): boolean {
  switch (mode) {
    case "virtual":
      return true;
    case "native":
      return false;
    case "prefer-virtual":
      return true;
    case "prefer-native":
    default:
      if (hasNative && !blockNative) {
        return false;
      }
      return true;
  }
}

export function createRTCPeerConnectionProxy(params: {
  getMode: () => WebRtcMode;
  getBlockNative: () => boolean;
  nativeCtor: NativeCtor | null;
}): NativeCtor {
  const Native = params.nativeCtor;

  const Proxy = class RTCPeerConnectionProxy {
    constructor(configuration?: RTCConfiguration) {
      const mode = params.getMode();
      const blockNative = params.getBlockNative();
      const hasNative = typeof Native === "function";
      const useVirtual = shouldUseVirtual(mode, blockNative, hasNative);

      if (!useVirtual) {
        if (blockNative) {
          throw notAllowedError("Native RTCPeerConnection is blocked by RealTesting.");
        }
        if (!Native) {
          throw notAllowedError("Native RTCPeerConnection is not available in this environment.");
        }
        return new Native(configuration);
      }

      return new VirtualRTCPeerConnection(configuration) as unknown as RTCPeerConnection;
    }
  } as unknown as NativeCtor;

  // Best-effort copy of static members (e.g. generateCertificate).
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

