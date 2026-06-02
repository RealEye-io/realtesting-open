type PopupMode = "virtual" | "native" | "block" | "prefer-virtual" | "prefer-native";
type RealBrowserFeaturesTestConfig = {
    enabled?: boolean;
    popupMode?: PopupMode;
    clipboardText?: string;
    /** If true, fullscreen/popup/clipboard actions require a simulated user gesture. */
    requireUserGesture?: boolean;
};
type RealBrowserFeaturesTestApiOptions = {
    enabled?: boolean;
    autoEnable?: boolean;
    windowProperty?: string;
};
type RealBrowserFeaturesInstallOptions = {
    enableFullscreen?: boolean;
    enablePopups?: boolean;
    enableClipboard?: boolean;
    popupMode?: PopupMode;
    testApi?: RealBrowserFeaturesTestApiOptions;
};
type VirtualPopupState = {
    id: string;
    url: string;
    target?: string;
    closed: boolean;
};
type RealBrowserFeaturesTestApiState = {
    config: RealBrowserFeaturesTestConfig | null;
    popupMode: PopupMode;
    clipboardText: string;
    fullscreenActive: boolean;
    virtualPopups: VirtualPopupState[];
    requireUserGesture: boolean;
    gestureTokens: number;
};
type RealBrowserFeaturesTestApi = {
    configure: (config: RealBrowserFeaturesTestConfig) => Promise<void> | void;
    reset: () => void;
    getState: () => RealBrowserFeaturesTestApiState;
    setPopupMode: (mode: PopupMode) => void;
    setClipboardText: (text: string) => void;
    setRequireUserGesture: (required: boolean) => void;
    provideUserGesture: (count?: number) => void;
    resetUserGestures: () => void;
    closeAllPopups: () => void;
};

declare class RealBrowserFeaturesCore {
    private installed;
    private installOptions;
    private options;
    private fullscreen;
    private popups;
    private clipboard;
    private requireUserGesture;
    private gestureTokens;
    private gestureUnsubscribers;
    private testConfig;
    private testApi;
    private testApiProperty;
    isInstalled(): boolean;
    install(options?: RealBrowserFeaturesInstallOptions): void;
    uninstall(): void;
    setPopupMode(mode: PopupMode): void;
    getPopupMode(): PopupMode;
    listVirtualPopups(): VirtualPopupState[];
    closeAllPopups(): void;
    setClipboardText(text: string): void;
    getClipboardText(): string;
    isFullscreenActive(): boolean;
    getTestApi(): RealBrowserFeaturesTestApi;
    private getState;
    private applyTestConfig;
    private resetTestConfig;
    private refreshGestureHooks;
    private consumeUserGesture;
    private provideUserGesture;
    private installGestureListeners;
    private uninstallGestureListeners;
    private attachTestApi;
    private detachTestApi;
}

declare const RealBrowserFeatures: RealBrowserFeaturesCore;

export { type PopupMode, RealBrowserFeatures, type RealBrowserFeaturesInstallOptions, type RealBrowserFeaturesTestApi, type RealBrowserFeaturesTestApiOptions, type RealBrowserFeaturesTestApiState, type RealBrowserFeaturesTestConfig, type VirtualPopupState };
