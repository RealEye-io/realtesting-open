import type {
  RealCameraInstallOptions,
  RealCameraPermissionRequest,
  RealCameraTestApi,
  RealCameraTestApiOptions,
  RealCameraTestConfig,
  RealCameraTestSourceDescriptor,
  RealCameraTestSourceTransform,
  RealCameraTestFrameInfo,
  ResolvedRealCameraInstallOptions,
  VirtualDeviceConfig,
  VirtualDeviceUpdate,
  VirtualFrameSource,
  VirtualDeviceState,
} from "../types";
import { DeviceRegistry } from "./DeviceRegistry";
import { MediaDevicesProxy } from "./MediaDevicesProxy";

const DEFAULT_OPTIONS: ResolvedRealCameraInstallOptions = {
  mode: "proxy",
  virtualPermission: "allow",
  prePermissionEnumerateProfile: "legacy",
  onVirtualPermissionRequest: () => false,
  includeVirtualDevices: true,
  blockPhysicalDevices: false,
};

const DEFAULT_TEST_API_PROPERTY = "__realcameraTestApi";

type RealCameraTestWindow = Window & {
  __REALCAMERA_TEST__?: boolean;
  __REALCAMERA_TEST_CONFIG__?: RealCameraTestConfig;
  [key: string]: unknown;
};

function getTestWindow(): RealCameraTestWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as unknown as RealCameraTestWindow;
}

function resolveTestSetup(
  options: RealCameraInstallOptions
): {
  config: RealCameraTestConfig | null;
  enableApi: boolean;
  windowProperty: string;
} {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALCAMERA_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled =
    params?.has("realcameraTest") ||
    params?.has("realcamera-test") ||
    params?.has("realtestingTest") ||
    params?.has("realtesting-test") ||
    testWindow?.__REALCAMERA_TEST__ === true ||
    config?.enabled === true;
  const apiOptions: RealCameraTestApiOptions | undefined = options.testApi;
  const enableApi =
    apiOptions?.enabled === true || (apiOptions?.autoEnable !== false && autoEnabled);
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY,
  };
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  info: { width: number; height: number; frameIndex: number; timestamp: number },
  source: VirtualFrameSource
): void {
  switch (source.type) {
    case "canvas":
    case "video":
    case "image":
      try {
        ctx.drawImage(source.element, 0, 0, info.width, info.height);
      } catch {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, info.width, info.height);
      }
      return;
    case "callback":
      try {
        const result = source.draw(ctx, info);
        if (result instanceof Promise) {
          result.catch(() => undefined);
        }
      } catch {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, info.width, info.height);
      }
      return;
    default:
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, info.width, info.height);
  }
}

function buildTestSource(
  descriptor: RealCameraTestSourceDescriptor
): VirtualFrameSource {
  switch (descriptor.type) {
    case "color":
      return {
        type: "callback",
        draw: (ctx, info) => {
          ctx.fillStyle = descriptor.color;
          ctx.fillRect(0, 0, info.width, info.height);
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "24px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        },
      };
    case "pattern":
      return {
        type: "callback",
        draw: (ctx, info) => {
          const gradient = ctx.createLinearGradient(0, 0, info.width, info.height);
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#a855f7");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, info.width, info.height);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "22px sans-serif";
          ctx.fillText("RealCamera Test Pattern", 24, 48);
        },
      };
    case "image": {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = descriptor.url;
      return {
        type: "callback",
        draw: (ctx, info) => {
          if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, 0, 0, info.width, info.height);
          } else {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, info.width, info.height);
          }
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "22px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        },
      };
    }
    case "blank":
    default:
      return {
        type: "callback",
        draw: (ctx, info) => {
          ctx.fillStyle = descriptor.color ?? "#0f172a";
          ctx.fillRect(0, 0, info.width, info.height);
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "22px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        },
      };
  }
}

async function prepareTestSource(
  descriptor: RealCameraTestSourceDescriptor
): Promise<VirtualFrameSource> {
  if (descriptor.type !== "image") {
    return buildTestSource(descriptor);
  }
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = descriptor.url;
  if (image.decode) {
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
    });
  }
  return {
    type: "image",
    element: image,
  };
}

