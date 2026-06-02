import type {
  MediaDeviceInfoLike,
  RealCameraInstallOptions,
  RealCameraTestEnumerateOverride,
  RealCameraTestError,
  ResolvedRealCameraInstallOptions,
  ResolvedVideoConstraints,
  VirtualFrameSource,
} from "../types";
import { DeviceRegistry } from "./DeviceRegistry";
import { VirtualStream } from "./VirtualStream";
import {
  applyVideoConstraintsOverride,
  extractDeviceId,
  resolveVideoConstraints,
  toConstraintsObject,
} from "../utils/constraints";
import { notAllowedError, notFoundError } from "../utils/errors";
import { getRealTestingTiming } from "../utils/realtestingTiming";

export class MediaDevicesProxy {
  private registry: DeviceRegistry;
  private options: ResolvedRealCameraInstallOptions;
  private installed = false;
  private mediaDevices?: MediaDevices;
  private originalGetUserMedia?: MediaDevices["getUserMedia"];
  private originalEnumerateDevices?: MediaDevices["enumerateDevices"];
  private originalGetSupportedConstraints?: MediaDevices["getSupportedConstraints"];
  private originalNavigatorGetUserMedia?: unknown;
  private originalNavigatorWebkitGetUserMedia?: unknown;
  private originalNavigatorMozGetUserMedia?: unknown;
  private originalNavigatorLegacyCaptured = false;
  private activeStreams = new Map<string, Set<VirtualStream>>();
  private onVirtualFrame?: (deviceId: string, info: { frameIndex: number; timestamp: number }) => void;
  private nextGetUserMediaError?: RealCameraTestError;
  private getUserMediaDelayMs?: number;
  private enumerateDevicesOverride?: RealCameraTestEnumerateOverride;
  private supportedConstraintsOverride?: MediaTrackSupportedConstraints;
  private virtualVideoConstraintsOverride?: MediaTrackConstraints;
  private bootedVirtualDevices = new Set<string>();

  constructor(registry: DeviceRegistry, options: ResolvedRealCameraInstallOptions) {
    this.registry = registry;
    this.options = options;
  }

  updateOptions(options: ResolvedRealCameraInstallOptions): void {
    this.options = options;
  }

  setOnVirtualFrame(
    callback?: (deviceId: string, info: { frameIndex: number; timestamp: number }) => void
  ): void {
    this.onVirtualFrame = callback;
  }

  setNextGetUserMediaError(error?: RealCameraTestError): void {
    this.nextGetUserMediaError = error;
  }

  setGetUserMediaDelay(delayMs?: number): void {
    this.getUserMediaDelayMs = delayMs;
  }

  setEnumerateDevicesOverride(override?: RealCameraTestEnumerateOverride): void {
    this.enumerateDevicesOverride = override;
  }

  setSupportedConstraintsOverride(
    override?: MediaTrackSupportedConstraints
  ): void {
    this.supportedConstraintsOverride = override;
  }

