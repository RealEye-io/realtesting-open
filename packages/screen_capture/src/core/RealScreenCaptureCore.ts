import type {
  CaptureMode,
  RealScreenCaptureInstallOptions,
  RealScreenCaptureTestApi,
  RealScreenCaptureTestApiOptions,
  RealScreenCaptureTestConfig,
  RealScreenCaptureTestFrameInfo,
  RealScreenCapturePermissionPrompt,
  RealTestingTestSourceDescriptor,
  VirtualDisplayConfig,
  VirtualDisplayState,
  VirtualDisplayUpdate,
  VirtualFrameSource,
} from "../types";
import { VirtualDisplayRegistry } from "./VirtualDisplayRegistry";
import { MediaDevicesDisplayMediaProxy } from "./MediaDevicesDisplayMediaProxy";

type ResolvedInstallOptions = {
  mode: "proxy" | "explicit";
  captureMode: CaptureMode;
  virtualPermission: "allow" | "prompt" | "deny";
  onVirtualPermissionRequest: () => boolean | Promise<boolean>;
  blockNativeDisplayMedia: boolean;
  testApi?: RealScreenCaptureTestApiOptions;
};

const DEFAULT_OPTIONS: ResolvedInstallOptions = {
  mode: "proxy",
  captureMode: "prefer-native",
  virtualPermission: "prompt",
  onVirtualPermissionRequest: () => false,
  blockNativeDisplayMedia: false,
};

const DEFAULT_TEST_API_PROPERTY = "__realtestingTestApi";

type RealTestingWindow = Window & {
  __REALTESTING_TEST__?: boolean;
  __REALTESTING_TEST_CONFIG__?: RealScreenCaptureTestConfig;
  [key: string]: unknown;
};

function getTestWindow(): RealTestingWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as unknown as RealTestingWindow;
}

function resolveTestSetup(
  options: RealScreenCaptureInstallOptions
): { config: RealScreenCaptureTestConfig | null; enableApi: boolean; windowProperty: string } {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled =
    params?.has("realtestingTest") ||
    params?.has("realtesting-test") ||
    testWindow?.__REALTESTING_TEST__ === true ||
    config?.enabled === true;
  const apiOptions: RealScreenCaptureTestApiOptions | undefined = options.testApi;
  const enableApi = apiOptions?.enabled === true || (apiOptions?.autoEnable !== false && autoEnabled);
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY,
  };
}