function applySourceTransform(
  source: VirtualFrameSource,
  transform: RealCameraTestSourceTransform
): VirtualFrameSource {
  if (transform.type !== "swap") {
    return source;
  }
  const afterSource = buildTestSource(transform.after);
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const afterFrames = transform.afterFrames ?? 10;
  const afterMs = transform.afterMs;
  return {
    type: "callback",
    draw: (ctx, info) => {
      const elapsed = typeof performance !== "undefined" ? performance.now() - start : 0;
      const useAfter =
        (typeof afterMs === "number" && elapsed >= afterMs) ||
        info.frameIndex >= afterFrames;
      drawSource(ctx, info, useAfter ? afterSource : source);
    },
  };
}

export class RealCameraCore {
  private registry = new DeviceRegistry();
  private options: ResolvedRealCameraInstallOptions = { ...DEFAULT_OPTIONS };
  private proxy = new MediaDevicesProxy(this.registry, this.options);
  private installed = false;
  private unsubscribe?: () => void;
  private testConfig: RealCameraTestConfig | null = null;
  private testApi: RealCameraTestApi | null = null;
  private testApiProperty: string | null = null;
  private nextVirtualOverride: Partial<VirtualDeviceConfig> | undefined;
  private sourceOverride: RealCameraTestSourceDescriptor | undefined;
  private sourceTransform: RealCameraTestSourceTransform | undefined;
  private sourceOverrideSource: VirtualFrameSource | undefined;
  private baseSources = new Map<string, VirtualFrameSource>();
  private frameWaiters = new Map<string, Array<(info: RealCameraTestFrameInfo) => void>>();

  private permissionRequestSeq = 0;
  private pendingPermissionRequests = new Map<
    string,
    {
      request: RealCameraPermissionRequest;
      resolve: (allow: boolean) => void;
      responded: boolean;
      timeoutId?: number;
    }
  >();
  private permissionQueue: RealCameraPermissionRequest[] = [];
  private permissionQueueWaiters: Array<(req: RealCameraPermissionRequest) => void> = [];
  private hasCustomPermissionRequestHandler = false;

