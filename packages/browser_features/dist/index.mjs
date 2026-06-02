// packages/browser_features/src/utils/patch.ts
function patchValue(target, key, value) {
  const hasOwn = Object.prototype.hasOwnProperty.call(target, key);
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: originalDescriptor?.enumerable ?? true
  });
  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(target, key, originalDescriptor);
      } else if (hasOwn) {
        delete target[key];
      } else {
        delete target[key];
      }
    } catch {
    }
  };
}
function patchGetter(target, key, getter) {
  const hasOwn = Object.prototype.hasOwnProperty.call(target, key);
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    get: getter,
    configurable: true,
    enumerable: originalDescriptor?.enumerable ?? true
  });
  return () => {
    try {
      if (originalDescriptor) {
        Object.defineProperty(target, key, originalDescriptor);
      } else if (!hasOwn) {
        delete target[key];
      }
    } catch {
    }
  };
}

// packages/browser_features/src/utils/realtestingTiming.ts
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
      "features.userAction": { minMs: 20, maxMs: 600 }
    };
  }
  if (profile === "ciRealistic") {
    return {
      "features.userAction": { minMs: 5, maxMs: 120 }
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

// packages/browser_features/src/core/ClipboardProxy.ts
function notAllowedError(message) {
  return typeof DOMException !== "undefined" ? new DOMException(message, "NotAllowedError") : Object.assign(new Error(message), { name: "NotAllowedError" });
}
var ClipboardProxy = class {
  installed = false;
  text = "";
  gestureHooks = {
    isRequired: () => false,
    consume: () => true
  };
  restoreNavigatorClipboard = null;
  restoreExecCommand = null;
  originalExecCommand;
  setGestureHooks(hooks) {
    this.gestureHooks = hooks;
  }
  install(initialText) {
    if (this.installed) {
      if (typeof initialText === "string") {
        this.text = initialText;
      }
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("RealTesting: window/document are not available.");
    }
    if (typeof initialText === "string") {
      this.text = initialText;
    }
    const clipboard = {
      writeText: async (value) => {
        if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
          throw notAllowedError("Clipboard writeText requires a user gesture.");
        }
        const timing = getRealTestingTiming("browser-features");
        if (timing.enabled) {
          await timing.delay("features.userAction");
        }
        this.text = String(value);
      },
      readText: async () => this.text
    };
    clipboard.readText = async () => {
      if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
        throw notAllowedError("Clipboard readText requires a user gesture.");
      }
      const timing = getRealTestingTiming("browser-features");
      if (timing.enabled) {
        await timing.delay("features.userAction");
      }
      return this.text;
    };
    try {
      this.restoreNavigatorClipboard = patchValue(navigator, "clipboard", clipboard);
    } catch {
      this.restoreNavigatorClipboard = null;
    }
    this.originalExecCommand = document.execCommand ? document.execCommand.bind(document) : void 0;
    try {
      this.restoreExecCommand = patchValue(document, "execCommand", this.execCommandProxy.bind(this));
    } catch {
      this.restoreExecCommand = null;
    }
    this.installed = true;
  }
  uninstall() {
    if (!this.installed) {
      return;
    }
    this.restoreNavigatorClipboard?.();
    this.restoreNavigatorClipboard = null;
    this.restoreExecCommand?.();
    this.restoreExecCommand = null;
    this.installed = false;
  }
  setText(text) {
    this.text = String(text);
  }
  getText() {
    return this.text;
  }
  execCommandProxy(commandId, showUI, value) {
    if (String(commandId).toLowerCase() === "copy") {
      if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
        return false;
      }
      const active = document.activeElement;
      if (active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        const start = active.selectionStart ?? 0;
        const end = active.selectionEnd ?? active.value.length;
        const selection = active.value.slice(start, end);
        this.text = selection.length > 0 ? selection : active.value;
        return true;
      }
      return true;
    }
    if (this.originalExecCommand) {
      return this.originalExecCommand(commandId, showUI, value);
    }
    return false;
  }
};

