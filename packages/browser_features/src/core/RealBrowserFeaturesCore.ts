import type {
  PopupMode,
  RealBrowserFeaturesInstallOptions,
  RealBrowserFeaturesTestApi,
  RealBrowserFeaturesTestApiOptions,
  RealBrowserFeaturesTestApiState,
  RealBrowserFeaturesTestConfig,
} from "../types";
import { ClipboardProxy } from "./ClipboardProxy";
import { FullscreenProxy } from "./FullscreenProxy";
import { WindowOpenProxy } from "./WindowOpenProxy";

type ResolvedInstallOptions = {
  enableFullscreen: boolean;
  enablePopups: boolean;
  enableClipboard: boolean;
  popupMode: PopupMode;
  testApi?: RealBrowserFeaturesTestApiOptions;
};

const DEFAULT_TEST_API_PROPERTY = "__realtestingBrowserTestApi";

const DEFAULT_OPTIONS: ResolvedInstallOptions = {
  enableFullscreen: true,
  enablePopups: true,
  enableClipboard: true,
  popupMode: "prefer-native",
};

type RealTestingWindow = Window & {
  __REALTESTING_TEST__?: boolean;
  __REALTESTING_BROWSER_TEST_CONFIG__?: RealBrowserFeaturesTestConfig;
  [key: string]: unknown;
};

function getTestWindow(): RealTestingWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as unknown as RealTestingWindow;
}

function resolveTestSetup(
  options: RealBrowserFeaturesInstallOptions
): { config: RealBrowserFeaturesTestConfig | null; enableApi: boolean; windowProperty: string } {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_BROWSER_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled =
    params?.has("realtestingTest") ||
    params?.has("realtesting-test") ||
    testWindow?.__REALTESTING_TEST__ === true ||
    config?.enabled === true;
  const apiOptions: RealBrowserFeaturesTestApiOptions | undefined = options.testApi;
  const enableApi = apiOptions?.enabled === true || (apiOptions?.autoEnable !== false && autoEnabled);
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY,
  };
}

export class RealBrowserFeaturesCore {
  private installed = false;

  private installOptions: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };
  private options: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };

  private fullscreen = new FullscreenProxy();
  private popups = new WindowOpenProxy();
  private clipboard = new ClipboardProxy();

  private requireUserGesture = false;
  private gestureTokens = 0;
  private gestureUnsubscribers: Array<() => void> = [];

  private testConfig: RealBrowserFeaturesTestConfig | null = null;
  private testApi: RealBrowserFeaturesTestApi | null = null;
  private testApiProperty: string | null = null;

  isInstalled(): boolean {
    return this.installed;
  }

  install(options: RealBrowserFeaturesInstallOptions = {}): void {
    this.installOptions = { ...DEFAULT_OPTIONS, ...options };
    this.options = { ...this.installOptions };

    const testSetup = resolveTestSetup(options);
    if (testSetup.config) {
      this.applyTestConfig(testSetup.config);
    }

    this.attachTestApi(testSetup.enableApi, testSetup.windowProperty);

    this.installGestureListeners();
    this.refreshGestureHooks();

    if (this.options.enableFullscreen) {
      this.fullscreen.install();
    }
    if (this.options.enablePopups) {
      this.popups.install(this.options.popupMode);
    }
    if (this.options.enableClipboard) {
      this.clipboard.install(this.testConfig?.clipboardText);
    }

    this.installed = true;
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }
    this.detachTestApi();
    this.uninstallGestureListeners();
    this.fullscreen.uninstall();
    this.popups.uninstall();
    this.clipboard.uninstall();
    this.installed = false;
  }

  setPopupMode(mode: PopupMode): void {
    this.options = { ...this.options, popupMode: mode };
    this.popups.setPopupMode(mode);
  }

  getPopupMode(): PopupMode {
    return this.options.popupMode;
  }

  listVirtualPopups() {
    return this.popups.listVirtualPopups();
  }

  closeAllPopups(): void {
    this.popups.closeAllVirtualPopups();
  }

  setClipboardText(text: string): void {
    this.clipboard.setText(text);
  }

  getClipboardText(): string {
    return this.clipboard.getText();
  }

  isFullscreenActive(): boolean {
    return this.fullscreen.isFullscreenActive();
  }

  getTestApi(): RealBrowserFeaturesTestApi {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config: RealBrowserFeaturesTestConfig) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => this.getState(),
      setPopupMode: (mode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), popupMode: mode });
      },
      setClipboardText: (text) => {
        this.clipboard.setText(text);
      },
      setRequireUserGesture: (required) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), requireUserGesture: required });
      },
      provideUserGesture: (count) => {
        this.provideUserGesture(typeof count === "number" ? count : 1);
      },
      resetUserGestures: () => {
        this.gestureTokens = 0;
      },
      closeAllPopups: () => {
        this.closeAllPopups();
      },
    };
    return this.testApi;
  }

  private getState(): RealBrowserFeaturesTestApiState {
    return {
      config: this.testConfig,
      popupMode: this.options.popupMode,
      clipboardText: this.clipboard.getText(),
      fullscreenActive: this.fullscreen.isFullscreenActive(),
      virtualPopups: this.popups.listVirtualPopups(),
      requireUserGesture: this.requireUserGesture,
      gestureTokens: this.gestureTokens,
    };
  }

  private applyTestConfig(config: RealBrowserFeaturesTestConfig): void {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };
    if (config.popupMode) {
      this.options = { ...this.options, popupMode: config.popupMode };
    }
    if (typeof config.clipboardText === "string") {
      this.clipboard.setText(config.clipboardText);
    }
    this.requireUserGesture = config.requireUserGesture === true;
    this.popups.setPopupMode(this.options.popupMode);
    this.refreshGestureHooks();
  }

  private resetTestConfig(): void {
    this.testConfig = null;
    this.options = { ...this.installOptions };
    this.popups.setPopupMode(this.options.popupMode);
    this.requireUserGesture = false;
    this.gestureTokens = 0;
    this.refreshGestureHooks();
  }

  private refreshGestureHooks(): void {
    const hooks = {
      isRequired: () => this.requireUserGesture,
      consume: () => this.consumeUserGesture(),
    };
    this.fullscreen.setGestureHooks(hooks);
    this.popups.setGestureHooks(hooks);
    this.clipboard.setGestureHooks(hooks);
  }

  private consumeUserGesture(): boolean {
    if (!this.requireUserGesture) {
      return true;
    }
    if (this.gestureTokens <= 0) {
      return false;
    }
    this.gestureTokens = Math.max(0, this.gestureTokens - 1);
    return true;
  }

  private provideUserGesture(count: number): void {
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 1;
    if (n <= 0) {
      return;
    }
    this.gestureTokens = Math.min(50, this.gestureTokens + n);
  }

  private installGestureListeners(): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (this.gestureUnsubscribers.length > 0) {
      return;
    }
    const handler = () => this.provideUserGesture(1);
    const listen = (target: EventTarget, event: string) => {
      target.addEventListener(event, handler, { capture: true });
      return () => target.removeEventListener(event, handler, { capture: true } as any);
    };
    this.gestureUnsubscribers.push(listen(window, "pointerdown"));
    this.gestureUnsubscribers.push(listen(window, "mousedown"));
    this.gestureUnsubscribers.push(listen(window, "keydown"));
    this.gestureUnsubscribers.push(listen(window, "touchstart"));
  }

  private uninstallGestureListeners(): void {
    this.gestureUnsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
    this.gestureUnsubscribers = [];
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

