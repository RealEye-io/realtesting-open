export type CaptureMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";

export type VirtualPermission = "allow" | "prompt" | "deny";

export type RealScreenCapturePermissionPrompt = {
  id: string;
  requestedAt: number;
};

export type VirtualFrameSource =
  | { type: "blank"; color?: string; text?: string }
  | { type: "color"; color: string; text?: string }
  | { type: "pattern"; text?: string }
  | { type: "image"; element: HTMLImageElement; text?: string }
  | { type: "canvas"; element: HTMLCanvasElement }
  | { type: "video"; element: HTMLVideoElement }
  | {
      type: "callback";
      draw: (
        ctx: CanvasRenderingContext2D,
        info: { width: number; height: number; frameIndex: number; timestamp: number }
      ) => void | Promise<void>;
    };

export type RealTestingTestSourceDescriptor =
  | { type: "blank"; color?: string; text?: string }
  | { type: "color"; color: string; text?: string }
  | { type: "pattern"; text?: string }
  | { type: "image"; url: string; text?: string };

export type ResolvedDisplayConstraints = {
  width: number;
  height: number;
  frameRate: number;
};

export type VirtualDisplayConfig = {
  label?: string;
  defaultConstraints?: Partial<ResolvedDisplayConstraints>;
};

export type VirtualDisplayUpdate = {
  enabled?: boolean;
  label?: string;
  defaultConstraints?: Partial<ResolvedDisplayConstraints>;
};

export type VirtualDisplayState = {
  id: string;
  label: string;
  enabled: boolean;
  defaultConstraints: ResolvedDisplayConstraints;
};

export type RealScreenCaptureTestConfig = {
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

export type RealScreenCaptureTestApiOptions = {
  enabled?: boolean;
  autoEnable?: boolean;
  windowProperty?: string;
};

export type RealScreenCaptureInstallOptions = {
  mode?: "proxy" | "explicit";
  captureMode?: CaptureMode;
  virtualPermission?: VirtualPermission;
  onVirtualPermissionRequest?: () => boolean | Promise<boolean>;
  blockNativeDisplayMedia?: boolean;
  testApi?: RealScreenCaptureTestApiOptions;
};

export type RealScreenCaptureTestFrameInfo = {
  displayId: string;
  frameIndex: number;
  timestamp: number;
};

export type RealScreenCaptureTestApiState = {
  config: RealScreenCaptureTestConfig | null;
  captureMode: CaptureMode;
  blockNativeDisplayMedia: boolean;
  virtualDisplays: VirtualDisplayState[];
};

export type RealScreenCaptureTestApi = {
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
  respondToPermissionPrompt: (
    id: string,
    allow: boolean,
    options?: { afterMs?: number }
  ) => Promise<void>;
};

