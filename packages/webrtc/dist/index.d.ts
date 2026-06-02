type WebRtcMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";
type RealWebRTCTestConfig = {
    enabled?: boolean;
    rtcMode?: WebRtcMode;
    blockNativePeerConnection?: boolean;
};
type RealWebRTCTestApiOptions = {
    enabled?: boolean;
    autoEnable?: boolean;
    windowProperty?: string;
};
type RealWebRTCInstallOptions = {
    rtcMode?: WebRtcMode;
    blockNativePeerConnection?: boolean;
    testApi?: RealWebRTCTestApiOptions;
};
type RealWebRTCTestApiState = {
    config: RealWebRTCTestConfig | null;
    rtcMode: WebRtcMode;
    blockNativePeerConnection: boolean;
    virtualConnections: Array<{
        id: string;
        connectionState: string;
        signalingState: string;
    }>;
};
type RealWebRTCTestApi = {
    configure: (config: RealWebRTCTestConfig) => Promise<void> | void;
    reset: () => void;
    getState: () => RealWebRTCTestApiState;
    setRtcMode: (mode: WebRtcMode) => void;
    setBlockNativePeerConnection: (block: boolean) => void;
    closeAllVirtualConnections: () => void;
};

declare class RealWebRTCCore {
    private installed;
    private originalCtor;
    private installOptions;
    private options;
    private testConfig;
    private testApi;
    private testApiProperty;
    isInstalled(): boolean;
    install(options?: RealWebRTCInstallOptions): void;
    uninstall(): void;
    setRtcMode(mode: WebRtcMode): void;
    getRtcMode(): WebRtcMode;
    setBlockNativePeerConnection(block: boolean): void;
    getBlockNativePeerConnection(): boolean;
    closeAllVirtualConnections(): void;
    getTestApi(): RealWebRTCTestApi;
    private getState;
    private applyTestConfig;
    private resetTestConfig;
    private attachTestApi;
    private detachTestApi;
}

declare const RealWebRTC: RealWebRTCCore;

export { RealWebRTC, type RealWebRTCInstallOptions, type RealWebRTCTestApi, type RealWebRTCTestApiOptions, type RealWebRTCTestApiState, type RealWebRTCTestConfig, type WebRtcMode };