// packages/browser_features/src/core/FullscreenProxy.ts
function notAllowedError2(message) {
  return typeof DOMException !== "undefined" ? new DOMException(message, "NotAllowedError") : Object.assign(new Error(message), { name: "NotAllowedError" });
}
var FullscreenProxy = class {
  installed = false;
  state = { element: null };
  gestureHooks = {
    isRequired: () => false,
    consume: () => true
  };
  restores = [];
  setGestureHooks(hooks) {
    this.gestureHooks = hooks;
  }
  install() {
    if (this.installed) {
      return;
    }
    if (typeof document === "undefined" || typeof window === "undefined") {
      throw new Error("RealTesting: window/document are not available.");
    }
    const self = this;
    const request = function() {
      return self.requestFullscreenForElement(this);
    };
    this.patchElementMethod("requestFullscreen", request);
    this.patchElementMethod("requestFullScreen", request);
    this.patchElementMethod("webkitRequestFullscreen", request);
    this.patchElementMethod("webkitRequestFullScreen", request);
    this.patchElementMethod("mozRequestFullScreen", request);
    this.patchElementMethod("msRequestFullscreen", request);
    const exit = function() {
      void this;
      return self.exitFullscreen();
    };
    this.patchDocumentMethod("exitFullscreen", exit);
    this.patchDocumentMethod("webkitExitFullscreen", exit);
    this.patchDocumentMethod("mozCancelFullScreen", exit);
    this.patchDocumentMethod("msExitFullscreen", exit);
    this.patchDocumentGetter("fullscreenElement", () => this.state.element);
    this.patchDocumentGetter("webkitFullscreenElement", () => this.state.element);
    this.patchDocumentGetter("mozFullScreenElement", () => this.state.element);
    this.patchDocumentGetter("msFullscreenElement", () => this.state.element);
    this.patchDocumentGetter("fullscreenEnabled", () => true);
    this.patchDocumentGetter("webkitFullscreenEnabled", () => true);
    this.installed = true;
  }
  uninstall() {
    if (!this.installed) {
      return;
    }
    this.state.element = null;
    this.restores.forEach((restore) => restore());
    this.restores = [];
    this.installed = false;
  }
  isFullscreenActive() {
    return Boolean(this.state.element);
  }
  patchElementMethod(key, fn) {
    try {
      const restore = patchValue(Element.prototype, key, fn);
      this.restores.push(restore);
    } catch {
    }
  }
  patchDocumentMethod(key, fn) {
    try {
      const restore = patchValue(Document.prototype, key, fn);
      this.restores.push(restore);
    } catch {
    }
  }
  patchDocumentGetter(key, getter) {
    try {
      const restore = patchGetter(Document.prototype, key, getter);
      this.restores.push(restore);
    } catch {
    }
  }
  async requestFullscreenForElement(element) {
    if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
      throw notAllowedError2("Fullscreen requires a user gesture.");
    }
    const timing = getRealTestingTiming("browser-features");
    if (timing.enabled) {
      await timing.delay("features.userAction");
    }
    this.state.element = element;
    try {
      document.dispatchEvent(new Event("fullscreenchange"));
    } catch {
    }
  }
  async exitFullscreen() {
    const timing = getRealTestingTiming("browser-features");
    if (timing.enabled) {
      await timing.delay("features.userAction");
    }
    this.state.element = null;
    try {
      document.dispatchEvent(new Event("fullscreenchange"));
    } catch {
    }
  }
};

// packages/browser_features/src/core/VirtualPopup.ts
var VirtualPopup = class {
  id;
  state;
  handle;
  opener;
  constructor(args) {
    this.id = args.id;
    this.opener = args.opener;
    this.state = {
      id: args.id,
      url: args.url,
      target: args.target,
      closed: false
    };
    const popup = {
      closed: false,
      location: { href: args.url },
      opener: this.opener,
      focus: () => void 0,
      blur: () => void 0,
      close: () => this.close(),
      postMessage: (message, targetOrigin) => {
        try {
          const event = new MessageEvent("message", {
            data: message,
            origin: typeof targetOrigin === "string" ? targetOrigin : this.opener.location.origin,
            source: popup
          });
          this.opener.dispatchEvent(event);
        } catch {
        }
      },
      addEventListener: () => void 0,
      removeEventListener: () => void 0
    };
    popup.__realtesting_virtual_popup_id__ = args.id;
    this.handle = popup;
  }
  close() {
    if (this.state.closed) {
      return;
    }
    this.state.closed = true;
    try {
      this.handle.closed = true;
    } catch {
    }
  }
};