function buildTestSource(descriptor: RealTestingTestSourceDescriptor): VirtualFrameSource {
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
          ctx.fillText(descriptor.text ?? "RealTesting Pattern", 24, 48);
          ctx.fillText(`Frame ${info.frameIndex}`, 24, 78);
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

async function prepareTestSource(descriptor: RealTestingTestSourceDescriptor): Promise<VirtualFrameSource> {
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
  return { type: "image", element: image, text: descriptor.text };
}

export class RealScreenCaptureCore {
  private registry = new VirtualDisplayRegistry();
  private installOptions: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };
  private options: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };
  private proxy = new MediaDevicesDisplayMediaProxy(this.registry, this.options);
  private installed = false;

  private baseSources = new Map<string, VirtualFrameSource>();
  private sourceOverride?: RealTestingTestSourceDescriptor;
  private sourceOverrideSource?: VirtualFrameSource;

  private testConfig: RealScreenCaptureTestConfig | null = null;
  private testApi: RealScreenCaptureTestApi | null = null;
  private testApiProperty: string | null = null;

  private frameWaiters = new Map<string, Array<(info: RealScreenCaptureTestFrameInfo) => void>>();

  private hasCustomPermissionRequestHandler = false;
  private permissionPromptSeq = 0;
  private pendingPermissionPrompts = new Map<
    string,
    {
      prompt: RealScreenCapturePermissionPrompt;
      resolve: (allow: boolean) => void;
      responded: boolean;
      timeoutId?: number;
    }
  >();
  private promptQueue: RealScreenCapturePermissionPrompt[] = [];
  private promptQueueWaiters: Array<(p: RealScreenCapturePermissionPrompt) => void> = [];

  constructor() {
    this.proxy.setOnVirtualFrame((displayId, info) => {
      this.handleVirtualFrame(displayId, info.frameIndex, info.timestamp);
    });
    this.registry.onChange(() => {
      // For future: dispatch events when virtual displays change.
    });
  }

  isInstalled(): boolean {
    return this.installed;
  }

  install(options: RealScreenCaptureInstallOptions = {}): void {
    this.installOptions = { ...DEFAULT_OPTIONS, ...options };
    this.options = { ...this.installOptions };

    this.hasCustomPermissionRequestHandler = Object.prototype.hasOwnProperty.call(
      options,
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
    this.installed = false;
  }

  uninstall(): void {
    this.proxy.uninstall();
    this.installed = false;
  }

  setCaptureMode(mode: CaptureMode): void {
    this.options = { ...this.options, captureMode: mode };
    this.proxy.updateOptions(this.options);
  }

  getCaptureMode(): CaptureMode {
    return this.options.captureMode;
  }

  setBlockNativeDisplayMedia(block: boolean): void {
    this.options = { ...this.options, blockNativeDisplayMedia: block };
    this.proxy.updateOptions(this.options);
  }

  getBlockNativeDisplayMedia(): boolean {
    return this.options.blockNativeDisplayMedia;
  }

  createVirtualDisplay(config: VirtualDisplayConfig = {}): string {
    return this.registry.addVirtualDisplay(config);
  }

  listVirtualDisplays(): VirtualDisplayState[] {
    return this.registry.listVirtualDisplays();
  }

  setVirtualEnabled(displayId: string, enabled: boolean): void {
    this.registry.setVirtualEnabled(displayId, enabled);
    if (!enabled) {
      this.proxy.stopVirtualStreams(displayId);
    }
  }

  updateVirtualDisplay(displayId: string, update: VirtualDisplayUpdate): void {
    this.registry.updateVirtualDisplay(displayId, update);
  }

  setVirtualSource(displayId: string, source: VirtualFrameSource): void {
    this.baseSources.set(displayId, source);
    const resolved = this.applySourceOverrides(source);
    this.registry.setVirtualSource(displayId, resolved);
    this.proxy.updateVirtualSource(displayId, resolved);
  }

  async getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream> {
    return this.proxy.getDisplayMedia(constraints);
  }

  getTestApi(): RealScreenCaptureTestApi {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config: RealScreenCaptureTestConfig) => {
        this.applyTestConfig(config);
        if (config.virtualSourceOverride) {
          await this.applySourceOverride(config.virtualSourceOverride);
        } else if ("virtualSourceOverride" in config) {
          await this.applySourceOverride(undefined);
        }
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => ({
        config: this.testConfig,
        captureMode: this.options.captureMode,
        blockNativeDisplayMedia: this.options.blockNativeDisplayMedia,
        virtualDisplays: this.listVirtualDisplays(),
      }),
      setCaptureMode: (mode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), captureMode: mode });
      },
      setVirtualPermission: (mode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), virtualPermission: mode });
      },
      setBlockNativeDisplayMedia: (block) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), blockNativeDisplayMedia: block });
      },
      setVirtualSourceOverride: (descriptor) => {
        return this.applySourceOverride(descriptor);
      },
      waitForFrames: (count, displayId) => this.waitForFrames(count, displayId),
      stopAllVirtualStreams: () => {
        this.proxy.stopVirtualStreams();
      },

      waitForPermissionPrompt: () => this.waitForPermissionPrompt(),
      listPendingPermissionPrompts: () => this.listPendingPermissionPrompts(),
      respondToPermissionPrompt: (id, allow, opts) =>
        this.respondToPermissionPrompt(id, allow, opts),
    };
    return this.testApi;
  }

  private applyTestConfig(config: RealScreenCaptureTestConfig): void {
    this.testConfig = { ...config };

    // Reset to install defaults, then layer test overrides.
    this.options = { ...this.installOptions };

    if (config.captureMode) {
      this.options = { ...this.options, captureMode: config.captureMode };
    }
    if (config.virtualPermission) {
      this.options = { ...this.options, virtualPermission: config.virtualPermission };
    }
    if (typeof config.blockNativeDisplayMedia === "boolean") {
      this.options = { ...this.options, blockNativeDisplayMedia: config.blockNativeDisplayMedia };
    }

    this.sourceOverride = config.virtualSourceOverride;
    this.sourceOverrideSource = this.sourceOverride ? buildTestSource(this.sourceOverride) : undefined;
    this.proxy.setSourceOverride(this.sourceOverrideSource);

    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDisplays();

    this.maybeInstallDefaultPermissionPromptHandler();
  }

  private resetTestConfig(): void {
    this.testConfig = null;
    this.options = { ...this.installOptions };
    this.sourceOverride = undefined;
    this.sourceOverrideSource = undefined;
    this.proxy.setSourceOverride(undefined);
    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDisplays();

    this.clearAllPermissionPrompts();
    this.maybeInstallDefaultPermissionPromptHandler();
  }

  private maybeInstallDefaultPermissionPromptHandler(): void {
    if (this.options.virtualPermission !== "prompt" || this.hasCustomPermissionRequestHandler) {
      return;
    }
    const promptMode = this.testConfig?.permissionPromptMode ?? "manual";
    if (promptMode === "delegate") {
      return;
    }

    this.options = {
      ...this.options,
      onVirtualPermissionRequest: () => this.handlePermissionPrompt(),
    };
    this.proxy.updateOptions(this.options);
  }

  private async handlePermissionPrompt(): Promise<boolean> {
    const prompt: RealScreenCapturePermissionPrompt = {
      id: `realtesting-display-perm-${++this.permissionPromptSeq}`,
      requestedAt: Date.now(),
    };

    const waiter = this.promptQueueWaiters.shift();
    if (waiter) {
      waiter(prompt);
    } else {
      this.promptQueue.push(prompt);
    }

    const timeoutMs =
      typeof this.testConfig?.permissionPromptTimeoutMs === "number"
        ? this.testConfig.permissionPromptTimeoutMs
        : 15_000;

    const allow = await new Promise<boolean>((resolve) => {
      const entry = {
        prompt,
        resolve: (decision: boolean) => resolve(Boolean(decision)),
        responded: false,
        timeoutId: undefined as number | undefined,
      };

      if (timeoutMs > 0) {
        entry.timeoutId = window.setTimeout(() => {
          this.respondToPermissionPrompt(prompt.id, false).catch(() => undefined);
        }, timeoutMs);
      }

      this.pendingPermissionPrompts.set(prompt.id, entry);
    });

    if (allow) {
      this.options = { ...this.options, virtualPermission: "allow" };
      this.proxy.updateOptions(this.options);
    }
    return allow;
  }

  private clearAllPermissionPrompts(): void {
    for (const [id, entry] of this.pendingPermissionPrompts.entries()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      try {
        entry.resolve(false);
      } catch {
        // ignore
      }
      this.pendingPermissionPrompts.delete(id);
    }
    this.promptQueue = [];
    this.promptQueueWaiters = [];
  }

  private waitForPermissionPrompt(): Promise<RealScreenCapturePermissionPrompt> {
    const next = this.promptQueue.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise<RealScreenCapturePermissionPrompt>((resolve) => {
      this.promptQueueWaiters.push(resolve);
    });
  }

  private listPendingPermissionPrompts(): RealScreenCapturePermissionPrompt[] {
    return Array.from(this.pendingPermissionPrompts.values()).map((e) => e.prompt);
  }

  private async respondToPermissionPrompt(
    id: string,
    allow: boolean,
    options?: { afterMs?: number }
  ): Promise<void> {
    const entry = this.pendingPermissionPrompts.get(id);
    if (!entry || entry.responded) {
      return;
    }
    entry.responded = true;
    this.pendingPermissionPrompts.delete(id);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    const afterMs = options?.afterMs;
    if (typeof afterMs === "number" && afterMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, afterMs));
    }
    entry.resolve(Boolean(allow));
  }

  private applySourceOverrides(source: VirtualFrameSource): VirtualFrameSource {
    if (this.sourceOverrideSource) {
      return this.sourceOverrideSource;
    }
    return source;
  }

  private async applySourceOverride(descriptor?: RealTestingTestSourceDescriptor): Promise<void> {
    this.sourceOverride = descriptor;
    if (this.testConfig) {
      this.testConfig = { ...(this.testConfig ?? {}), virtualSourceOverride: descriptor };
    }
    if (!descriptor) {
      this.sourceOverrideSource = undefined;
      this.proxy.setSourceOverride(undefined);
      this.refreshSourcesForAllDisplays();
      return;
    }
    this.sourceOverrideSource = await prepareTestSource(descriptor);
    this.proxy.setSourceOverride(this.sourceOverrideSource);
    this.refreshSourcesForAllDisplays();
  }

  private refreshSourcesForAllDisplays(): void {
    const displays = this.registry.listVirtualDisplayInternals();
    displays.forEach((display) => {
      const base = this.baseSources.get(display.id) ?? display.source;
      if (!base) {
        return;
      }
      const resolved = this.applySourceOverrides(base);
      this.registry.setVirtualSource(display.id, resolved);
      this.proxy.updateVirtualSource(display.id, resolved);
    });
  }

  private handleVirtualFrame(displayId: string, frameIndex: number, timestamp: number): void {
    const info: RealScreenCaptureTestFrameInfo = { displayId, frameIndex, timestamp };
    this.resolveFrameWaiters(displayId, info);
    this.resolveFrameWaiters("*", info);
  }

  private resolveFrameWaiters(key: string, info: RealScreenCaptureTestFrameInfo): void {
    const waiters = this.frameWaiters.get(key);
    if (!waiters || waiters.length === 0) {
      return;
    }
    this.frameWaiters.delete(key);
    waiters.forEach((resolve) => resolve(info));
  }

  private waitForFrame(displayId?: string): Promise<RealScreenCaptureTestFrameInfo> {
    const key = displayId ?? "*";
    return new Promise((resolve) => {
      const waiters = this.frameWaiters.get(key) ?? [];
      waiters.push(resolve);
      this.frameWaiters.set(key, waiters);
    });
  }

  private async waitForFrames(count: number, displayId?: string): Promise<RealScreenCaptureTestFrameInfo> {
    let info: RealScreenCaptureTestFrameInfo = { displayId: displayId ?? "*", frameIndex: 0, timestamp: 0 };
    for (let i = 0; i < count; i += 1) {
      info = await this.waitForFrame(displayId);
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
