type WebSocketMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";
type VirtualWebSocketServerClient = {
    url: string;
    protocols: string[];
    push: (data: string | ArrayBuffer | Blob) => void;
    close: (code?: number, reason?: string) => void;
};
type VirtualWebSocketServerConfig = {
    match: string | RegExp;
    label?: string;
    onConnect?: (client: VirtualWebSocketServerClient) => void;
    onMessage?: (client: VirtualWebSocketServerClient, data: string | ArrayBuffer | Blob) => void;
    onClose?: (client: VirtualWebSocketServerClient, code?: number, reason?: string) => void;
};
type VirtualWebSocketServerState = {
    id: string;
    label: string;
    match: string;
    clientCount: number;
};
type RealWebSocketTestConfig = {
    enabled?: boolean;
    socketMode?: WebSocketMode;
    blockNativeWebSocket?: boolean;
};
type RealWebSocketTestApiOptions = {
    enabled?: boolean;
    autoEnable?: boolean;
    windowProperty?: string;
};
type RealWebSocketInstallOptions = {
    socketMode?: WebSocketMode;
    blockNativeWebSocket?: boolean;
    testApi?: RealWebSocketTestApiOptions;
};
type RealWebSocketTestApiState = {
    config: RealWebSocketTestConfig | null;
    socketMode: WebSocketMode;
    blockNativeWebSocket: boolean;
    servers: VirtualWebSocketServerState[];
};
type RealWebSocketTestApi = {
    configure: (config: RealWebSocketTestConfig) => Promise<void> | void;
    reset: () => void;
    getState: () => RealWebSocketTestApiState;
    setSocketMode: (mode: WebSocketMode) => void;
    setBlockNativeWebSocket: (block: boolean) => void;
    createEchoServer: (match: string | RegExp) => string;
    clearServers: () => void;
    closeAllClients: () => void;
};

declare class RealWebSocketCore {
    private installed;
    private originalCtor;
    private registry;
    private installOptions;
    private options;
    private testConfig;
    private testApi;
    private testApiProperty;
    isInstalled(): boolean;
    install(options?: RealWebSocketInstallOptions): void;
    uninstall(): void;
    setSocketMode(mode: WebSocketMode): void;
    getSocketMode(): WebSocketMode;
    setBlockNativeWebSocket(block: boolean): void;
    getBlockNativeWebSocket(): boolean;
    createVirtualServer(config: VirtualWebSocketServerConfig): string;
    createEchoServer(match: string | RegExp): string;
    clearVirtualServers(): void;
    closeAllClients(): void;
    listVirtualServers(): VirtualWebSocketServerState[];
    getTestApi(): RealWebSocketTestApi;
    private getState;
    private applyTestConfig;
    private resetTestConfig;
    private attachTestApi;
    private detachTestApi;
}

declare const RealWebSocket: RealWebSocketCore;

export { RealWebSocket, type RealWebSocketInstallOptions, type RealWebSocketTestApi, type RealWebSocketTestApiOptions, type RealWebSocketTestApiState, type RealWebSocketTestConfig, type VirtualWebSocketServerClient, type VirtualWebSocketServerConfig, type VirtualWebSocketServerState, type WebSocketMode };
