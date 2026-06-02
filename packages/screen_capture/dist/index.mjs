// packages/screen_capture/src/utils/constraints.ts
var DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS = {
  width: 1280,
  height: 720,
  frameRate: 30
};
function isFinitePositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function readConstrainNumberWithBounds(value, fallback) {
  if (isFinitePositiveNumber(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return fallback;
  }
  let candidate = fallback;
  if (isFinitePositiveNumber(value.exact)) {
    candidate = value.exact;
  } else if (isFinitePositiveNumber(value.ideal)) {
    candidate = value.ideal;
  }
  if (isFinitePositiveNumber(value.min) && candidate < value.min) {
    candidate = value.min;
  }
  if (isFinitePositiveNumber(value.max) && candidate > value.max) {
    candidate = value.max;
  }
  return candidate;
}
function clampToInt(value, min, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < min) {
    return fallback;
  }
  return rounded;
}
function mergeResolvedDisplayConstraints(current, update) {
  const nextWidth = clampToInt(
    update?.width ?? current.width,
    1,
    current.width
  );
  const nextHeight = clampToInt(
    update?.height ?? current.height,
    1,
    current.height
  );
  const nextFrameRate = clampToInt(
    update?.frameRate ?? current.frameRate,
    1,
    current.frameRate
  );
  return { width: nextWidth, height: nextHeight, frameRate: nextFrameRate };
}
function resolveDisplayConstraints(constraints, defaults) {
  const resolvedDefaults = mergeResolvedDisplayConstraints(
    DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS,
    defaults
  );
  if (!constraints) {
    return resolvedDefaults;
  }
  const width = clampToInt(
    readConstrainNumberWithBounds(
      constraints.width,
      resolvedDefaults.width
    ),
    1,
    resolvedDefaults.width
  );
  const height = clampToInt(
    readConstrainNumberWithBounds(
      constraints.height,
      resolvedDefaults.height
    ),
    1,
    resolvedDefaults.height
  );
  const frameRate = clampToInt(
    readConstrainNumberWithBounds(
      constraints.frameRate,
      resolvedDefaults.frameRate
    ),
    1,
    resolvedDefaults.frameRate
  );
  return { width, height, frameRate };
}
function extractVideoTrackConstraints(constraints) {
  if (!constraints || !constraints.video) {
    return void 0;
  }
  if (typeof constraints.video === "boolean") {
    return void 0;
  }
  return constraints.video;
}
function isAudioRequested(constraints) {
  if (!constraints) {
    return false;
  }
  if (!("audio" in constraints)) {
    return false;
  }
  const audio = constraints.audio;
  if (audio === true) {
    return true;
  }
  if (audio && typeof audio === "object") {
    return true;
  }
  return false;
}

// packages/screen_capture/src/utils/errors.ts
function createDomError(name, message) {
  try {
    return new DOMException(message, name);
  } catch {
    const error = new Error(message);
    error.name = name;
    return error;
  }
}
function notAllowedError(message) {
  return createDomError("NotAllowedError", message);
}
function notFoundError(message) {
  return createDomError("NotFoundError", message);
}
function notSupportedError(message) {
  return createDomError("NotSupportedError", message);
}