  setVirtualVideoConstraintsOverride(
    override?: MediaTrackConstraints
  ): void {
    this.virtualVideoConstraintsOverride = override;
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.setConstraintOverride(override));
    });
  }

  captureOriginals(): void {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("RealCamera: navigator.mediaDevices is not available.");
    }
    this.mediaDevices = navigator.mediaDevices;
    if (!this.originalGetUserMedia) {
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      );
    }
    if (!this.originalEnumerateDevices) {
      this.originalEnumerateDevices =
        navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    }
    if (!this.originalGetSupportedConstraints) {
      this.originalGetSupportedConstraints =
        navigator.mediaDevices.getSupportedConstraints.bind(navigator.mediaDevices);
    }

    if (!this.originalNavigatorLegacyCaptured) {
      const nav = navigator as unknown as {
        getUserMedia?: unknown;
        webkitGetUserMedia?: unknown;
        mozGetUserMedia?: unknown;
      };
      this.originalNavigatorGetUserMedia = nav.getUserMedia;
      this.originalNavigatorWebkitGetUserMedia = nav.webkitGetUserMedia;
      this.originalNavigatorMozGetUserMedia = nav.mozGetUserMedia;
      this.originalNavigatorLegacyCaptured = true;
    }
  }

  install(): void {
    if (this.installed) {
      return;
    }
    this.captureOriginals();

    navigator.mediaDevices.getUserMedia = this.getUserMediaProxy.bind(this);
    navigator.mediaDevices.enumerateDevices =
      this.enumerateDevicesProxy.bind(this);
    navigator.mediaDevices.getSupportedConstraints =
      this.getSupportedConstraintsProxy.bind(this);

    this.installLegacyGetUserMedia();
    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed || !this.mediaDevices) {
      return;
    }
    if (this.originalGetUserMedia) {
      this.mediaDevices.getUserMedia = this.originalGetUserMedia;
    }
    if (this.originalEnumerateDevices) {
      this.mediaDevices.enumerateDevices = this.originalEnumerateDevices;
    }
    if (this.originalGetSupportedConstraints) {
      this.mediaDevices.getSupportedConstraints =
        this.originalGetSupportedConstraints;
    }

    this.uninstallLegacyGetUserMedia();
    this.installed = false;
  }

  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    return this.getUserMediaProxy(constraints);
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return this.enumerateDevicesProxy();
  }

  updateVirtualSource(deviceId: string, source?: VirtualFrameSource): void {
    const streams = this.activeStreams.get(deviceId);
    if (!streams) {
      return;
    }
    streams.forEach((stream) => stream.updateSource(source));
  }

  stopVirtualStreams(deviceId?: string): void {
    if (deviceId) {
      const streams = this.activeStreams.get(deviceId);
      if (streams) {
        streams.forEach((stream) => stream.stop());
        this.activeStreams.delete(deviceId);
      }
      return;
    }
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.stop());
    });
    this.activeStreams.clear();
  }

  private async getUserMediaProxy(
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream> {
    if (!this.originalGetUserMedia) {
      throw new Error("RealCamera: getUserMedia is not available.");
    }
    if (this.getUserMediaDelayMs && this.getUserMediaDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.getUserMediaDelayMs));
    }
    if (this.nextGetUserMediaError) {
      const error = this.nextGetUserMediaError;
      this.nextGetUserMediaError = undefined;
      throw this.buildDomError(error);
    }
    const normalized = toConstraintsObject(constraints);
    const videoConstraints = normalized.video;
    const audioConstraints = normalized.audio;

    const wantsVideo = Boolean(videoConstraints);

    let deviceId = extractDeviceId(
      typeof videoConstraints === "boolean" ? undefined : videoConstraints
    );

    let virtualDevice = deviceId ? this.registry.getVirtualDevice(deviceId) : undefined;

    // Auto-select a virtual device when physical cameras are blocked and the
    // caller did not choose (or chose a non-virtual) deviceId. This is important
    // for legacy getUserMedia callers and simple `{ video: true }` flows.
    if (!virtualDevice && wantsVideo && this.options.blockPhysicalDevices) {
      const firstEnabled = this.registry
        .listVirtualDevices()
        .find((device) => device.enabled);
      if (firstEnabled) {
        deviceId = firstEnabled.id;
        virtualDevice = firstEnabled;
      }
    }

    if (virtualDevice) {
      const timing = getRealTestingTiming("realcamera");

      if (timing.enabled && !this.bootedVirtualDevices.has(virtualDevice.id)) {
        this.bootedVirtualDevices.add(virtualDevice.id);
        await timing.delay("camera.boot");
      }

      if (!virtualDevice.enabled) {
        throw notFoundError("RealCamera: Virtual device is disabled.");
      }

      if (timing.enabled && this.options.virtualPermission === "prompt") {
        // Simulate the browser taking time to show the permission prompt.
        await timing.delay("camera.permission.promptOpen");
      }
      const allowed = await this.resolveVirtualPermission(virtualDevice.id);
      if (!allowed) {
        throw notAllowedError("RealCamera: Virtual device permission denied.");
      }

      if (timing.enabled) {
        // Simulate stream creation/activation after permission is granted.
        await timing.delay("camera.getUserMedia.afterPermission");
      }

      const videoStream = this.createVirtualStream(
        virtualDevice.id,
        typeof videoConstraints === "boolean" ? undefined : videoConstraints
      );

      if (!audioConstraints) {
        return videoStream;
      }

      const audioStream = await this.originalGetUserMedia({
        audio: audioConstraints,
        video: false,
      });
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);
      return combined;
    }

    if (this.options.blockPhysicalDevices && wantsVideo) {
      throw notAllowedError("RealCamera: Physical devices are blocked.");
    }

    return this.originalGetUserMedia(normalized);
  }

  private installLegacyGetUserMedia(): void {
    if (typeof navigator === "undefined") {
      return;
    }

    const nav = navigator as unknown as {
      getUserMedia?: unknown;
      webkitGetUserMedia?: unknown;
      mozGetUserMedia?: unknown;
    };

    const proxy = (
      constraints: MediaStreamConstraints,
      onSuccess?: (stream: MediaStream) => void,
      onError?: (error: any) => void
    ) => {
      this.getUserMediaProxy(constraints).then(
        (stream) => onSuccess?.(stream),
        (error) => onError?.(error)
      );
    };

    nav.getUserMedia = proxy;
    nav.webkitGetUserMedia = proxy;
    nav.mozGetUserMedia = proxy;
  }

  private uninstallLegacyGetUserMedia(): void {
    if (!this.originalNavigatorLegacyCaptured || typeof navigator === "undefined") {
      return;
    }

    const nav = navigator as unknown as {
      getUserMedia?: unknown;
      webkitGetUserMedia?: unknown;
      mozGetUserMedia?: unknown;
    };

    nav.getUserMedia = this.originalNavigatorGetUserMedia;
    nav.webkitGetUserMedia = this.originalNavigatorWebkitGetUserMedia;
    nav.mozGetUserMedia = this.originalNavigatorMozGetUserMedia;
  }

  private createVirtualStream(
    deviceId: string,
    constraints?: MediaTrackConstraints
  ): MediaStream {
    const device = this.registry.getVirtualDevice(deviceId);
    if (!device) {
      throw notFoundError("RealCamera: Virtual device not found.");
    }
    const effectiveConstraints = applyVideoConstraintsOverride(
      constraints,
      this.virtualVideoConstraintsOverride
    );
    const resolved = resolveVideoConstraints(
      effectiveConstraints,
      device.defaultConstraints as Partial<ResolvedVideoConstraints>
    );
    const virtualStream = new VirtualStream(
      device,
      {
        ...constraints,
        width: resolved.width,
        height: resolved.height,
        frameRate: resolved.frameRate,
      },
      (info) => {
        this.onVirtualFrame?.(deviceId, info);
      },
      this.virtualVideoConstraintsOverride
    );
    this.registerVirtualStream(deviceId, virtualStream);
    return virtualStream.stream;
  }

  private registerVirtualStream(deviceId: string, stream: VirtualStream): void {
    const set = this.activeStreams.get(deviceId) ?? new Set<VirtualStream>();
    set.add(stream);
    this.activeStreams.set(deviceId, set);
    stream.videoTrack.addEventListener("ended", () => {
      const streams = this.activeStreams.get(deviceId);
      if (!streams) {
        return;
      }
      streams.delete(stream);
      if (streams.size === 0) {
        this.activeStreams.delete(deviceId);
      }
    });
  }

  private async enumerateDevicesProxy(): Promise<MediaDeviceInfo[]> {
    const timing = getRealTestingTiming("realcamera");
    if (timing.enabled) {
      await timing.delay("camera.enumerateDevices");
    }
    if (!this.originalEnumerateDevices) {
      return [];
    }
    if (this.enumerateDevicesOverride) {
      const override = this.enumerateDevicesOverride;
      if (override.once) {
        this.enumerateDevicesOverride = undefined;
      }
      return override.devices.map((device) =>
        this.toMediaDeviceInfoFromOverride(device)
      );
    }
    const physicalDevices = await this.originalEnumerateDevices();
    const filteredPhysicalDevices = this.options.blockPhysicalDevices
      ? physicalDevices.filter((device) => device.kind !== "videoinput")
      : physicalDevices;
    if (!this.options.includeVirtualDevices) {
      return filteredPhysicalDevices;
    }
    const virtualDevices = this.buildVirtualEnumerateDevices(
      this.registry.listVirtualDevices().filter((device) => device.enabled)
    );
    return [...filteredPhysicalDevices, ...virtualDevices];
  }

  private buildVirtualEnumerateDevices(
    devices: Array<{
      id: string;
      label: string;
      groupId: string;
      enabled: boolean;
    }>
  ): MediaDeviceInfo[] {
    const profile =
      this.options.virtualPermission === "allow"
        ? "legacy"
        : this.options.prePermissionEnumerateProfile;

    if (profile === "single-anonymous") {
      const firstDevice = devices[0];
      return firstDevice ? [this.toMediaDeviceInfo(firstDevice)] : [];
    }

    const anonymize = profile === "anonymous-all";
    return devices.map((device) =>
      this.toMediaDeviceInfo(device, { anonymize })
    );
  }

  private getSupportedConstraintsProxy(): MediaTrackSupportedConstraints {
    if (this.supportedConstraintsOverride) {
      return this.supportedConstraintsOverride;
    }
    if (!this.originalGetSupportedConstraints) {
      return {};
    }
    return this.originalGetSupportedConstraints();
  }

  private toMediaDeviceInfo(device: {
    id: string;
    label: string;
    groupId: string;
    enabled: boolean;
  }, options?: { anonymize?: boolean }): MediaDeviceInfo {
    const anonymize = options?.anonymize === true;
    const deviceId = anonymize ? "" : device.id;
    const label = anonymize
      ? ""
      : this.options.virtualPermission === "allow"
        ? device.label
        : "";
    const groupId = anonymize ? "" : device.groupId;
    const info = {
      deviceId,
      kind: "videoinput",
      label,
      groupId,
      toJSON() {
        return {
          deviceId,
          kind: "videoinput",
          label,
          groupId,
        };
      },
    } as MediaDeviceInfo;
    if (typeof MediaDeviceInfo !== "undefined") {
      Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
    }
    return info;
  }

  private toMediaDeviceInfoFromOverride(
    device: MediaDeviceInfoLike
  ): MediaDeviceInfo {
    const info = {
      deviceId: device.deviceId,
      kind: device.kind,
      label: device.label ?? "",
      groupId: device.groupId ?? "",
      toJSON() {
        return {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label ?? "",
          groupId: device.groupId ?? "",
        };
      },
    } as MediaDeviceInfo;
    if (typeof MediaDeviceInfo !== "undefined") {
      Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
    }
    return info;
  }

  private buildDomError(error: RealCameraTestError): Error {
    const message = error.message ?? error.name;
    const domError =
      typeof DOMException !== "undefined"
        ? new DOMException(message, error.name)
        : (Object.assign(new Error(message), { name: error.name }) as Error);
    if (error.name === "OverconstrainedError" && error.constraint) {
      (domError as Error & { constraint?: string }).constraint = error.constraint;
    }
    return domError;
  }

  private async resolveVirtualPermission(deviceId: string): Promise<boolean> {
    if (this.options.virtualPermission === "allow") {
      return true;
    }
    if (this.options.virtualPermission === "deny") {
      return false;
    }
    const result = await this.options.onVirtualPermissionRequest?.(deviceId);
    return Boolean(result);
  }
}
