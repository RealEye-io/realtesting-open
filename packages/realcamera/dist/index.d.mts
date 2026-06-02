type RealCameraMode = "proxy" | "explicit";
type VirtualPermissionMode = "allow" | "prompt" | "deny";
type PrePermissionEnumerateProfile = "legacy" | "anonymous-all" | "single-anonymous";
type RealCameraPermissionRequest = {
    /** Unique id for this prompt/request. */
    id: string;
    /** Device that triggered the prompt. */
    deviceId: string;
    /** Unix ms timestamp when the request was created. */
    requestedAt: number;
};
interface RealCameraInstallOptions {
    mode?: RealCameraMode;
    virtualPermission?: VirtualPermissionMode;
    /**
     * Controls what virtual videoinput metadata looks like before camera permission
     * has been granted.
     *
     * - `legacy`: keep current RealCamera behavior (real deviceId/groupId, empty label)
     * - `anonymous-all`: expose all virtual cameras but blank out deviceId/groupId/label
      * - `single-anonymous`: expose only one pre-permission virtual camera entry while
      *   keeping a usable deviceId for the default device and hiding the label
     */
    prePermissionEnumerateProfile?: PrePermissionEnumerateProfile;
    onVirtualPermissionRequest?: (deviceId: string) => Promise<boolean> | boolean;
    includeVirtualDevices?: boolean;
    blockPhysicalDevices?: boolean;
    testApi?: RealCameraTestApiOptions;
}
type ResolvedRealCameraInstallOptions = Required<Omit<RealCameraInstallOptions, "testApi">>;
interface VirtualDeviceConfig {
    label?: string;
    groupId?: string;
    enabled?: boolean;
    defaultConstraints?: MediaTrackConstraints;
}
interface VirtualDeviceUpdate {
    label?: string;
    groupId?: string;
    enabled?: boolean;
    defaultConstraints?: MediaTrackConstraints;
}
type VirtualFrameSource = CanvasFrameSource | VideoFrameSource | ImageFrameSource | CallbackFrameSource;
interface CanvasFrameSource {
    type: "canvas";
    element: HTMLCanvasElement;
}
interface VideoFrameSource {
    type: "video";
    element: HTMLVideoElement;
}
interface ImageFrameSource {
    type: "image";
    element: CanvasImageSource;
}
interface CallbackFrameSource {
    type: "callback";
    draw: (ctx: CanvasRenderingContext2D, info: VirtualFrameInfo) => void | Promise<void>;
}
interface VirtualFrameInfo {
    width: number;
    height: number;
    timestamp: number;
    frameIndex: number;
}
interface VirtualDeviceState {
    id: string;
    label: string;
    groupId: string;
    enabled: boolean;
    defaultConstraints: MediaTrackConstraints;
    source?: VirtualFrameSource;
}
interface ResolvedVideoConstraints {
    width: number;
    height: number;
    frameRate: number;
}
interface RealCameraTestApiOptions {
    enabled?: boolean;
    windowProperty?: string;
    autoEnable?: boolean;
}
interface RealCameraTestConfig {
    enabled?: boolean;
    virtualPermission?: VirtualPermissionMode;
    prePermissionEnumerateProfile?: PrePermissionEnumerateProfile;
    blockPhysicalDevices?: boolean;
    /**
     * Forces virtual-camera streams to use these video constraints regardless of
     * what the application requests. Useful for deterministic emulation profiles
     * such as fixed 640x480 @ 30fps ET automation feeds.
     */
    virtualVideoConstraintsOverride?: MediaTrackConstraints;
    nextVirtualDevice?: Partial<VirtualDeviceConfig>;
    virtualSourceOverride?: RealCameraTestSourceDescriptor;
    sourceTransform?: RealCameraTestSourceTransform;
    nextGetUserMediaError?: RealCameraTestError;
    getUserMediaDelayMs?: number;
    /**
     * If set, permission prompts can be fully manual (blocked until responded via test API).
     * If unset, prompt mode uses the install option onVirtualPermissionRequest.
     */
    permissionPromptMode?: "manual" | "delegate";
    /** Auto-deny if a manual prompt isn't answered (prevents deadlocks). */
    permissionPromptTimeoutMs?: number;
    enumerateDevicesOverride?: RealCameraTestEnumerateOverride;
    supportedConstraintsOverride?: MediaTrackSupportedConstraints;
}
interface RealCameraTestState {
    config: RealCameraTestConfig | null;
}
interface RealCameraTestFrameInfo {
    deviceId: string;
    frameIndex: number;
    timestamp: number;
}
type RealCameraTestSourceDescriptor = {
    type: "blank";
    color?: string;
    text?: string;
} | {
    type: "color";
    color: string;
    text?: string;
} | {
    type: "pattern";
} | {
    type: "image";
    url: string;
    text?: string;
};
interface RealCameraTestSourceSwapTransform {
    type: "swap";
    afterFrames?: number;
    afterMs?: number;
    after: RealCameraTestSourceDescriptor;
}
type RealCameraTestSourceTransform = RealCameraTestSourceSwapTransform;
interface RealCameraTestApi {
    configure: (config: RealCameraTestConfig) => Promise<void> | void;
    reset: () => void;
    getState: () => RealCameraTestState;
    setVirtualPermission: (mode: VirtualPermissionMode) => void;
    setPhysicalDevicesEnabled: (enabled: boolean) => void;
    setVirtualEnabled: (id: string, enabled: boolean) => void;
    setVirtualSourceOverride: (descriptor?: RealCameraTestSourceDescriptor) => Promise<void> | void;
    setSourceTransform: (transform?: RealCameraTestSourceTransform) => Promise<void> | void;
    setNextVirtualDeviceOverride: (override?: Partial<VirtualDeviceConfig>) => void;
    setVirtualSourceForDevice: (id: string, descriptor: RealCameraTestSourceDescriptor) => Promise<void> | void;
    listVirtualDevices: () => VirtualDeviceState[];
    waitForFrame: (deviceId?: string) => Promise<RealCameraTestFrameInfo>;
    waitForFrames: (count: number, deviceId?: string) => Promise<RealCameraTestFrameInfo>;
    setNextGetUserMediaError: (error?: RealCameraTestError) => void;
    setGetUserMediaDelay: (delayMs?: number) => void;
    setEnumerateDevicesOverride: (override?: RealCameraTestEnumerateOverride) => void;
    setSupportedConstraintsOverride: (override?: MediaTrackSupportedConstraints) => void;
    /** Wait until a permission prompt is requested (virtualPermission="prompt"). */
    waitForPermissionRequest: () => Promise<RealCameraPermissionRequest>;
    /** List currently pending, unanswered prompts. */
    listPendingPermissionRequests: () => RealCameraPermissionRequest[];
    /** Respond to a pending prompt. */
    respondToPermissionRequest: (id: string, allow: boolean, options?: {
        afterMs?: number;
    }) => Promise<void>;
}
interface RealCameraTestError {
    name: string;
    message?: string;
    constraint?: string;
}
interface MediaDeviceInfoLike {
    deviceId: string;
    kind: MediaDeviceKind;
    label?: string;
    groupId?: string;
}
interface RealCameraTestEnumerateOverride {
    devices: MediaDeviceInfoLike[];
    once?: boolean;
}

