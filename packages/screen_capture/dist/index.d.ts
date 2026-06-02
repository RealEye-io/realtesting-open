type CaptureMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";
type VirtualPermission = "allow" | "prompt" | "deny";
type RealScreenCapturePermissionPrompt = {
    id: string;
    requestedAt: number;
};
type VirtualFrameSource = {
    type: "blank";
    color?: string;
    text?: string;
} | {
    type: "color";
    color: string;
    text?: string;
} | {
    type: "pattern";
    text?: string;
} | {
    type: "image";
    element: HTMLImageElement;
    text?: string;
} | {
    type: "canvas";
    element: HTMLCanvasElement;
} | {
    type: "video";
    element: HTMLVideoElement;
} | {
    type: "callback";
    draw: (ctx: CanvasRenderingContext2D, info: {
        width: number;
        height: number;
        frameIndex: number;
        timestamp: number;
    }) => void | Promise<void>;
};
type RealTestingTestSourceDescriptor = {
    type: "blank";
    color?: string;
    text?: string;
} | {
    type: "color";
    color: string;
    text?: string;
} | {
    type: "pattern";
    text?: string;
} | {
    type: "image";
    url: string;
    text?: string;
};
type ResolvedDisplayConstraints = {
    width: number;
    height: number;
    frameRate: number;
};
type VirtualDisplayConfig = {
    label?: string;
    defaultConstraints?: Partial<ResolvedDisplayConstraints>;
};
type VirtualDisplayUpdate = {
    enabled?: boolean;
    label?: string;
    defaultConstraints?: Partial<ResolvedDisplayConstraints>;
};
type VirtualDisplayState = {
    id: string;
    label: string;
    enabled: boolean;
    defaultConstraints: ResolvedDisplayConstraints;
};
type RealScreenCaptureTestConfig = {
    enabled?: boolean;
    captureMode?: CaptureMode;
    virtualPermission?: VirtualPermission;
    blockNativeDisplayMedia?: boolean;
    virtualSourceOverride?: RealTestingTestSourceDescriptor;
    /** When virtualPermission is "prompt", block until test responds via test API. */
    permissionPromptMode?: "manual" | "delegate";
    /** Auto-deny if a manual prompt isn't answered (prevents deadlocks). */
    permissionPromptTimeoutMs?: number;
};
type RealScreenCaptureTestApiOptions = {
    enabled?: boolean;
    autoEnable?: boolean;
    windowProperty?: string;
};
type RealScreenCaptureInstallOptions = {
    mode?: "proxy" | "explicit";
    captureMode?: CaptureMode;
    virtualPermission?: VirtualPermission;
    onVirtualPermissionRequest?: () => boolean | Promise<boolean>;
    blockNativeDisplayMedia?: boolean;
    testApi?: RealScreenCaptureTestApiOptions;
};
type RealScreenCaptureTestFrameInfo = {
    displayId: string;
    frameIndex: number;
    timestamp: number;
};
type RealScreenCaptureTestApiState = {
    config: RealScreenCaptureTestConfig | null;
    captureMode: CaptureMode;
    blockNativeDisplayMedia: boolean;
    virtualDisplays: VirtualDisplayState[];
};
type RealScreenCaptureTestApi = {
    configure: (config: RealScreenCaptureTestConfig) => Promise<void> | void;
    reset: () => void;
    getState: () => RealScreenCaptureTestApiState;
    setCaptureMode: (mode: CaptureMode) => void;
    setVirtualPermission: (mode: VirtualPermission) => void;
    setBlockNativeDisplayMedia: (block: boolean) => void;
    setVirtualSourceOverride: (descriptor?: RealTestingTestSourceDescriptor) => Promise<void>;
    waitForFrames: (count: number, displayId?: string) => Promise<RealScreenCaptureTestFrameInfo>;
    stopAllVirtualStreams: () => void;
    waitForPermissionPrompt: () => Promise<RealScreenCapturePermissionPrompt>;
    listPendingPermissionPrompts: () => RealScreenCapturePermissionPrompt[];
    respondToPermissionPrompt: (id: string, allow: boolean, options?: {
        afterMs?: number;
    }) => Promise<void>;
};

declare class RealScreenCaptureCore {
    private registry;
    private installOptions;
    private options;
    private proxy;
    private installed;
    private baseSources;
    private sourceOverride?;
    private sourceOverrideSource?;
    private testConfig;
    private testApi;
    private testApiProperty;
    private frameWaiters;
    private hasCustomPermissionRequestHandler;
    private permissionPromptSeq;
    private pendingPermissionPrompts;
    private promptQueue;
    private promptQueueWaiters;
    constructor();
    isInstalled(): boolean;
    install(options?: RealScreenCaptureInstallOptions): void;
    uninstall(): void;
    setCaptureMode(mode: CaptureMode): void;
    getCaptureMode(): CaptureMode;
    setBlockNativeDisplayMedia(block: boolean): void;
    getBlockNativeDisplayMedia(): boolean;
    createVirtualDisplay(config?: VirtualDisplayConfig): string;
    listVirtualDisplays(): VirtualDisplayState[];
    setVirtualEnabled(displayId: string, enabled: boolean): void;
    updateVirtualDisplay(displayId: string, update: VirtualDisplayUpdate): void;
    setVirtualSource(displayId: string, source: VirtualFrameSource): void;
    getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream>;
    getTestApi(): RealScreenCaptureTestApi;
    private applyTestConfig;
    private resetTestConfig;
    private maybeInstallDefaultPermissionPromptHandler;
    private handlePermissionPrompt;
    private clearAllPermissionPrompts;
    private waitForPermissionPrompt;
    private listPendingPermissionPrompts;
    private respondToPermissionPrompt;
    private applySourceOverrides;
    private applySourceOverride;
    private refreshSourcesForAllDisplays;
    private handleVirtualFrame;
    private resolveFrameWaiters;
    private waitForFrame;
    private waitForFrames;
    private attachTestApi;
    private detachTestApi;
}

declare const RealScreenCapture: RealScreenCaptureCore;

export { type CaptureMode, RealScreenCapture, type RealScreenCaptureInstallOptions, type RealScreenCapturePermissionPrompt, type RealScreenCaptureTestApi, type RealScreenCaptureTestApiOptions, type RealScreenCaptureTestApiState, type RealScreenCaptureTestConfig, type RealScreenCaptureTestFrameInfo, type RealTestingTestSourceDescriptor, type ResolvedDisplayConstraints, type VirtualDisplayConfig, type VirtualDisplayState, type VirtualDisplayUpdate, type VirtualFrameSource, type VirtualPermission };
