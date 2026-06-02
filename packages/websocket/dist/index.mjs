// packages/websocket/src/utils/realtestingTiming.ts
var COUNTERS_KEY = "__REALTESTING_TIMING_COUNTERS__";
function clampRange(range) {
  const minMs = Number.isFinite(range.minMs) ? Math.max(0, Math.floor(range.minMs)) : 0;
  const maxMs = Number.isFinite(range.maxMs) ? Math.max(0, Math.floor(range.maxMs)) : 0;
  return {
    minMs: Math.min(minMs, maxMs),
    maxMs: Math.max(minMs, maxMs)
  };
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 1831565813;
    let x = Math.imul(t ^ t >>> 15, 1 | t);
    x ^= x + Math.imul(x ^ x >>> 7, 61 | x);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
function hashStringToUint32(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function getGlobalCounters() {
  const g = globalThis;
  if (!g[COUNTERS_KEY]) {
    g[COUNTERS_KEY] = /* @__PURE__ */ Object.create(null);
  }
  return g[COUNTERS_KEY];
}
function parseQueryParams() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const profileRaw = params.get("realtestingTiming") ?? params.get("realtesting-timing");
    const seedRaw = params.get("realtestingSeed") ?? params.get("realtesting-seed");
    const randomRaw = params.get("realtestingRandom") ?? params.get("realtesting-random");
    const scaleRaw = params.get("realtestingTimingScale") ?? params.get("realtesting-timing-scale");
    const profile = profileRaw === "ci" || profileRaw === "ciRealistic" ? "ciRealistic" : profileRaw === "real" || profileRaw === "realistic" ? "realistic" : profileRaw === "off" ? "off" : void 0;
    const seed = seedRaw && /^\d+$/.test(seedRaw) ? Number(seedRaw) : seedRaw ?? void 0;
    const randomMode = randomRaw === "true" || randomRaw === "1" || randomRaw === "random" || randomRaw === "true-random" ? "true-random" : randomRaw === "seeded" || randomRaw === "0" || randomRaw === "false" ? "seeded" : void 0;
    const scale = scaleRaw && !Number.isNaN(Number(scaleRaw)) ? Number(scaleRaw) : void 0;
    return {
      profile,
      seed,
      randomMode,
      scale
    };
  } catch {
    return {};
  }
}
function defaultRangesForProfile(profile) {
  if (profile === "realistic") {
    return {
      "websocket.connect": { minMs: 100, maxMs: 2e3 },
      "websocket.message": { minMs: 10, maxMs: 250 },
      "websocket.close": { minMs: 20, maxMs: 400 }
    };
  }
  if (profile === "ciRealistic") {
    return {
      "websocket.connect": { minMs: 30, maxMs: 600 },
      "websocket.message": { minMs: 3, maxMs: 60 },
      "websocket.close": { minMs: 5, maxMs: 80 }
    };
  }
  return {};
}
function resolveTimingConfig() {
  const fromWindow = typeof window !== "undefined" ? window.__REALTESTING_TIMING_CONFIG__ ?? {} : {};
  const fromQuery = parseQueryParams();
  const merged = {
    ...fromWindow,
    ...fromQuery,
    ranges: {
      ...fromWindow.ranges ?? {},
      ...fromQuery.ranges ?? {}
    }
  };
  const profile = merged.profile ?? "off";
  const enabled = merged.enabled !== false && profile !== "off";
  const randomMode = merged.randomMode ?? "seeded";
  const seed = merged.seed ?? 1;
  const scale = typeof merged.scale === "number" && Number.isFinite(merged.scale) ? merged.scale : 1;
  const ranges = {
    ...defaultRangesForProfile(profile)
  };
  for (const [kind, range] of Object.entries(merged.ranges ?? {})) {
    ranges[kind] = clampRange(range);
  }
  return { profile, enabled, randomMode, seed, scale, ranges };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getRealTestingTiming(_namespace) {
  const config = resolveTimingConfig();
  const sample = (kind, fallback) => {
    if (!config.enabled) {
      return 0;
    }
    const range = config.ranges[kind] ?? (fallback ? clampRange(fallback) : { minMs: 0, maxMs: 0 });
    const minMs = range.minMs;
    const maxMs = range.maxMs;
    if (maxMs <= 0) {
      return 0;
    }
    const counters = getGlobalCounters();
    const key = kind;
    const nextIndex = counters[key] = (counters[key] ?? 0) + 1;
    const seedNum = typeof config.seed === "number" ? config.seed >>> 0 : hashStringToUint32(String(config.seed));
    const salt = hashStringToUint32(key) ^ Math.imul(nextIndex, 2654435761);
    const t = config.randomMode === "true-random" ? Math.random() : mulberry32((seedNum ^ salt) >>> 0)();
    const sampled = minMs + Math.floor(t * (maxMs - minMs + 1));
    return Math.max(0, Math.round(sampled * config.scale));
  };
  return {
    enabled: config.enabled,
    profile: config.profile,
    sampleMs: sample,
    delay: async (kind, fallback) => {
      const ms = sample(kind, fallback);
      if (ms > 0) {
        await sleep(ms);
      }
      return ms;
    }
  };
}

// packages/websocket/src/core/VirtualWebSocket.ts
function safeEvent(name) {
  try {
    return new Event(name);
  } catch {
    return { type: name };
  }
}
function safeMessageEvent(data) {
  try {
    return new MessageEvent("message", { data });
  } catch {
    const event = new Event("message");
    event.data = data;
    return event;
  }
}
function safeCloseEvent(code, reason) {
  try {
    return new CloseEvent("close", { code, reason, wasClean: true });
  } catch {
    const event = new Event("close");
    event.code = code;
    event.reason = reason;
    event.wasClean = true;
    return event;
  }
}
function normalizeProtocols(protocols) {
  if (!protocols) {
    return [];
  }
  if (Array.isArray(protocols)) {
    return protocols.map(String);
  }
  return [String(protocols)];
}
var VirtualWebSocket = class _VirtualWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  CONNECTING = _VirtualWebSocket.CONNECTING;
  OPEN = _VirtualWebSocket.OPEN;
  CLOSING = _VirtualWebSocket.CLOSING;
  CLOSED = _VirtualWebSocket.CLOSED;
  url;
  protocol = "";
  extensions = "";
  binaryType = "blob";
  bufferedAmount = 0;
  readyState = _VirtualWebSocket.CONNECTING;
  onopen = null;
  onmessage = null;
  onerror = null;
  onclose = null;
  registry;
  protocols;
  serverId = null;
  serverConfig = null;
  serverClient = null;
  closed = false;
  connectTimer;
  closeTimer;
  constructor(url, protocols, registry) {
    super();
    this.url = String(url);
    this.protocols = normalizeProtocols(protocols);
    this.registry = registry;
    const timing = getRealTestingTiming("websocket");
    const connectDelayMs = timing.enabled ? timing.sampleMs("websocket.connect") : 0;
    const resolved = this.registry.resolveServer(this.url);
    if (!resolved) {
      this.connectTimer = window.setTimeout(
        () => this.failConnection(),
        Math.max(0, connectDelayMs)
      );
      return;
    }
    this.serverId = resolved.id;
    this.serverConfig = resolved.config;
    this.serverClient = {
      url: this.url,
      protocols: this.protocols,
      push: (data) => this.receiveFromServer(data),
      close: (code, reason) => this.serverClose(code, reason)
    };
    this.registry.attachClient(this.serverId, this.serverClient);
    this.connectTimer = window.setTimeout(
      () => this.open(),
      Math.max(0, connectDelayMs)
    );
  }
  send(data) {
    if (this.readyState !== _VirtualWebSocket.OPEN || this.closed) {
      throw new DOMException("WebSocket is not open.", "InvalidStateError");
    }
    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.message") : 0;
    window.setTimeout(() => {
      if (this.closed || this.readyState !== _VirtualWebSocket.OPEN) {
        return;
      }
      this.serverConfig?.onMessage?.(this.serverClient, data);
    }, Math.max(0, delayMs));
  }
  close(code = 1e3, reason = "") {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = _VirtualWebSocket.CLOSING;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = void 0;
    }
    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.close") : 0;
    this.closeTimer = window.setTimeout(() => {
      if (this.readyState === _VirtualWebSocket.CLOSED) {
        return;
      }
      try {
        this.serverConfig?.onClose?.(this.serverClient, code, reason);
      } catch {
      }
      this.detachFromRegistry();
      this.readyState = _VirtualWebSocket.CLOSED;
      const event = safeCloseEvent(code, reason);
      this.dispatchEvent(event);
      this.onclose?.(event);
    }, Math.max(0, delayMs));
  }
  open() {
    if (this.closed || this.readyState !== _VirtualWebSocket.CONNECTING) {
      return;
    }
    this.readyState = _VirtualWebSocket.OPEN;
    const event = safeEvent("open");
    this.dispatchEvent(event);
    this.onopen?.(event);
    try {
      this.serverConfig?.onConnect?.(this.serverClient);
    } catch {
    }
  }
  receiveFromServer(data) {
    if (this.closed || this.readyState !== _VirtualWebSocket.OPEN) {
      return;
    }
    const timing = getRealTestingTiming("websocket");
    const delayMs = timing.enabled ? timing.sampleMs("websocket.message") : 0;
    window.setTimeout(() => {
      if (this.closed || this.readyState !== _VirtualWebSocket.OPEN) {
        return;
      }
      const event = safeMessageEvent(data);
      this.dispatchEvent(event);
      this.onmessage?.(event);
    }, Math.max(0, delayMs));
  }
  serverClose(code = 1e3, reason = "") {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = void 0;
    }
    this.detachFromRegistry();
    this.readyState = _VirtualWebSocket.CLOSED;
    const event = safeCloseEvent(code, reason);
    this.dispatchEvent(event);
    this.onclose?.(event);
  }
  failConnection() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.readyState = _VirtualWebSocket.CLOSED;
    const errorEvent = safeEvent("error");
    this.dispatchEvent(errorEvent);
    this.onerror?.(errorEvent);
    const closeEvent = safeCloseEvent(1006, "Virtual WebSocket server not found");
    this.dispatchEvent(closeEvent);
    this.onclose?.(closeEvent);
  }
  detachFromRegistry() {
    if (!this.serverId || !this.serverClient) {
      return;
    }
    this.registry.detachClient(this.serverId, this.serverClient);
  }
};

