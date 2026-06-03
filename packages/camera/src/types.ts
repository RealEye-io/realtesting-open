export type RealCameraMode = "proxy" | "explicit";
export type VirtualPermissionMode = "allow" | "prompt" | "deny";
export type PrePermissionEnumerateProfile =
  | "legacy"
  | "anonymous-all"
  | "single-anonymous";

export type RealCameraPermissionRequest = {
  /** Unique id for this prompt/request. */
  id: string;
  /** Device that triggered the prompt. */
  deviceId: string;
  /** Unix ms timestamp when the request was created. */
  requestedAt: number;
};

export interface RealCameraInstallOptions {
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

export type ResolvedRealCameraInstallOptions = Required<
  Omit<RealCameraInstallOptions, "testApi">
>;

export interface VirtualDeviceConfig {
  label?: string;
  groupId?: string;
  enabled?: boolean;
  defaultConstraints?: MediaTrackConstraints;
}

export interface VirtualDeviceUpdate {
  label?: string;
  groupId?: string;
  enabled?: boolean;
  defaultConstraints?: MediaTrackConstraints;
}

export type VirtualFrameSource =
  | CanvasFrameSource
  | VideoFrameSource
  | ImageFrameSource
  | CallbackFrameSource;

export interface CanvasFrameSource {
  type: "canvas";
  element: HTMLCanvasElement;
}

export interface VideoFrameSource {
  type: "video";
  element: HTMLVideoElement;
}

export interface ImageFrameSource {
  type: "image";
  element: CanvasImageSource;
}

export interface CallbackFrameSource {
  type: "callback";
  draw: (
    ctx: CanvasRenderingContext2D,
    info: VirtualFrameInfo
  ) => void | Promise<void>;
}

export interface VirtualFrameInfo {
  width: number;
  height: number;
  timestamp: number;
  frameIndex: number;
}

export interface VirtualDeviceState {
  id: string;
  label: string;
  groupId: string;
  enabled: boolean;
  defaultConstraints: MediaTrackConstraints;
  source?: VirtualFrameSource;
}

export interface ResolvedVideoConstraints {
  width: number;
  height: number;
  frameRate: number;
}

export interface RealCameraTestApiOptions {
  enabled?: boolean;
  windowProperty?: string;
  autoEnable?: boolean;
}

export interface RealCameraTestConfig {
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

export interface RealCameraTestState {
  config: RealCameraTestConfig | null;
}

export interface RealCameraTestFrameInfo {
  deviceId: string;
  frameIndex: number;
  timestamp: number;
}

export type RealCameraTestSourceDescriptor =
  | { type: "blank"; color?: string; text?: string }
  | { type: "color"; color: string; text?: string }
  | { type: "pattern" }
  | { type: "image"; url: string; text?: string };

export interface RealCameraTestSourceSwapTransform {
  type: "swap";
  afterFrames?: number;
  afterMs?: number;
  after: RealCameraTestSourceDescriptor;
}

export type RealCameraTestSourceTransform = RealCameraTestSourceSwapTransform;

export interface RealCameraTestApi {
  configure: (config: RealCameraTestConfig) => Promise<void> | void;
  reset: () => void;
  getState: () => RealCameraTestState;
  setVirtualPermission: (mode: VirtualPermissionMode) => void;
  setPhysicalDevicesEnabled: (enabled: boolean) => void;
  setVirtualEnabled: (id: string, enabled: boolean) => void;
  setVirtualSourceOverride: (
    descriptor?: RealCameraTestSourceDescriptor
  ) => Promise<void> | void;
  setSourceTransform: (
    transform?: RealCameraTestSourceTransform
  ) => Promise<void> | void;
  setNextVirtualDeviceOverride: (override?: Partial<VirtualDeviceConfig>) => void;
  setVirtualSourceForDevice: (
    id: string,
    descriptor: RealCameraTestSourceDescriptor
  ) => Promise<void> | void;
  listVirtualDevices: () => VirtualDeviceState[];
  waitForFrame: (deviceId?: string) => Promise<RealCameraTestFrameInfo>;
  waitForFrames: (count: number, deviceId?: string) => Promise<RealCameraTestFrameInfo>;
  setNextGetUserMediaError: (error?: RealCameraTestError) => void;
  setGetUserMediaDelay: (delayMs?: number) => void;
  setEnumerateDevicesOverride: (override?: RealCameraTestEnumerateOverride) => void;
  setSupportedConstraintsOverride: (
    override?: MediaTrackSupportedConstraints
  ) => void;

  /** Wait until a permission prompt is requested (virtualPermission="prompt"). */
  waitForPermissionRequest: () => Promise<RealCameraPermissionRequest>;
  /** List currently pending, unanswered prompts. */
  listPendingPermissionRequests: () => RealCameraPermissionRequest[];
  /** Respond to a pending prompt. */
  respondToPermissionRequest: (
    id: string,
    allow: boolean,
    options?: { afterMs?: number }
  ) => Promise<void>;
}

export interface RealCameraTestError {
  name: string;
  message?: string;
  constraint?: string;
}

export interface MediaDeviceInfoLike {
  deviceId: string;
  kind: MediaDeviceKind;
  label?: string;
  groupId?: string;
}

export interface RealCameraTestEnumerateOverride {
  devices: MediaDeviceInfoLike[];
  once?: boolean;
}