declare class RealCameraCore {
    private registry;
    private options;
    private proxy;
    private installed;
    private unsubscribe?;
    private testConfig;
    private testApi;
    private testApiProperty;
    private nextVirtualOverride;
    private sourceOverride;
    private sourceTransform;
    private sourceOverrideSource;
    private baseSources;
    private frameWaiters;
    private permissionRequestSeq;
    private pendingPermissionRequests;
    private permissionQueue;
    private permissionQueueWaiters;
    private hasCustomPermissionRequestHandler;
    constructor();
    install(options?: RealCameraInstallOptions): void;
    uninstall(): void;
    isInstalled(): boolean;
    createVirtualDevice(config?: VirtualDeviceConfig): string;
    updateVirtualDevice(id: string, update: VirtualDeviceUpdate): void;
    removeVirtualDevice(id: string): void;
    setVirtualSource(id: string, source: VirtualFrameSource): void;
    setVirtualEnabled(id: string, enabled: boolean): void;
    listVirtualDevices(): VirtualDeviceState[];
    setPhysicalDevicesEnabled(enabled: boolean): void;
    getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
    enumerateDevices(): Promise<MediaDeviceInfo[]>;
    getTestApi(): RealCameraTestApi;
    private applyTestConfig;
    private resetTestConfig;
    private maybeInstallDefaultPermissionPromptHandler;
    private handlePermissionPrompt;
    private clearAllPermissionPrompts;
    private waitForPermissionRequest;
    private listPendingPermissionRequests;
    private respondToPermissionRequest;
    private consumeVirtualOverride;
    private applySourceOverrides;
    private applySourceOverride;
    private applySourceForDevice;
    private refreshSourcesForAllDevices;
    private handleVirtualFrame;
    private resolveFrameWaiters;
    private waitForFrame;
    private waitForFrames;
    private attachTestApi;
    private detachTestApi;
}

declare const RealCamera: RealCameraCore;

export { type CallbackFrameSource, type CanvasFrameSource, type ImageFrameSource, type MediaDeviceInfoLike, type PrePermissionEnumerateProfile, RealCamera, type RealCameraInstallOptions, type RealCameraMode, type RealCameraPermissionRequest, type RealCameraTestApi, type RealCameraTestApiOptions, type RealCameraTestConfig, type RealCameraTestEnumerateOverride, type RealCameraTestError, type RealCameraTestFrameInfo, type RealCameraTestSourceDescriptor, type RealCameraTestSourceSwapTransform, type RealCameraTestSourceTransform, type RealCameraTestState, type ResolvedRealCameraInstallOptions, type ResolvedVideoConstraints, type VideoFrameSource, type VirtualDeviceConfig, type VirtualDeviceState, type VirtualDeviceUpdate, type VirtualFrameInfo, type VirtualFrameSource, type VirtualPermissionMode };