// packages/screen_capture/src/core/VirtualDisplayRegistry.ts
var VirtualDisplayRegistry = class {
  nextId = 1;
  displays = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  onChange(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  addVirtualDisplay(config = {}) {
    const id = `realtesting-display-${this.nextId++}`;
    const label = config.label ?? `RealTesting Virtual Display ${id.split("-").pop()}`;
    const defaultConstraints = mergeResolvedDisplayConstraints(DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS, config.defaultConstraints);
    const display = {
      id,
      label,
      enabled: true,
      defaultConstraints
    };
    this.displays.set(id, display);
    this.emit();
    return id;
  }
  removeVirtualDisplay(id) {
    this.displays.delete(id);
    this.emit();
  }
  getVirtualDisplay(id) {
    return this.displays.get(id);
  }
  listVirtualDisplays() {
    return Array.from(this.displays.values()).map(({ source: _source, ...rest }) => rest);
  }
  listVirtualDisplayInternals() {
    return Array.from(this.displays.values());
  }
  getFirstEnabledVirtualDisplay() {
    for (const display of this.displays.values()) {
      if (display.enabled) {
        return display;
      }
    }
    return void 0;
  }
  updateVirtualDisplay(id, update) {
    const existing = this.displays.get(id);
    if (!existing) {
      throw notFoundError(`RealTesting: Virtual display not found: ${id}`);
    }
    const nextDefault = update.defaultConstraints ? mergeResolvedDisplayConstraints(existing.defaultConstraints, update.defaultConstraints) : existing.defaultConstraints;
    const next = {
      ...existing,
      enabled: typeof update.enabled === "boolean" ? update.enabled : existing.enabled,
      label: update.label ?? existing.label,
      defaultConstraints: nextDefault
    };
    this.displays.set(id, next);
    this.emit();
  }
  setVirtualEnabled(id, enabled) {
    this.updateVirtualDisplay(id, { enabled });
  }
  setVirtualSource(id, source) {
    const existing = this.displays.get(id);
    if (!existing) {
      throw notFoundError(`RealTesting: Virtual display not found: ${id}`);
    }
    this.displays.set(id, { ...existing, source });
    this.emit();
  }
  emit() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
      }
    });
  }
};

// packages/screen_capture/src/utils/realtestingTiming.ts
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
      "display.permission.promptOpen": { minMs: 150, maxMs: 900 },
      "display.permission.userAction": { minMs: 300, maxMs: 4e3 },
      "display.getDisplayMedia.streamStart": { minMs: 150, maxMs: 1200 },
      "display.enumerate": { minMs: 30, maxMs: 250 }
    };
  }
  if (profile === "ciRealistic") {
    return {
      "display.permission.promptOpen": { minMs: 50, maxMs: 350 },
      "display.permission.userAction": { minMs: 100, maxMs: 1200 },
      "display.getDisplayMedia.streamStart": { minMs: 50, maxMs: 450 },
      "display.enumerate": { minMs: 10, maxMs: 120 }
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

// packages/screen_capture/src/core/VirtualDisplayStream.ts
function drawSource(ctx, info, source) {
  switch (source.type) {
    case "canvas":
    case "video":
    case "image":
      try {
        ctx.drawImage(source.element, 0, 0, info.width, info.height);
      } catch {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, info.width, info.height);
      }
      if ("text" in source && source.text) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "22px sans-serif";
        ctx.fillText(source.text, 24, 48);
      }
      return;
    case "callback":
      try {
        const result = source.draw(ctx, info);
        if (result instanceof Promise) {
          result.catch(() => void 0);
        }
      } catch {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, info.width, info.height);
      }
      return;
    case "color":
      ctx.fillStyle = source.color;
      ctx.fillRect(0, 0, info.width, info.height);
      if (source.text) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "22px sans-serif";
        ctx.fillText(source.text, 24, 48);
      }
      return;
    case "pattern": {
      const gradient = ctx.createLinearGradient(0, 0, info.width, info.height);
      gradient.addColorStop(0, "#22d3ee");
      gradient.addColorStop(1, "#a855f7");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, info.width, info.height);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "22px sans-serif";
      ctx.fillText(source.text ?? "RealTesting Pattern", 24, 48);
      ctx.fillText(`Frame ${info.frameIndex}`, 24, 78);
      return;
    }
    case "blank":
    default:
      ctx.fillStyle = source.color ?? "#0f172a";
      ctx.fillRect(0, 0, info.width, info.height);
      if (source.text) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "22px sans-serif";
        ctx.fillText(source.text, 24, 48);
      }
  }
}
function buildDefaultSource() {
  return { type: "pattern", text: "RealTesting" };
}
function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
function tryCreateSilentAudioTrack() {
  try {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => void 0);
    }
    const track = destination.stream.getAudioTracks()[0];
    if (!track) {
      oscillator.stop();
      audioContext.close().catch(() => void 0);
      return null;
    }
    return { track, resources: { audioContext, oscillator, gain, destination } };
  } catch {
    return null;
  }
}
var VirtualDisplayStream = class {
  stream;
  videoTrack;
  audioTrack;
  canvas;
  ctx;
  source;
  timerId = null;
  stopped = false;
  frameIndex = 0;
  audioResources = null;
  onFrame;
  constructor(options) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = options.width;
    this.canvas.height = options.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("RealTesting: Could not create 2D canvas context.");
    }
    this.ctx = ctx;
    this.source = options.source ?? buildDefaultSource();
    this.onFrame = options.onFrame;
    const baseStream = this.canvas.captureStream(options.frameRate);
    const videoTrack = baseStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error("RealTesting: canvas.captureStream did not produce a video track.");
    }
    this.videoTrack = videoTrack;
    this.stream = new MediaStream([videoTrack]);
    if (options.audioRequested) {
      const audio = tryCreateSilentAudioTrack();
      if (audio) {
        this.audioResources = audio.resources;
        this.audioTrack = audio.track;
        this.stream.addTrack(audio.track);
      }
    }
    const intervalMs = options.frameRate && options.frameRate > 0 ? Math.max(1, Math.round(1e3 / options.frameRate)) : 33;
    this.timerId = window.setInterval(() => this.drawTick(), intervalMs);
    this.videoTrack.addEventListener("ended", () => {
      this.stop();
    });
    this.audioTrack?.addEventListener("ended", () => {
    });
  }
  updateSource(source) {
    this.source = source ?? buildDefaultSource();
  }
  stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
        }
      });
    } catch {
    }
    if (this.audioResources) {
      try {
        this.audioResources.oscillator.stop();
      } catch {
      }
      this.audioResources.audioContext.close().catch(() => void 0);
      this.audioResources = null;
    }
  }
  drawTick() {
    if (this.stopped) {
      return;
    }
    const timestamp = nowMs();
    const info = {
      width: this.canvas.width,
      height: this.canvas.height,
      frameIndex: this.frameIndex,
      timestamp
    };
    try {
      drawSource(this.ctx, info, this.source);
    } catch {
      this.ctx.fillStyle = "#0f172a";
      this.ctx.fillRect(0, 0, info.width, info.height);
    }
    this.onFrame?.({ frameIndex: this.frameIndex, timestamp });
    this.frameIndex += 1;
  }
};