// packages/browser_features/src/core/WindowOpenProxy.ts
var WindowOpenProxy = class {
  installed = false;
  popupMode = "prefer-native";
  originalOpen;
  restoreOpen = null;
  nextId = 1;
  virtualPopups = /* @__PURE__ */ new Map();
  gestureHooks = {
    isRequired: () => false,
    consume: () => true
  };
  setGestureHooks(hooks) {
    this.gestureHooks = hooks;
  }
  install(initialMode) {
    if (this.installed) {
      this.popupMode = initialMode;
      return;
    }
    if (typeof window === "undefined") {
      throw new Error("RealTesting: window is not available.");
    }
    this.popupMode = initialMode;
    this.originalOpen = window.open ? window.open.bind(window) : void 0;
    try {
      this.restoreOpen = patchValue(window, "open", this.openProxy.bind(this));
    } catch {
      const original = window.open;
      window.open = this.openProxy.bind(this);
      this.restoreOpen = () => {
        try {
          window.open = original;
        } catch {
        }
      };
    }
    this.installed = true;
  }
  uninstall() {
    if (!this.installed) {
      return;
    }
    this.restoreOpen?.();
    this.restoreOpen = null;
    this.installed = false;
    this.virtualPopups.clear();
  }
  setPopupMode(mode) {
    this.popupMode = mode;
  }
  getPopupMode() {
    return this.popupMode;
  }
  listVirtualPopups() {
    return Array.from(this.virtualPopups.values()).map((p) => ({ ...p.state }));
  }
  closeAllVirtualPopups() {
    this.virtualPopups.forEach((p) => p.close());
    this.virtualPopups.clear();
  }
  openProxy(url, target, features) {
    const mode = this.popupMode;
    const resolvedUrl = typeof url === "string" ? url : url?.toString() ?? "about:blank";
    if (this.gestureHooks.isRequired() && !this.gestureHooks.consume()) {
      return null;
    }
    if (mode === "block") {
      return null;
    }
    if (mode === "native") {
      return this.originalOpen ? this.originalOpen(resolvedUrl, target, features) : null;
    }
    if (mode === "virtual") {
      return this.createVirtualPopup(resolvedUrl, target).handle;
    }
    if (mode === "prefer-virtual") {
      return this.createVirtualPopup(resolvedUrl, target).handle;
    }
    const native = this.originalOpen ? this.originalOpen(resolvedUrl, target, features) : null;
    if (native) {
      return native;
    }
    return this.createVirtualPopup(resolvedUrl, target).handle;
  }
  createVirtualPopup(url, target) {
    const id = `realtesting-popup-${this.nextId++}`;
    const popup = new VirtualPopup({ id, url, target, opener: window });
    this.virtualPopups.set(id, popup);
    return popup;
  }
};

