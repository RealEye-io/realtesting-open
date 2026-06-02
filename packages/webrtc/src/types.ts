export type WebRtcMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";

export type RealWebRTCTestConfig = {
  enabled?: boolean;
  rtcMode?: WebRtcMode;
  blockNativePeerConnection?: boolean;
};

export type RealWebRTCTestApiOptions = {
  enabled?: boolean;
  autoEnable?: boolean;
  windowProperty?: string;
};

export type RealWebRTCInstallOptions = {
  rtcMode?: WebRtcMode;
  blockNativePeerConnection?: boolean;
  testApi?: RealWebRTCTestApiOptions;
};

export type RealWebRTCTestApiState = {
  config: RealWebRTCTestConfig | null;
  rtcMode: WebRtcMode;
  blockNativePeerConnection: boolean;
  virtualConnections: Array<{ id: string; connectionState: string; signalingState: string }>;
};

export type RealWebRTCTestApi = {
  configure: (config: RealWebRTCTestConfig) => Promise<void> | void;
  reset: () => void;
  getState: () => RealWebRTCTestApiState;
  setRtcMode: (mode: WebRtcMode) => void;
  setBlockNativePeerConnection: (block: boolean) => void;
  closeAllVirtualConnections: () => void;
};