// packages/screen_capture/src/core/MediaDevicesDisplayMediaProxy.ts
function decideCaptureImplementation(args) {
  const {
    captureMode,
    virtualAvailable,
    virtualAllowed,
    nativeAvailable,
    blockNativeDisplayMedia
  } = args;
  const virtualUsable = virtualAvailable && virtualAllowed;
  const nativeUsable = nativeAvailable && !blockNativeDisplayMedia;
  if (captureMode === "virtual") {
    if (!virtualAvailable) {
      return {
        implementation: "error",
        reason: "virtual-required-missing",
        error: notFoundError("RealTesting: No enabled virtual displays are available.")
      };
    }
    if (!virtualAllowed) {
      return {
        implementation: "error",
        reason: "virtual-permission-denied",
        error: notAllowedError("RealTesting: Virtual display permission denied.")
      };
    }
    return { implementation: "virtual", reason: "virtual-required" };
  }
  if (captureMode === "native") {
    if (!nativeAvailable) {
      return {
        implementation: "error",
        reason: "native-missing",
        error: notSupportedError("RealTesting: Native getDisplayMedia is not available.")
      };
    }
    if (blockNativeDisplayMedia) {
      return {
        implementation: "error",
        reason: "native-blocked",
        error: notAllowedError("RealTesting: Native getDisplayMedia is blocked.")
      };
    }
    return { implementation: "native", reason: "native-required" };
  }
  if (captureMode === "prefer-virtual") {
    if (virtualUsable) {
      return { implementation: "virtual", reason: "prefer-virtual-available" };
    }
    if (!nativeAvailable) {
      return {
        implementation: "error",
        reason: "native-missing",
        error: notSupportedError("RealTesting: Native getDisplayMedia is not available.")
      };
    }
    if (blockNativeDisplayMedia) {
      return {
        implementation: "error",
        reason: "native-blocked",
        error: notAllowedError("RealTesting: Native getDisplayMedia is blocked.")
      };
    }
    return { implementation: "native", reason: "prefer-virtual-fallback-native" };
  }
  if (nativeUsable) {
    return { implementation: "native", reason: "prefer-native-native" };
  }
  if (!nativeAvailable && virtualUsable) {
    return { implementation: "virtual", reason: "prefer-native-fallback-virtual-no-native" };
  }
  if (blockNativeDisplayMedia && virtualUsable) {
    return { implementation: "virtual", reason: "prefer-native-fallback-virtual-native-blocked" };
  }
  if (!nativeAvailable) {
    return {
      implementation: "error",
      reason: "native-missing",
      error: notSupportedError("RealTesting: Native getDisplayMedia is not available.")
    };
  }
  return {
    implementation: "error",
    reason: "native-blocked",
    error: notAllowedError("RealTesting: Native getDisplayMedia is blocked.")
  };
}
var MediaDevicesDisplayMediaProxy = class {
  registry;
  options;
  installed = false;
  mediaDevices;
  originalGetDisplayMedia;
  activeStreams = /* @__PURE__ */ new Map();
  onVirtualFrame;
  sourceOverride;
  constructor(registry, options) {
    this.registry = registry;
    this.options = options;
  }
  updateOptions(options) {
    this.options = options;
  }
  setOnVirtualFrame(callback) {
    this.onVirtualFrame = callback;
  }
  setSourceOverride(source) {
    this.sourceOverride = source;
    this.refreshSourcesForAllActiveStreams();
  }
  captureOriginals() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("RealTesting: navigator.mediaDevices is not available.");
    }
    this.mediaDevices = navigator.mediaDevices;
    if (!this.originalGetDisplayMedia) {
      const candidate = navigator.mediaDevices.getDisplayMedia;
      this.originalGetDisplayMedia = candidate ? candidate.bind(navigator.mediaDevices) : void 0;
    }
  }
  install() {
    if (this.installed) {
      return;
    }
    this.captureOriginals();
    navigator.mediaDevices.getDisplayMedia = this.getDisplayMediaProxy.bind(this);
    this.installed = true;
  }
  uninstall() {
    if (!this.installed || !this.mediaDevices) {
      return;
    }
    try {
      if (this.originalGetDisplayMedia) {
        this.mediaDevices.getDisplayMedia = this.originalGetDisplayMedia;
      } else {
        delete this.mediaDevices.getDisplayMedia;
      }
    } catch {
      this.mediaDevices.getDisplayMedia = this.originalGetDisplayMedia;
    }
    this.installed = false;
  }
  async getDisplayMedia(constraints) {
    if (!this.mediaDevices) {
      this.captureOriginals();
    }
    return this.getDisplayMediaProxy(constraints);
  }
  updateVirtualSource(displayId, source) {
    const streams = this.activeStreams.get(displayId);
    if (!streams) {
      return;
    }
    const effective = this.sourceOverride ?? source;
    streams.forEach((stream) => stream.updateSource(effective));
  }
  stopVirtualStreams(displayId) {
    if (displayId) {
      const streams = this.activeStreams.get(displayId);
      if (streams) {
        streams.forEach((stream) => stream.stop());
        this.activeStreams.delete(displayId);
      }
      return;
    }
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.stop());
    });
    this.activeStreams.clear();
  }
  async resolveVirtualPermission() {
    const mode = this.options.virtualPermission;
    if (mode === "allow") {
      return true;
    }
    if (mode === "deny") {
      return false;
    }
    const timing = getRealTestingTiming("screen-capture");
    if (timing.enabled) {
      await timing.delay("display.permission.promptOpen");
    }
    try {
      const result = await this.options.onVirtualPermissionRequest();
      return Boolean(result);
    } catch {
      return false;
    }
  }
  getEffectiveSource(displayId) {
    if (this.sourceOverride) {
      return this.sourceOverride;
    }
    return this.registry.getVirtualDisplay(displayId)?.source;
  }
  refreshSourcesForAllActiveStreams() {
    this.activeStreams.forEach((streams, displayId) => {
      const effective = this.getEffectiveSource(displayId);
      streams.forEach((stream) => stream.updateSource(effective));
    });
  }
  registerVirtualStream(displayId, stream) {
    const set = this.activeStreams.get(displayId) ?? /* @__PURE__ */ new Set();
    set.add(stream);
    this.activeStreams.set(displayId, set);
    stream.videoTrack.addEventListener("ended", () => {
      const current = this.activeStreams.get(displayId);
      if (!current) {
        return;
      }
      current.delete(stream);
      if (current.size === 0) {
        this.activeStreams.delete(displayId);
      }
    });
  }
  createVirtualStream(args) {
    const resolved = resolveDisplayConstraints(args.videoConstraints, args.defaults);
    const source = this.getEffectiveSource(args.displayId);
    const stream = new VirtualDisplayStream({
      width: resolved.width,
      height: resolved.height,
      frameRate: resolved.frameRate,
      audioRequested: args.audioRequested,
      source,
      onFrame: (info) => this.onVirtualFrame?.(args.displayId, info)
    });
    this.registerVirtualStream(args.displayId, stream);
    return stream.stream;
  }
  async getDisplayMediaProxy(constraints) {
    const enabledVirtual = this.registry.getFirstEnabledVirtualDisplay();
    const virtualAvailable = Boolean(enabledVirtual);
    const virtualAllowed = await this.resolveVirtualPermission();
    const nativeAvailable = Boolean(this.originalGetDisplayMedia);
    const decision = decideCaptureImplementation({
      captureMode: this.options.captureMode,
      virtualAvailable,
      virtualAllowed,
      nativeAvailable,
      blockNativeDisplayMedia: this.options.blockNativeDisplayMedia
    });
    if (decision.implementation === "error") {
      throw decision.error;
    }
    if (decision.implementation === "native") {
      if (!this.originalGetDisplayMedia) {
        throw notSupportedError("RealTesting: Native getDisplayMedia is not available.");
      }
      if (this.options.blockNativeDisplayMedia) {
        throw notAllowedError("RealTesting: Native getDisplayMedia is blocked.");
      }
      return this.originalGetDisplayMedia(constraints);
    }
    if (!enabledVirtual) {
      throw notFoundError("RealTesting: No enabled virtual displays are available.");
    }
    const videoConstraints = extractVideoTrackConstraints(constraints);
    const audioRequested = isAudioRequested(constraints);
    const defaults = enabledVirtual.defaultConstraints;
    const timing = getRealTestingTiming("screen-capture");
    if (timing.enabled) {
      await timing.delay("display.getDisplayMedia.streamStart");
    }
    return this.createVirtualStream({
      displayId: enabledVirtual.id,
      videoConstraints,
      audioRequested,
      defaults
    });
  }
};