// packages/browser_features/src/core/RealBrowserFeaturesCore.ts
var DEFAULT_TEST_API_PROPERTY = "__realtestingBrowserTestApi";
var DEFAULT_OPTIONS = {
  enableFullscreen: true,
  enablePopups: true,
  enableClipboard: true,
  popupMode: "prefer-native"
};
function getTestWindow() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}
function resolveTestSetup(options) {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_BROWSER_TEST_CONFIG__ ?? null;
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
var RealBrowserFeaturesCore = class {
  installed = false;
  installOptions = { ...DEFAULT_OPTIONS };
  options = { ...DEFAULT_OPTIONS };
  fullscreen = new FullscreenProxy();
  popups = new WindowOpenProxy();
  clipboard = new ClipboardProxy();
  requireUserGesture = false;
  gestureTokens = 0;
  gestureUnsubscribers = [];
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
    this.installGestureListeners();
    this.refreshGestureHooks();
    if (this.options.enableFullscreen) {
      this.fullscreen.install();
    }
    if (this.options.enablePopups) {
      this.popups.install(this.options.popupMode);
    }
    if (this.options.enableClipboard) {
      this.clipboard.install(this.testConfig?.clipboardText);
    }
    this.installed = true;
  }
  uninstall() {
    if (!this.installed) {
      return;
    }
    this.detachTestApi();
    this.uninstallGestureListeners();
    this.fullscreen.uninstall();
    this.popups.uninstall();
    this.clipboard.uninstall();
    this.installed = false;
  }
  setPopupMode(mode) {
    this.options = { ...this.options, popupMode: mode };
    this.popups.setPopupMode(mode);
  }
  getPopupMode() {
    return this.options.popupMode;
  }
  listVirtualPopups() {
    return this.popups.listVirtualPopups();
  }
  closeAllPopups() {
    this.popups.closeAllVirtualPopups();
  }
  setClipboardText(text) {
    this.clipboard.setText(text);
  }
  getClipboardText() {
    return this.clipboard.getText();
  }
  isFullscreenActive() {
    return this.fullscreen.isFullscreenActive();
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
      setPopupMode: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, popupMode: mode });
      },
      setClipboardText: (text) => {
        this.clipboard.setText(text);
      },
      setRequireUserGesture: (required) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, requireUserGesture: required });
      },
      provideUserGesture: (count) => {
        this.provideUserGesture(typeof count === "number" ? count : 1);
      },
      resetUserGestures: () => {
        this.gestureTokens = 0;
      },
      closeAllPopups: () => {
        this.closeAllPopups();
      }
    };
    return this.testApi;
  }
  getState() {
    return {
      config: this.testConfig,
      popupMode: this.options.popupMode,
      clipboardText: this.clipboard.getText(),
      fullscreenActive: this.fullscreen.isFullscreenActive(),
      virtualPopups: this.popups.listVirtualPopups(),
      requireUserGesture: this.requireUserGesture,
      gestureTokens: this.gestureTokens
    };
  }
  applyTestConfig(config) {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };
    if (config.popupMode) {
      this.options = { ...this.options, popupMode: config.popupMode };
    }
    if (typeof config.clipboardText === "string") {
      this.clipboard.setText(config.clipboardText);
    }
    this.requireUserGesture = config.requireUserGesture === true;
    this.popups.setPopupMode(this.options.popupMode);
    this.refreshGestureHooks();
  }
  resetTestConfig() {
    this.testConfig = null;
    this.options = { ...this.installOptions };
    this.popups.setPopupMode(this.options.popupMode);
    this.requireUserGesture = false;
    this.gestureTokens = 0;
    this.refreshGestureHooks();
  }
  refreshGestureHooks() {
    const hooks = {
      isRequired: () => this.requireUserGesture,
      consume: () => this.consumeUserGesture()
    };
    this.fullscreen.setGestureHooks(hooks);
    this.popups.setGestureHooks(hooks);
    this.clipboard.setGestureHooks(hooks);
  }
  consumeUserGesture() {
    if (!this.requireUserGesture) {
      return true;
    }
    if (this.gestureTokens <= 0) {
      return false;
    }
    this.gestureTokens = Math.max(0, this.gestureTokens - 1);
    return true;
  }
  provideUserGesture(count) {
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 1;
    if (n <= 0) {
      return;
    }
    this.gestureTokens = Math.min(50, this.gestureTokens + n);
  }
  installGestureListeners() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (this.gestureUnsubscribers.length > 0) {
      return;
    }
    const handler = () => this.provideUserGesture(1);
    const listen = (target, event) => {
      target.addEventListener(event, handler, { capture: true });
      return () => target.removeEventListener(event, handler, { capture: true });
    };
    this.gestureUnsubscribers.push(listen(window, "pointerdown"));
    this.gestureUnsubscribers.push(listen(window, "mousedown"));
    this.gestureUnsubscribers.push(listen(window, "keydown"));
    this.gestureUnsubscribers.push(listen(window, "touchstart"));
  }
  uninstallGestureListeners() {
    this.gestureUnsubscribers.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
    this.gestureUnsubscribers = [];
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

// packages/browser_features/src/index.ts
var RealBrowserFeatures = new RealBrowserFeaturesCore();
export {
  RealBrowserFeatures
};