  constructor() {
    this.proxy.setOnVirtualFrame((deviceId, info) => {
      this.handleVirtualFrame(deviceId, info.frameIndex, info.timestamp);
    });
    this.unsubscribe = this.registry.onChange(() => {
      if (!this.installed) {
        return;
      }
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
      }
    });
  }

  install(options: RealCameraInstallOptions = {}): void {
    const { testApi: _testApi, ...rest } = options;
    this.options = { ...DEFAULT_OPTIONS, ...rest };
    this.hasCustomPermissionRequestHandler = Object.prototype.hasOwnProperty.call(
      rest,
      "onVirtualPermissionRequest"
    );
    const testSetup = resolveTestSetup(options);
    if (testSetup.config) {
      this.applyTestConfig(testSetup.config);
    }

    this.maybeInstallDefaultPermissionPromptHandler();

    this.proxy.updateOptions(this.options);
    this.attachTestApi(testSetup.enableApi, testSetup.windowProperty);

    if (this.options.mode === "proxy") {
      this.proxy.install();
      this.installed = true;
      return;
    }

    this.proxy.uninstall();
    this.proxy.captureOriginals();
    this.installed = false;
  }

  uninstall(): void {
    this.proxy.uninstall();
    this.proxy.stopVirtualStreams();
    this.installed = false;
    this.detachTestApi();
  }

  isInstalled(): boolean {
    return this.installed;
  }

  createVirtualDevice(config: VirtualDeviceConfig = {}): string {
    const override = this.consumeVirtualOverride();
    const resolved: VirtualDeviceConfig = {
      ...config,
      enabled: config.enabled ?? override?.enabled,
      defaultConstraints: config.defaultConstraints ?? override?.defaultConstraints,
      label: config.label ?? override?.label,
      groupId: config.groupId ?? override?.groupId,
    };
    const id = this.registry.addVirtualDevice(resolved);
    return id;
  }

  updateVirtualDevice(id: string, update: VirtualDeviceUpdate): void {
    this.registry.updateVirtualDevice(id, update);
  }

  removeVirtualDevice(id: string): void {
    this.registry.removeVirtualDevice(id);
    this.proxy.stopVirtualStreams(id);
  }

  setVirtualSource(id: string, source: VirtualFrameSource): void {
    this.baseSources.set(id, source);
    const resolvedSource = this.applySourceOverrides(source);
    this.registry.setVirtualSource(id, resolvedSource);
    this.proxy.updateVirtualSource(id, resolvedSource);
  }

  setVirtualEnabled(id: string, enabled: boolean): void {
    this.registry.setVirtualEnabled(id, enabled);
    if (!enabled) {
      this.proxy.stopVirtualStreams(id);
    }
  }

  listVirtualDevices(): VirtualDeviceState[] {
    return this.registry.listVirtualDevices();
  }

  setPhysicalDevicesEnabled(enabled: boolean): void {
    this.options = { ...this.options, blockPhysicalDevices: !enabled };
    this.proxy.updateOptions(this.options);
  }

  async getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    return this.proxy.getUserMedia(constraints);
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    return this.proxy.enumerateDevices();
  }

  getTestApi(): RealCameraTestApi {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: (config: RealCameraTestConfig) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => ({ config: this.testConfig }),
      setVirtualPermission: (mode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), virtualPermission: mode });
      },
      setPhysicalDevicesEnabled: (enabled) => {
        this.setPhysicalDevicesEnabled(enabled);
      },
      setVirtualEnabled: (id, enabled) => {
        this.setVirtualEnabled(id, enabled);
      },
      setVirtualSourceOverride: (descriptor) => {
        return this.applySourceOverride(descriptor);
      },
      setSourceTransform: (transform) => {
        this.sourceTransform = transform;
        this.refreshSourcesForAllDevices();
      },
      setNextVirtualDeviceOverride: (override) => {
        this.nextVirtualOverride = override;
      },
      setVirtualSourceForDevice: (id, descriptor) => {
        return this.applySourceForDevice(id, descriptor);
      },
      listVirtualDevices: () => this.listVirtualDevices(),
      waitForFrame: (deviceId) => this.waitForFrame(deviceId),
      waitForFrames: (count, deviceId) => this.waitForFrames(count, deviceId),
      setNextGetUserMediaError: (error) => {
        this.proxy.setNextGetUserMediaError(error);
      },
      setGetUserMediaDelay: (delayMs) => {
        this.proxy.setGetUserMediaDelay(delayMs);
      },
      setEnumerateDevicesOverride: (override) => {
        this.proxy.setEnumerateDevicesOverride(override);
      },
      setSupportedConstraintsOverride: (override) => {
        this.proxy.setSupportedConstraintsOverride(override);
      },

      waitForPermissionRequest: () => this.waitForPermissionRequest(),
      listPendingPermissionRequests: () => this.listPendingPermissionRequests(),
      respondToPermissionRequest: (id, allow, options) =>
        this.respondToPermissionRequest(id, allow, options),
    };
    return this.testApi;
  }

  private applyTestConfig(config: RealCameraTestConfig): void {
    this.testConfig = { ...config };
    if (config.virtualPermission) {
      this.options = { ...this.options, virtualPermission: config.virtualPermission };
    }
    if (config.prePermissionEnumerateProfile) {
      this.options = {
        ...this.options,
        prePermissionEnumerateProfile: config.prePermissionEnumerateProfile,
      };
    }
    if (typeof config.blockPhysicalDevices === "boolean") {
      this.options = { ...this.options, blockPhysicalDevices: config.blockPhysicalDevices };
    }
    this.nextVirtualOverride = config.nextVirtualDevice;
    this.sourceOverride = config.virtualSourceOverride;
    this.sourceTransform = config.sourceTransform;
    this.sourceOverrideSource = this.sourceOverride
      ? buildTestSource(this.sourceOverride)
      : undefined;
    if (config.nextGetUserMediaError) {
      this.proxy.setNextGetUserMediaError(config.nextGetUserMediaError);
    }
    if (typeof config.getUserMediaDelayMs === "number") {
      this.proxy.setGetUserMediaDelay(config.getUserMediaDelayMs);
    }
    this.proxy.setVirtualVideoConstraintsOverride(
      config.virtualVideoConstraintsOverride
    );
    if (config.enumerateDevicesOverride) {
      this.proxy.setEnumerateDevicesOverride(config.enumerateDevicesOverride);
    }
    if (config.supportedConstraintsOverride) {
      this.proxy.setSupportedConstraintsOverride(config.supportedConstraintsOverride);
    }
    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDevices();

    // If tests change prompt behavior or virtualPermission, re-evaluate handler.
    this.maybeInstallDefaultPermissionPromptHandler();
  }

  private resetTestConfig(): void {
    this.testConfig = null;
    this.nextVirtualOverride = undefined;
    this.sourceOverride = undefined;
    this.sourceTransform = undefined;
    this.sourceOverrideSource = undefined;
    this.proxy.setVirtualVideoConstraintsOverride(undefined);
    this.refreshSourcesForAllDevices();

    this.clearAllPermissionPrompts();
    this.maybeInstallDefaultPermissionPromptHandler();
  }

  private maybeInstallDefaultPermissionPromptHandler(): void {
    // Only for virtualPermission="prompt" and only when the user didn't supply their own
    // onVirtualPermissionRequest handler. This keeps production/default behavior unchanged.
    if (this.options.virtualPermission !== "prompt" || this.hasCustomPermissionRequestHandler) {
      return;
    }

    const promptMode = this.testConfig?.permissionPromptMode ?? "manual";
    if (promptMode === "delegate") {
      return;
    }

    this.options = {
      ...this.options,
      onVirtualPermissionRequest: (deviceId: string) => this.handlePermissionPrompt(deviceId),
    };
    this.proxy.updateOptions(this.options);
  }

  private async handlePermissionPrompt(deviceId: string): Promise<boolean> {
    const request: RealCameraPermissionRequest = {
      id: `realcamera-perm-${++this.permissionRequestSeq}`,
      deviceId,
      requestedAt: Date.now(),
    };

    // Publish to waiters/queue.
    const waiter = this.permissionQueueWaiters.shift();
    if (waiter) {
      waiter(request);
    } else {
      this.permissionQueue.push(request);
    }

    const timeoutMs =
      typeof this.testConfig?.permissionPromptTimeoutMs === "number"
        ? this.testConfig.permissionPromptTimeoutMs
        : 15_000;

    const promise = new Promise<boolean>((resolve) => {
      const entry = {
        request,
        resolve: (allow: boolean) => resolve(Boolean(allow)),
        responded: false,
        timeoutId: undefined as number | undefined,
      };

      if (timeoutMs > 0) {
        entry.timeoutId = window.setTimeout(() => {
          this.respondToPermissionRequest(request.id, false).catch(() => undefined);
        }, timeoutMs);
      }

      this.pendingPermissionRequests.set(request.id, entry);
    });

    const allow = await promise;
    if (allow) {
      // Match real browsers: after granting once, device labels become available and
      // subsequent calls don't prompt again (origin-level permission).
      this.options = { ...this.options, virtualPermission: "allow" };
      this.proxy.updateOptions(this.options);
    }
    return allow;
  }

  private clearAllPermissionPrompts(): void {
    for (const [id, entry] of this.pendingPermissionRequests.entries()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      // Resolve outstanding promises as denied to avoid dangling awaits.
      try {
        entry.resolve(false);
      } catch {
        // ignore
      }
      this.pendingPermissionRequests.delete(id);
    }
    this.permissionQueue = [];
    this.permissionQueueWaiters = [];
  }

  private waitForPermissionRequest(): Promise<RealCameraPermissionRequest> {
    const next = this.permissionQueue.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise<RealCameraPermissionRequest>((resolve) => {
      this.permissionQueueWaiters.push(resolve);
    });
  }

  private listPendingPermissionRequests(): RealCameraPermissionRequest[] {
    return Array.from(this.pendingPermissionRequests.values()).map((e) => e.request);
  }

  private async respondToPermissionRequest(
    id: string,
    allow: boolean,
    options?: { afterMs?: number }
  ): Promise<void> {
    const entry = this.pendingPermissionRequests.get(id);
    if (!entry || entry.responded) {
      return;
    }
    entry.responded = true;
    this.pendingPermissionRequests.delete(id);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    const afterMs = options?.afterMs;
    if (typeof afterMs === "number" && afterMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, afterMs));
    }

    // Optional: if tests want a "human" delay but don't want to hard-code it,
    // they can pass afterMs sampled from the shared timing hub.
    entry.resolve(Boolean(allow));
  }

  private consumeVirtualOverride(): Partial<VirtualDeviceConfig> | undefined {
    const override = this.nextVirtualOverride;
    if (override) {
      this.nextVirtualOverride = undefined;
      return override;
    }
    const configOverrides = this.testConfig?.nextVirtualDevice;
    if (configOverrides) {
      this.testConfig = {
        ...(this.testConfig ?? {}),
        nextVirtualDevice: undefined,
      };
      return configOverrides;
    }
    return undefined;
  }

  private applySourceOverrides(source: VirtualFrameSource): VirtualFrameSource {
    if (this.sourceOverrideSource) {
      return this.sourceOverrideSource;
    }
    if (this.sourceTransform) {
      return applySourceTransform(source, this.sourceTransform);
    }
    return source;
  }

  private async applySourceOverride(
    descriptor?: RealCameraTestSourceDescriptor
  ): Promise<void> {
    this.sourceOverride = descriptor;
    if (!descriptor) {
      this.sourceOverrideSource = undefined;
      this.refreshSourcesForAllDevices();
      return;
    }
    this.sourceOverrideSource = await prepareTestSource(descriptor);
    this.refreshSourcesForAllDevices();
  }

  private async applySourceForDevice(
    id: string,
    descriptor: RealCameraTestSourceDescriptor
  ): Promise<void> {
    const source = await prepareTestSource(descriptor);
    this.baseSources.set(id, source);
    const resolved = this.applySourceOverrides(source);
    this.registry.setVirtualSource(id, resolved);
    this.proxy.updateVirtualSource(id, resolved);
  }

  private refreshSourcesForAllDevices(): void {
    const devices = this.registry.listVirtualDevices();
    devices.forEach((device) => {
      const baseSource = this.baseSources.get(device.id) ?? device.source;
      if (!baseSource) {
        return;
      }
      const resolved = this.applySourceOverrides(baseSource);
      this.registry.setVirtualSource(device.id, resolved);
      this.proxy.updateVirtualSource(device.id, resolved);
    });
  }

  private handleVirtualFrame(
    deviceId: string,
    frameIndex: number,
    timestamp: number
  ): void {
    const info: RealCameraTestFrameInfo = { deviceId, frameIndex, timestamp };
    this.resolveFrameWaiters(deviceId, info);
    this.resolveFrameWaiters("*", info);
  }

  private resolveFrameWaiters(key: string, info: RealCameraTestFrameInfo): void {
    const waiters = this.frameWaiters.get(key);
    if (!waiters || waiters.length === 0) {
      return;
    }
    this.frameWaiters.delete(key);
    waiters.forEach((resolve) => resolve(info));
  }

  private waitForFrame(deviceId?: string): Promise<RealCameraTestFrameInfo> {
    const key = deviceId ?? "*";
    return new Promise((resolve) => {
      const waiters = this.frameWaiters.get(key) ?? [];
      waiters.push(resolve);
      this.frameWaiters.set(key, waiters);
    });
  }

  private async waitForFrames(
    count: number,
    deviceId?: string
  ): Promise<RealCameraTestFrameInfo> {
    let info: RealCameraTestFrameInfo = {
      deviceId: deviceId ?? "*",
      frameIndex: 0,
      timestamp: 0,
    };
    for (let i = 0; i < count; i += 1) {
      info = await this.waitForFrame(deviceId);
    }
    return info;
  }

  private attachTestApi(enabled: boolean, windowProperty: string): void {
    const testWindow = getTestWindow();
    if (!testWindow) {
      return;
    }
    if (!enabled) {
      this.detachTestApi();
      return;
    }
    this.testApiProperty = windowProperty;
    testWindow[windowProperty] = this.getTestApi();
  }

  private detachTestApi(): void {
    const testWindow = getTestWindow();
    if (!testWindow || !this.testApiProperty) {
      return;
    }
    try {
      delete testWindow[this.testApiProperty];
    } catch {
      testWindow[this.testApiProperty] = undefined;
    }
  }
}
