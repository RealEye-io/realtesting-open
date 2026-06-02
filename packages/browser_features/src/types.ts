export type PopupMode = "virtual" | "native" | "block" | "prefer-virtual" | "prefer-native";

export type RealBrowserFeaturesTestConfig = {
  enabled?: boolean;
  popupMode?: PopupMode;
  clipboardText?: string;
  /** If true, fullscreen/popup/clipboard actions require a simulated user gesture. */
  requireUserGesture?: boolean;
};

export type RealBrowserFeaturesTestApiOptions = {
  enabled?: boolean;
  autoEnable?: boolean;
  windowProperty?: string;
};

export type RealBrowserFeaturesInstallOptions = {
  enableFullscreen?: boolean;
  enablePopups?: boolean;
  enableClipboard?: boolean;

  popupMode?: PopupMode;
  testApi?: RealBrowserFeaturesTestApiOptions;
};

export type VirtualPopupState = {
  id: string;
  url: string;
  target?: string;
  closed: boolean;
};

export type RealBrowserFeaturesTestApiState = {
  config: RealBrowserFeaturesTestConfig | null;
  popupMode: PopupMode;
  clipboardText: string;
  fullscreenActive: boolean;
  virtualPopups: VirtualPopupState[];
  requireUserGesture: boolean;
  gestureTokens: number;
};

export type RealBrowserFeaturesTestApi = {
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

