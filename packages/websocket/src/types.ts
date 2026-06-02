export type WebSocketMode = "virtual" | "native" | "prefer-virtual" | "prefer-native";

export type VirtualWebSocketServerClient = {
  url: string;
  protocols: string[];
  push: (data: string | ArrayBuffer | Blob) => void;
  close: (code?: number, reason?: string) => void;
};

export type VirtualWebSocketServerConfig = {
  match: string | RegExp;
  label?: string;
  onConnect?: (client: VirtualWebSocketServerClient) => void;
  onMessage?: (client: VirtualWebSocketServerClient, data: string | ArrayBuffer | Blob) => void;
  onClose?: (client: VirtualWebSocketServerClient, code?: number, reason?: string) => void;
};

export type VirtualWebSocketServerState = {
  id: string;
  label: string;
  match: string;
  clientCount: number;
};

export type RealWebSocketTestConfig = {
  enabled?: boolean;
  socketMode?: WebSocketMode;
  blockNativeWebSocket?: boolean;
};

export type RealWebSocketTestApiOptions = {
  enabled?: boolean;
  autoEnable?: boolean;
  windowProperty?: string;
};

export type RealWebSocketInstallOptions = {
  socketMode?: WebSocketMode;
  blockNativeWebSocket?: boolean;
  testApi?: RealWebSocketTestApiOptions;
};

export type RealWebSocketTestApiState = {
  config: RealWebSocketTestConfig | null;
  socketMode: WebSocketMode;
  blockNativeWebSocket: boolean;
  servers: VirtualWebSocketServerState[];
};

export type RealWebSocketTestApi = {
  configure: (config: RealWebSocketTestConfig) => Promise<void> | void;
  reset: () => void;
  getState: () => RealWebSocketTestApiState;
  setSocketMode: (mode: WebSocketMode) => void;
  setBlockNativeWebSocket: (block: boolean) => void;
  createEchoServer: (match: string | RegExp) => string;
  clearServers: () => void;
  closeAllClients: () => void;
};