// packages/websocket/src/core/VirtualWebSocketServerRegistry.ts
function generateServerId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `ws-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}
var VirtualWebSocketServerRegistry = class {
  servers = /* @__PURE__ */ new Map();
  createServer(config) {
    const id = generateServerId();
    const label = config.label ?? "Virtual WebSocket Server";
    const server = {
      id,
      label,
      match: config.match,
      config,
      clients: /* @__PURE__ */ new Set()
    };
    this.servers.set(id, server);
    return id;
  }
  removeServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    for (const client of Array.from(server.clients)) {
      try {
        client.close(1001, "Server removed");
      } catch {
      }
    }
    this.servers.delete(serverId);
  }
  clearServers() {
    for (const id of Array.from(this.servers.keys())) {
      this.removeServer(id);
    }
  }
  listServers() {
    return Array.from(this.servers.values()).map((server) => ({
      id: server.id,
      label: server.label,
      match: typeof server.match === "string" ? server.match : server.match.toString(),
      clientCount: server.clients.size
    }));
  }
  resolveServer(url) {
    const server = this.findServer(url);
    if (!server) {
      return null;
    }
    return { id: server.id, config: server.config };
  }
  findServer(url) {
    for (const server of this.servers.values()) {
      if (typeof server.match === "string") {
        if (server.match === url) {
          return server;
        }
        continue;
      }
      try {
        if (server.match.test(url)) {
          return server;
        }
      } catch {
      }
    }
    return null;
  }
  attachClient(serverId, client) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    server.clients.add(client);
  }
  detachClient(serverId, client) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    server.clients.delete(client);
  }
  closeAllClients() {
    for (const server of this.servers.values()) {
      for (const client of Array.from(server.clients)) {
        try {
          client.close(1001, "Closed by RealTesting");
        } catch {
        }
      }
    }
  }
};

// packages/websocket/src/core/WebSocketProxy.ts
function resolveDecision(params) {
  const { mode, blockNative, hasNative, hasVirtualServer } = params;
  switch (mode) {
    case "virtual":
      return "virtual";
    case "native":
      return blockNative || !hasNative ? "blocked" : "native";
    case "prefer-virtual":
      if (hasVirtualServer) {
        return "virtual";
      }
      return blockNative || !hasNative ? "blocked" : "native";
    case "prefer-native":
    default:
      if (!blockNative && hasNative) {
        return "native";
      }
      return hasVirtualServer ? "virtual" : "blocked";
  }
}
function createWebSocketProxy(params) {
  const Native = params.nativeCtor;
  const registry = params.registry;
  const blockedRegistry = new VirtualWebSocketServerRegistry();
  const Proxy = class WebSocketProxy {
    constructor(url, protocols) {
      const urlStr = typeof url === "string" ? url : url.toString();
      const mode = params.getMode();
      const blockNative = params.getBlockNative();
      const hasNative = typeof Native === "function";
      const hasVirtualServer = registry.resolveServer(urlStr) !== null;
      const decision = resolveDecision({ mode, blockNative, hasNative, hasVirtualServer });
      if (decision === "native") {
        return new Native(url, protocols);
      }
      if (decision === "blocked") {
        return new VirtualWebSocket(urlStr, protocols, blockedRegistry);
      }
      return new VirtualWebSocket(urlStr, protocols, registry);
    }
  };
  const constantsSource = Native ?? VirtualWebSocket;
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    try {
      Proxy[key] = constantsSource[key];
    } catch {
    }
  }
  if (Native) {
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key in Proxy) {
        continue;
      }
      try {
        Proxy[key] = Native[key];
      } catch {
      }
    }
  }
  return Proxy;
}

// packages/websocket/src/core/RealWebSocketCore.ts
var DEFAULT_OPTIONS = {
  socketMode: "prefer-native",
  blockNativeWebSocket: false
};
var DEFAULT_TEST_API_PROPERTY = "__realtestingWebSocketTestApi";
function getTestWindow() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}
function resolveTestSetup(options) {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_WEBSOCKET_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled = params?.has("realtestingTest") || params?.has("realtesting-test") || testWindow?.__REALTESTING_TEST__ === true || config?.enabled === true;
  const apiOptions = options.testApi;
  const enableApi = apiOptions?.enabled === true || apiOptions?.autoEnable !== false && autoEnabled;
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY
  };
}
var RealWebSocketCore = class {
  installed = false;
  originalCtor = null;
  registry = new VirtualWebSocketServerRegistry();
  installOptions = { ...DEFAULT_OPTIONS };
  options = { ...DEFAULT_OPTIONS };
  testConfig = null;
  testApi = null;
  testApiProperty = null;
  isInstalled() {
    return this.installed;
  }
  install(options = {}) {
    this.installOptions = { ...DEFAULT_OPTIONS, ...options };
    this.options = { ...this.installOptions };
    const testSetup = resolveTestSetup(options);
    if (testSetup.config) {
      this.applyTestConfig(testSetup.config);
    }
    this.attachTestApi(testSetup.enableApi, testSetup.windowProperty);
    const testWindow = getTestWindow();
    if (!testWindow) {
      return;
    }
    if (!this.originalCtor) {
      this.originalCtor = testWindow.WebSocket ?? null;
    }
    testWindow.WebSocket = createWebSocketProxy({
      nativeCtor: this.originalCtor,
      registry: this.registry,
      getMode: () => this.options.socketMode,
      getBlockNative: () => this.options.blockNativeWebSocket
    });
    this.installed = true;
  }
  uninstall() {
    const testWindow = getTestWindow();
    if (testWindow && this.originalCtor) {
      testWindow.WebSocket = this.originalCtor;
    }
    this.detachTestApi();
    this.installed = false;
  }
  setSocketMode(mode) {
    this.options = { ...this.options, socketMode: mode };
  }
  getSocketMode() {
    return this.options.socketMode;
  }
  setBlockNativeWebSocket(block) {
    this.options = { ...this.options, blockNativeWebSocket: block };
  }
  getBlockNativeWebSocket() {
    return this.options.blockNativeWebSocket;
  }
  createVirtualServer(config) {
    return this.registry.createServer(config);
  }
  createEchoServer(match) {
    return this.createVirtualServer({
      match,
      label: "Echo Server",
      onMessage: (client, data) => {
        client.push(data);
      }
    });
  }
  clearVirtualServers() {
    this.registry.clearServers();
  }
  closeAllClients() {
    this.registry.closeAllClients();
  }
  listVirtualServers() {
    return this.registry.listServers();
  }
  getTestApi() {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => this.getState(),
      setSocketMode: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, socketMode: mode });
      },
      setBlockNativeWebSocket: (block) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, blockNativeWebSocket: block });
      },
      createEchoServer: (match) => this.createEchoServer(match),
      clearServers: () => this.clearVirtualServers(),
      closeAllClients: () => this.closeAllClients()
    };
    return this.testApi;
  }
  getState() {
    return {
      config: this.testConfig,
      socketMode: this.options.socketMode,
      blockNativeWebSocket: this.options.blockNativeWebSocket,
      servers: this.registry.listServers()
    };
  }
  applyTestConfig(config) {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };
    if (config.socketMode) {
      this.options = { ...this.options, socketMode: config.socketMode };
    }
    if (typeof config.blockNativeWebSocket === "boolean") {
      this.options = { ...this.options, blockNativeWebSocket: config.blockNativeWebSocket };
    }
  }
  resetTestConfig() {
    this.testConfig = null;
    this.options = { ...this.installOptions };
  }
  attachTestApi(enabled, windowProperty) {
    const testWindow = getTestWindow();
    if (!testWindow) {
      return;
    }
    if (!enabled) {
      this.detachTestApi();
      return;
    }
    this.testApiProperty = windowProperty;
    testWindow[windowProperty] = this.getTestApi();
  }
  detachTestApi() {
    const testWindow = getTestWindow();
    if (!testWindow || !this.testApiProperty) {
      return;
    }
    try {
      delete testWindow[this.testApiProperty];
    } catch {
      testWindow[this.testApiProperty] = void 0;
    }
  }
};

// packages/websocket/src/index.ts
var RealWebSocket = new RealWebSocketCore();
export {
  RealWebSocket
};