// packages/screen_capture/src/core/RealScreenCaptureCore.ts
var DEFAULT_OPTIONS = {
  mode: "proxy",
  captureMode: "prefer-native",
  virtualPermission: "prompt",
  onVirtualPermissionRequest: () => false,
  blockNativeDisplayMedia: false
};
var DEFAULT_TEST_API_PROPERTY = "__realtestingTestApi";
function getTestWindow() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}
function resolveTestSetup(options) {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_TEST_CONFIG__ ?? null;
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
function buildTestSource(descriptor) {
  switch (descriptor.type) {
    case "color":
      return {
        type: "callback",
        draw: (ctx, info) => {
          ctx.fillStyle = descriptor.color;
          ctx.fillRect(0, 0, info.width, info.height);
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "24px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        }
      };
    case "pattern":
      return {
        type: "callback",
        draw: (ctx, info) => {
          const gradient = ctx.createLinearGradient(0, 0, info.width, info.height);
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#a855f7");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, info.width, info.height);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "22px sans-serif";
          ctx.fillText(descriptor.text ?? "RealTesting Pattern", 24, 48);
          ctx.fillText(`Frame ${info.frameIndex}`, 24, 78);
        }
      };
    case "image": {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = descriptor.url;
      return {
        type: "callback",
        draw: (ctx, info) => {
          if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, 0, 0, info.width, info.height);
          } else {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, info.width, info.height);
          }
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "22px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        }
      };
    }
    case "blank":
    default:
      return {
        type: "callback",
        draw: (ctx, info) => {
          ctx.fillStyle = descriptor.color ?? "#0f172a";
          ctx.fillRect(0, 0, info.width, info.height);
          if (descriptor.text) {
            ctx.fillStyle = "#f8fafc";
            ctx.font = "22px sans-serif";
            ctx.fillText(descriptor.text, 24, 48);
          }
        }
      };
  }
}
async function prepareTestSource(descriptor) {
  if (descriptor.type !== "image") {
    return buildTestSource(descriptor);
  }
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = descriptor.url;
  if (image.decode) {
    await image.decode();
  } else {
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image"));
    });
  }
  return { type: "image", element: image, text: descriptor.text };
}
var RealScreenCaptureCore = class {
  registry = new VirtualDisplayRegistry();
  installOptions = { ...DEFAULT_OPTIONS };
  options = { ...DEFAULT_OPTIONS };
  proxy = new MediaDevicesDisplayMediaProxy(this.registry, this.options);
  installed = false;
  baseSources = /* @__PURE__ */ new Map();
  sourceOverride;
  sourceOverrideSource;
  testConfig = null;
  testApi = null;
  testApiProperty = null;
  frameWaiters = /* @__PURE__ */ new Map();
  hasCustomPermissionRequestHandler = false;
  permissionPromptSeq = 0;
  pendingPermissionPrompts = /* @__PURE__ */ new Map();
  promptQueue = [];
  promptQueueWaiters = [];
  constructor() {
    this.proxy.setOnVirtualFrame((displayId, info) => {
      this.handleVirtualFrame(displayId, info.frameIndex, info.timestamp);
    });
    this.registry.onChange(() => {
    });
  }
  isInstalled() {
    return this.installed;
  }
  install(options = {}) {
    this.installOptions = { ...DEFAULT_OPTIONS, ...options };
    this.options = { ...this.installOptions };
    this.hasCustomPermissionRequestHandler = Object.prototype.hasOwnProperty.call(
      options,
      "onVirtualPermissionRequest"
    );
    const testSetup = resolveTestSetup(options);
    if (testSetup.config) {
      this.applyTestConfig(testSetup.config);
    }
    this.maybeInstallDefaultPermissionPromptHandler();
    this.proxy.updateOptions(this.options);
    this.attachTestApi(testSetup.enableApi, testSetup.windowProperty);
    if (this.options.mode === "proxy") {
      this.proxy.install();
      this.installed = true;
      return;
    }
    this.proxy.uninstall();
    this.installed = false;
  }
  uninstall() {
    this.proxy.uninstall();
    this.installed = false;
  }
  setCaptureMode(mode) {
    this.options = { ...this.options, captureMode: mode };
    this.proxy.updateOptions(this.options);
  }
  getCaptureMode() {
    return this.options.captureMode;
  }
  setBlockNativeDisplayMedia(block) {
    this.options = { ...this.options, blockNativeDisplayMedia: block };
    this.proxy.updateOptions(this.options);
  }
  getBlockNativeDisplayMedia() {
    return this.options.blockNativeDisplayMedia;
  }
  createVirtualDisplay(config = {}) {
    return this.registry.addVirtualDisplay(config);
  }
  listVirtualDisplays() {
    return this.registry.listVirtualDisplays();
  }
  setVirtualEnabled(displayId, enabled) {
    this.registry.setVirtualEnabled(displayId, enabled);
    if (!enabled) {
      this.proxy.stopVirtualStreams(displayId);
    }
  }
  updateVirtualDisplay(displayId, update) {
    this.registry.updateVirtualDisplay(displayId, update);
  }
  setVirtualSource(displayId, source) {
    this.baseSources.set(displayId, source);
    const resolved = this.applySourceOverrides(source);
    this.registry.setVirtualSource(displayId, resolved);
    this.proxy.updateVirtualSource(displayId, resolved);
  }
  async getDisplayMedia(constraints) {
    return this.proxy.getDisplayMedia(constraints);
  }
  getTestApi() {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: async (config) => {
        this.applyTestConfig(config);
        if (config.virtualSourceOverride) {
          await this.applySourceOverride(config.virtualSourceOverride);
        } else if ("virtualSourceOverride" in config) {
          await this.applySourceOverride(void 0);
        }
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => ({
        config: this.testConfig,
        captureMode: this.options.captureMode,
        blockNativeDisplayMedia: this.options.blockNativeDisplayMedia,
        virtualDisplays: this.listVirtualDisplays()
      }),
      setCaptureMode: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, captureMode: mode });
      },
      setVirtualPermission: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, virtualPermission: mode });
      },
      setBlockNativeDisplayMedia: (block) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, blockNativeDisplayMedia: block });
      },
      setVirtualSourceOverride: (descriptor) => {
        return this.applySourceOverride(descriptor);
      },
      waitForFrames: (count, displayId) => this.waitForFrames(count, displayId),
      stopAllVirtualStreams: () => {
        this.proxy.stopVirtualStreams();
      },
      waitForPermissionPrompt: () => this.waitForPermissionPrompt(),
      listPendingPermissionPrompts: () => this.listPendingPermissionPrompts(),
      respondToPermissionPrompt: (id, allow, opts) => this.respondToPermissionPrompt(id, allow, opts)
    };
    return this.testApi;
  }
  applyTestConfig(config) {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };
    if (config.captureMode) {
      this.options = { ...this.options, captureMode: config.captureMode };
    }
    if (config.virtualPermission) {
      this.options = { ...this.options, virtualPermission: config.virtualPermission };
    }
    if (typeof config.blockNativeDisplayMedia === "boolean") {
      this.options = { ...this.options, blockNativeDisplayMedia: config.blockNativeDisplayMedia };
    }
    this.sourceOverride = config.virtualSourceOverride;
    this.sourceOverrideSource = this.sourceOverride ? buildTestSource(this.sourceOverride) : void 0;
    this.proxy.setSourceOverride(this.sourceOverrideSource);
    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDisplays();
    this.maybeInstallDefaultPermissionPromptHandler();
  }
  resetTestConfig() {
    this.testConfig = null;
    this.options = { ...this.installOptions };
    this.sourceOverride = void 0;
    this.sourceOverrideSource = void 0;
    this.proxy.setSourceOverride(void 0);
    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDisplays();
    this.clearAllPermissionPrompts();
    this.maybeInstallDefaultPermissionPromptHandler();
  }
  maybeInstallDefaultPermissionPromptHandler() {
    if (this.options.virtualPermission !== "prompt" || this.hasCustomPermissionRequestHandler) {
      return;
    }
    const promptMode = this.testConfig?.permissionPromptMode ?? "manual";
    if (promptMode === "delegate") {
      return;
    }
    this.options = {
      ...this.options,
      onVirtualPermissionRequest: () => this.handlePermissionPrompt()
    };
    this.proxy.updateOptions(this.options);
  }
  async handlePermissionPrompt() {
    const prompt = {
      id: `realtesting-display-perm-${++this.permissionPromptSeq}`,
      requestedAt: Date.now()
    };
    const waiter = this.promptQueueWaiters.shift();
    if (waiter) {
      waiter(prompt);
    } else {
      this.promptQueue.push(prompt);
    }
    const timeoutMs = typeof this.testConfig?.permissionPromptTimeoutMs === "number" ? this.testConfig.permissionPromptTimeoutMs : 15e3;
    const allow = await new Promise((resolve) => {
      const entry = {
        prompt,
        resolve: (decision) => resolve(Boolean(decision)),
        responded: false,
        timeoutId: void 0
      };
      if (timeoutMs > 0) {
        entry.timeoutId = window.setTimeout(() => {
          this.respondToPermissionPrompt(prompt.id, false).catch(() => void 0);
        }, timeoutMs);
      }
      this.pendingPermissionPrompts.set(prompt.id, entry);
    });
    if (allow) {
      this.options = { ...this.options, virtualPermission: "allow" };
      this.proxy.updateOptions(this.options);
    }
    return allow;
  }
  clearAllPermissionPrompts() {
    for (const [id, entry] of this.pendingPermissionPrompts.entries()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      try {
        entry.resolve(false);
      } catch {
      }
      this.pendingPermissionPrompts.delete(id);
    }
    this.promptQueue = [];
    this.promptQueueWaiters = [];
  }
  waitForPermissionPrompt() {
    const next = this.promptQueue.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise((resolve) => {
      this.promptQueueWaiters.push(resolve);
    });
  }
  listPendingPermissionPrompts() {
    return Array.from(this.pendingPermissionPrompts.values()).map((e) => e.prompt);
  }
  async respondToPermissionPrompt(id, allow, options) {
    const entry = this.pendingPermissionPrompts.get(id);
    if (!entry || entry.responded) {
      return;
    }
    entry.responded = true;
    this.pendingPermissionPrompts.delete(id);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    const afterMs = options?.afterMs;
    if (typeof afterMs === "number" && afterMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, afterMs));
    }
    entry.resolve(Boolean(allow));
  }
  applySourceOverrides(source) {
    if (this.sourceOverrideSource) {
      return this.sourceOverrideSource;
    }
    return source;
  }
  async applySourceOverride(descriptor) {
    this.sourceOverride = descriptor;
    if (this.testConfig) {
      this.testConfig = { ...this.testConfig ?? {}, virtualSourceOverride: descriptor };
    }
    if (!descriptor) {
      this.sourceOverrideSource = void 0;
      this.proxy.setSourceOverride(void 0);
      this.refreshSourcesForAllDisplays();
      return;
    }
    this.sourceOverrideSource = await prepareTestSource(descriptor);
    this.proxy.setSourceOverride(this.sourceOverrideSource);
    this.refreshSourcesForAllDisplays();
  }
  refreshSourcesForAllDisplays() {
    const displays = this.registry.listVirtualDisplayInternals();
    displays.forEach((display) => {
      const base = this.baseSources.get(display.id) ?? display.source;
      if (!base) {
        return;
      }
      const resolved = this.applySourceOverrides(base);
      this.registry.setVirtualSource(display.id, resolved);
      this.proxy.updateVirtualSource(display.id, resolved);
    });
  }
  handleVirtualFrame(displayId, frameIndex, timestamp) {
    const info = { displayId, frameIndex, timestamp };
    this.resolveFrameWaiters(displayId, info);
    this.resolveFrameWaiters("*", info);
  }
  resolveFrameWaiters(key, info) {
    const waiters = this.frameWaiters.get(key);
    if (!waiters || waiters.length === 0) {
      return;
    }
    this.frameWaiters.delete(key);
    waiters.forEach((resolve) => resolve(info));
  }
  waitForFrame(displayId) {
    const key = displayId ?? "*";
    return new Promise((resolve) => {
      const waiters = this.frameWaiters.get(key) ?? [];
      waiters.push(resolve);
      this.frameWaiters.set(key, waiters);
    });
  }
  async waitForFrames(count, displayId) {
    let info = { displayId: displayId ?? "*", frameIndex: 0, timestamp: 0 };
    for (let i = 0; i < count; i += 1) {
      info = await this.waitForFrame(displayId);
    }
    return info;
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

// packages/screen_capture/src/index.ts
var RealScreenCapture = new RealScreenCaptureCore();
export {
  RealScreenCapture
};
