import type {
  RealWebRTCInstallOptions,
  RealWebRTCTestApi,
  RealWebRTCTestApiOptions,
  RealWebRTCTestApiState,
  RealWebRTCTestConfig,
  WebRtcMode,
} from "../types";
import { createRTCPeerConnectionProxy } from "./RTCPeerConnectionProxy";
import { closeAllPeers, listPeers } from "./VirtualPeerRegistry";

type ResolvedInstallOptions = {
  rtcMode: WebRtcMode;
  blockNativePeerConnection: boolean;
  testApi?: RealWebRTCTestApiOptions;
};

const DEFAULT_OPTIONS: ResolvedInstallOptions = {
  rtcMode: "prefer-native",
  blockNativePeerConnection: false,
};

const DEFAULT_TEST_API_PROPERTY = "__realtestingWebrtcTestApi";

type RealTestingWindow = Window & {
  __REALTESTING_TEST__?: boolean;
  __REALTESTING_WEBRTC_TEST_CONFIG__?: RealWebRTCTestConfig;
  [key: string]: unknown;
};

function getTestWindow(): RealTestingWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as unknown as RealTestingWindow;
}

function resolveTestSetup(
  options: RealWebRTCInstallOptions
): { config: RealWebRTCTestConfig | null; enableApi: boolean; windowProperty: string } {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_WEBRTC_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled =
    params?.has("realtestingTest") ||
    params?.has("realtesting-test") ||
    testWindow?.__REALTESTING_TEST__ === true ||
    config?.enabled === true;
  const apiOptions: RealWebRTCTestApiOptions | undefined = options.testApi;
  const enableApi =
    apiOptions?.enabled === true || (apiOptions?.autoEnable !== false && autoEnabled);
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY,
  };
}

export class RealWebRTCCore {
  private installed = false;
  private originalCtor: typeof RTCPeerConnection | null = null;

  private installOptions: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };
  private options: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };

  private testConfig: RealWebRTCTestConfig | null = null;
  private testApi: RealWebRTCTestApi | null = null;
  private testApiProperty: string | null = null;

  isInstalled(): boolean {
    return this.installed;
  }

  install(options: RealWebRTCInstallOptions = {}): void {
    this.installOptions = { ...DEFAULT_OPTIONS, ...options };
    this.options = { ...this.installOptions };

    const testSetup = resolveTestSetup(options);
    if (testSetup.config) {
      this.applyTestConfig(testSetup.config);
    }

    this.attachTestApi(testSetup.enableApi, testSetup.windowProperty);

    const testWindow = getTestWindow();
    if (!testWindow) {
      return;
    }

    if (!this.originalCtor) {
      this.originalCtor =
        ((testWindow as any).RTCPeerConnection as typeof RTCPeerConnection | undefined) ??
        null;
    }

    (testWindow as any).RTCPeerConnection = createRTCPeerConnectionProxy({
      nativeCtor: this.originalCtor,
      getMode: () => this.options.rtcMode,
      getBlockNative: () => this.options.blockNativePeerConnection,
    });

    this.installed = true;
  }

  uninstall(): void {
    const testWindow = getTestWindow();
    if (testWindow && this.originalCtor) {
      (testWindow as any).RTCPeerConnection = this.originalCtor;
    }
    this.detachTestApi();
    this.installed = false;
  }

  setRtcMode(mode: WebRtcMode): void {
    this.options = { ...this.options, rtcMode: mode };
  }

  getRtcMode(): WebRtcMode {
    return this.options.rtcMode;
  }

  setBlockNativePeerConnection(block: boolean): void {
    this.options = { ...this.options, blockNativePeerConnection: block };
  }

  getBlockNativePeerConnection(): boolean {
    return this.options.blockNativePeerConnection;
  }

  closeAllVirtualConnections(): void {
    closeAllPeers();
  }

  getTestApi(): RealWebRTCTestApi {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config: RealWebRTCTestConfig) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => this.getState(),
      setRtcMode: (mode: WebRtcMode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), rtcMode: mode });
      },
      setBlockNativePeerConnection: (block: boolean) => {
        this.applyTestConfig({
          ...(this.testConfig ?? {}),
          blockNativePeerConnection: block,
        });
      },
      closeAllVirtualConnections: () => {
        this.closeAllVirtualConnections();
      },
    };
    return this.testApi;
  }

  private getState(): RealWebRTCTestApiState {
    return {
      config: this.testConfig,
      rtcMode: this.options.rtcMode,
      blockNativePeerConnection: this.options.blockNativePeerConnection,
      virtualConnections: listPeers(),
    };
  }

  private applyTestConfig(config: RealWebRTCTestConfig): void {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };

    if (config.rtcMode) {
      this.options = { ...this.options, rtcMode: config.rtcMode };
    }
    if (typeof config.blockNativePeerConnection === "boolean") {
      this.options = { ...this.options, blockNativePeerConnection: config.blockNativePeerConnection };
    }
  }

  private resetTestConfig(): void {
    this.testConfig = null;
    this.options = { ...this.installOptions };
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
