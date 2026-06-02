import type {
  RealWebSocketInstallOptions,
  RealWebSocketTestApi,
  RealWebSocketTestApiOptions,
  RealWebSocketTestApiState,
  RealWebSocketTestConfig,
  VirtualWebSocketServerConfig,
  WebSocketMode,
} from "../types";
import { createWebSocketProxy } from "./WebSocketProxy";
import { VirtualWebSocketServerRegistry } from "./VirtualWebSocketServerRegistry";

type ResolvedInstallOptions = {
  socketMode: WebSocketMode;
  blockNativeWebSocket: boolean;
  testApi?: RealWebSocketTestApiOptions;
};

const DEFAULT_OPTIONS: ResolvedInstallOptions = {
  socketMode: "prefer-native",
  blockNativeWebSocket: false,
};

const DEFAULT_TEST_API_PROPERTY = "__realtestingWebSocketTestApi";

type RealTestingWindow = Window & {
  __REALTESTING_TEST__?: boolean;
  __REALTESTING_WEBSOCKET_TEST_CONFIG__?: RealWebSocketTestConfig;
  [key: string]: unknown;
};

function getTestWindow(): RealTestingWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as unknown as RealTestingWindow;
}

function resolveTestSetup(
  options: RealWebSocketInstallOptions
): { config: RealWebSocketTestConfig | null; enableApi: boolean; windowProperty: string } {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_WEBSOCKET_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled =
    params?.has("realtestingTest") ||
    params?.has("realtesting-test") ||
    testWindow?.__REALTESTING_TEST__ === true ||
    config?.enabled === true;
  const apiOptions: RealWebSocketTestApiOptions | undefined = options.testApi;
  const enableApi =
    apiOptions?.enabled === true || (apiOptions?.autoEnable !== false && autoEnabled);
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY,
  };
}

export class RealWebSocketCore {
  private installed = false;
  private originalCtor: typeof WebSocket | null = null;
  private registry = new VirtualWebSocketServerRegistry();

  private installOptions: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };
  private options: ResolvedInstallOptions = { ...DEFAULT_OPTIONS };

  private testConfig: RealWebSocketTestConfig | null = null;
  private testApi: RealWebSocketTestApi | null = null;
  private testApiProperty: string | null = null;

  isInstalled(): boolean {
    return this.installed;
  }

  install(options: RealWebSocketInstallOptions = {}): void {
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
        ((testWindow as any).WebSocket as typeof WebSocket | undefined) ?? null;
    }

    (testWindow as any).WebSocket = createWebSocketProxy({
      nativeCtor: this.originalCtor,
      registry: this.registry,
      getMode: () => this.options.socketMode,
      getBlockNative: () => this.options.blockNativeWebSocket,
    });

    this.installed = true;
  }

  uninstall(): void {
    const testWindow = getTestWindow();
    if (testWindow && this.originalCtor) {
      (testWindow as any).WebSocket = this.originalCtor;
    }
    this.detachTestApi();
    this.installed = false;
  }

  setSocketMode(mode: WebSocketMode): void {
    this.options = { ...this.options, socketMode: mode };
  }

  getSocketMode(): WebSocketMode {
    return this.options.socketMode;
  }

  setBlockNativeWebSocket(block: boolean): void {
    this.options = { ...this.options, blockNativeWebSocket: block };
  }

  getBlockNativeWebSocket(): boolean {
    return this.options.blockNativeWebSocket;
  }

  createVirtualServer(config: VirtualWebSocketServerConfig): string {
    return this.registry.createServer(config);
  }

  createEchoServer(match: string | RegExp): string {
    return this.createVirtualServer({
      match,
      label: "Echo Server",
      onMessage: (client, data) => {
        client.push(data);
      },
    });
  }

  clearVirtualServers(): void {
    this.registry.clearServers();
  }

  closeAllClients(): void {
    this.registry.closeAllClients();
  }

  listVirtualServers() {
    return this.registry.listServers();
  }

  getTestApi(): RealWebSocketTestApi {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config: RealWebSocketTestConfig) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => this.getState(),
      setSocketMode: (mode) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), socketMode: mode });
      },
      setBlockNativeWebSocket: (block) => {
        this.applyTestConfig({ ...(this.testConfig ?? {}), blockNativeWebSocket: block });
      },
      createEchoServer: (match) => this.createEchoServer(match),
      clearServers: () => this.clearVirtualServers(),
      closeAllClients: () => this.closeAllClients(),
    };
    return this.testApi;
  }

  private getState(): RealWebSocketTestApiState {
    return {
      config: this.testConfig,
      socketMode: this.options.socketMode,
      blockNativeWebSocket: this.options.blockNativeWebSocket,
      servers: this.registry.listServers(),
    };
  }

  private applyTestConfig(config: RealWebSocketTestConfig): void {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };

    if (config.socketMode) {
      this.options = { ...this.options, socketMode: config.socketMode };
    }
    if (typeof config.blockNativeWebSocket === "boolean") {
      this.options = { ...this.options, blockNativeWebSocket: config.blockNativeWebSocket };
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
