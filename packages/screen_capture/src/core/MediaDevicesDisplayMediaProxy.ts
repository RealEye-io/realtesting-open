import type {
  CaptureMode,
  RealScreenCaptureInstallOptions,
  ResolvedDisplayConstraints,
  VirtualFrameSource,
  VirtualPermission,
} from "../types";
import { extractVideoTrackConstraints, isAudioRequested, resolveDisplayConstraints } from "../utils/constraints";
import { notAllowedError, notFoundError, notSupportedError } from "../utils/errors";
import { getRealTestingTiming } from "../utils/realtestingTiming";
import { VirtualDisplayRegistry } from "./VirtualDisplayRegistry";
import { VirtualDisplayStream } from "./VirtualDisplayStream";

export type DisplayMediaProxyOptions = Required<
  Pick<
    RealScreenCaptureInstallOptions,
    "captureMode" | "virtualPermission" | "onVirtualPermissionRequest" | "blockNativeDisplayMedia"
  >
>;

export type CaptureDecision = {
  implementation: "virtual" | "native";
  reason: string;
};

export function decideCaptureImplementation(args: {
  captureMode: CaptureMode;
  virtualAvailable: boolean;
  virtualAllowed: boolean;
  nativeAvailable: boolean;
  blockNativeDisplayMedia: boolean;
}): CaptureDecision | { implementation: "error"; error: Error; reason: string } {
  const {
    captureMode,
    virtualAvailable,
    virtualAllowed,
    nativeAvailable,
    blockNativeDisplayMedia,
  } = args;

  const virtualUsable = virtualAvailable && virtualAllowed;
  const nativeUsable = nativeAvailable && !blockNativeDisplayMedia;

  if (captureMode === "virtual") {
    if (!virtualAvailable) {
      return {
        implementation: "error",
        reason: "virtual-required-missing",
        error: notFoundError("RealTesting: No enabled virtual displays are available."),
      };
    }
    if (!virtualAllowed) {
      return {
        implementation: "error",
        reason: "virtual-permission-denied",
        error: notAllowedError("RealTesting: Virtual display permission denied."),
      };
    }
    return { implementation: "virtual", reason: "virtual-required" };
  }

  if (captureMode === "native") {
    if (!nativeAvailable) {
      return {
        implementation: "error",
        reason: "native-missing",
        error: notSupportedError("RealTesting: Native getDisplayMedia is not available."),
      };
    }
    if (blockNativeDisplayMedia) {
      return {
        implementation: "error",
        reason: "native-blocked",
        error: notAllowedError("RealTesting: Native getDisplayMedia is blocked."),
      };
    }
    return { implementation: "native", reason: "native-required" };
  }

  if (captureMode === "prefer-virtual") {
    if (virtualUsable) {
      return { implementation: "virtual", reason: "prefer-virtual-available" };
    }
    if (!nativeAvailable) {
      return {
        implementation: "error",
        reason: "native-missing",
        error: notSupportedError("RealTesting: Native getDisplayMedia is not available."),
      };
    }
    if (blockNativeDisplayMedia) {
      return {
        implementation: "error",
        reason: "native-blocked",
        error: notAllowedError("RealTesting: Native getDisplayMedia is blocked."),
      };
    }
    return { implementation: "native", reason: "prefer-virtual-fallback-native" };
  }

  // prefer-native
  if (nativeUsable) {
    return { implementation: "native", reason: "prefer-native-native" };
  }
  if (!nativeAvailable && virtualUsable) {
    return { implementation: "virtual", reason: "prefer-native-fallback-virtual-no-native" };
  }
  if (blockNativeDisplayMedia && virtualUsable) {
    return { implementation: "virtual", reason: "prefer-native-fallback-virtual-native-blocked" };
  }
  if (!nativeAvailable) {
    return {
      implementation: "error",
      reason: "native-missing",
      error: notSupportedError("RealTesting: Native getDisplayMedia is not available."),
    };
  }
  return {
    implementation: "error",
    reason: "native-blocked",
    error: notAllowedError("RealTesting: Native getDisplayMedia is blocked."),
  };
}

export class MediaDevicesDisplayMediaProxy {
  private registry: VirtualDisplayRegistry;
  private options: DisplayMediaProxyOptions;
  private installed = false;

  private mediaDevices?: MediaDevices;
  private originalGetDisplayMedia?: MediaDevices["getDisplayMedia"];

  private activeStreams = new Map<string, Set<VirtualDisplayStream>>();
  private onVirtualFrame?: (displayId: string, info: { frameIndex: number; timestamp: number }) => void;

  private sourceOverride?: VirtualFrameSource;

  constructor(registry: VirtualDisplayRegistry, options: DisplayMediaProxyOptions) {
    this.registry = registry;
    this.options = options;
  }

  updateOptions(options: DisplayMediaProxyOptions): void {
    this.options = options;
  }

  setOnVirtualFrame(
    callback?: (displayId: string, info: { frameIndex: number; timestamp: number }) => void
  ): void {
    this.onVirtualFrame = callback;
  }

  setSourceOverride(source?: VirtualFrameSource): void {
    this.sourceOverride = source;
    this.refreshSourcesForAllActiveStreams();
  }

  captureOriginals(): void {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("RealTesting: navigator.mediaDevices is not available.");
    }
    this.mediaDevices = navigator.mediaDevices;
    if (!this.originalGetDisplayMedia) {
      // Some browsers may not have getDisplayMedia; keep undefined and allow virtual mode to work.
      const candidate = (navigator.mediaDevices as MediaDevices).getDisplayMedia;
      this.originalGetDisplayMedia = candidate ? candidate.bind(navigator.mediaDevices) : undefined;
    }
  }

  install(): void {
    if (this.installed) {
      return;
    }
    this.captureOriginals();
    // Patch even if original is undefined. In virtual mode we do not need native support.
    (navigator.mediaDevices as MediaDevices).getDisplayMedia = this.getDisplayMediaProxy.bind(this);
    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed || !this.mediaDevices) {
      return;
    }
    try {
      if (this.originalGetDisplayMedia) {
        this.mediaDevices.getDisplayMedia = this.originalGetDisplayMedia;
      } else {
        // Best-effort restoration when original didn't exist.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (this.mediaDevices as any).getDisplayMedia;
      }
    } catch {
      (this.mediaDevices as any).getDisplayMedia = this.originalGetDisplayMedia;
    }
    this.installed = false;
  }

  async getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream> {
    if (!this.mediaDevices) {
      this.captureOriginals();
    }
    return this.getDisplayMediaProxy(constraints);
  }

  updateVirtualSource(displayId: string, source?: VirtualFrameSource): void {
    const streams = this.activeStreams.get(displayId);
    if (!streams) {
      return;
    }
    const effective = this.sourceOverride ?? source;
    streams.forEach((stream) => stream.updateSource(effective));
  }

  stopVirtualStreams(displayId?: string): void {
    if (displayId) {
      const streams = this.activeStreams.get(displayId);
      if (streams) {
        streams.forEach((stream) => stream.stop());
        this.activeStreams.delete(displayId);
      }
      return;
    }
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.stop());
    });
    this.activeStreams.clear();
  }

  private async resolveVirtualPermission(): Promise<boolean> {
    const mode: VirtualPermission = this.options.virtualPermission;
    if (mode === "allow") {
      return true;
    }
    if (mode === "deny") {
      return false;
    }
    const timing = getRealTestingTiming("screen-capture");
    if (timing.enabled) {
      await timing.delay("display.permission.promptOpen");
    }
    try {
      const result = await this.options.onVirtualPermissionRequest();
      return Boolean(result);
    } catch {
      return false;
    }
  }

  private getEffectiveSource(displayId: string): VirtualFrameSource | undefined {
    if (this.sourceOverride) {
      return this.sourceOverride;
    }
    return this.registry.getVirtualDisplay(displayId)?.source;
  }

  private refreshSourcesForAllActiveStreams(): void {
    this.activeStreams.forEach((streams, displayId) => {
      const effective = this.getEffectiveSource(displayId);
      streams.forEach((stream) => stream.updateSource(effective));
    });
  }

  private registerVirtualStream(displayId: string, stream: VirtualDisplayStream): void {
    const set = this.activeStreams.get(displayId) ?? new Set<VirtualDisplayStream>();
    set.add(stream);
    this.activeStreams.set(displayId, set);
    stream.videoTrack.addEventListener("ended", () => {
      const current = this.activeStreams.get(displayId);
      if (!current) {
        return;
      }
      current.delete(stream);
      if (current.size === 0) {
        this.activeStreams.delete(displayId);
      }
    });
  }

  private createVirtualStream(args: {
    displayId: string;
    videoConstraints?: MediaTrackConstraints;
    audioRequested: boolean;
    defaults: Partial<ResolvedDisplayConstraints>;
  }): MediaStream {
    const resolved = resolveDisplayConstraints(args.videoConstraints, args.defaults);
    const source = this.getEffectiveSource(args.displayId);
    const stream = new VirtualDisplayStream({
      width: resolved.width,
      height: resolved.height,
      frameRate: resolved.frameRate,
      audioRequested: args.audioRequested,
      source,
      onFrame: (info) => this.onVirtualFrame?.(args.displayId, info),
    });
    this.registerVirtualStream(args.displayId, stream);
    return stream.stream;
  }

  private async getDisplayMediaProxy(
    constraints?: DisplayMediaStreamOptions
  ): Promise<MediaStream> {
    const enabledVirtual = this.registry.getFirstEnabledVirtualDisplay();
    const virtualAvailable = Boolean(enabledVirtual);
    const virtualAllowed = await this.resolveVirtualPermission();
    const nativeAvailable = Boolean(this.originalGetDisplayMedia);

    const decision = decideCaptureImplementation({
      captureMode: this.options.captureMode,
      virtualAvailable,
      virtualAllowed,
      nativeAvailable,
      blockNativeDisplayMedia: this.options.blockNativeDisplayMedia,
    });

    if (decision.implementation === "error") {
      throw decision.error;
    }

    if (decision.implementation === "native") {
      if (!this.originalGetDisplayMedia) {
        throw notSupportedError("RealTesting: Native getDisplayMedia is not available.");
      }
      if (this.options.blockNativeDisplayMedia) {
        throw notAllowedError("RealTesting: Native getDisplayMedia is blocked.");
      }
      return this.originalGetDisplayMedia(constraints);
    }

    if (!enabledVirtual) {
      throw notFoundError("RealTesting: No enabled virtual displays are available.");
    }
    const videoConstraints = extractVideoTrackConstraints(constraints);
    const audioRequested = isAudioRequested(constraints);
    const defaults = enabledVirtual.defaultConstraints;

    const timing = getRealTestingTiming("screen-capture");
    if (timing.enabled) {
      await timing.delay("display.getDisplayMedia.streamStart");
    }

    return this.createVirtualStream({
      displayId: enabledVirtual.id,
      videoConstraints,
      audioRequested,
      defaults,
    });
  }
}
