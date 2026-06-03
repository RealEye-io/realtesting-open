"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/camera/src/index.ts
var index_exports = {};
__export(index_exports, {
  RealCamera: () => RealCamera
});
module.exports = __toCommonJS(index_exports);

// packages/camera/src/utils/id.ts
function generateDeviceId(prefix = "realcamera") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${random}`;
}

// packages/camera/src/core/DeviceRegistry.ts
var DEFAULT_CONSTRAINTS = {
  width: 640,
  height: 480,
  frameRate: 30
};
var DeviceRegistry = class {
  devices = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  addVirtualDevice(config = {}) {
    const id = generateDeviceId("realcamera-virtual");
    const device = {
      id,
      label: config.label ?? "RealCamera Virtual",
      groupId: config.groupId ?? "realcamera",
      enabled: config.enabled ?? true,
      defaultConstraints: config.defaultConstraints ?? DEFAULT_CONSTRAINTS,
      source: void 0
    };
    this.devices.set(id, device);
    this.emitChange();
    return id;
  }
  updateVirtualDevice(id, update) {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    const next = {
      ...device,
      ...update,
      defaultConstraints: update.defaultConstraints ?? device.defaultConstraints
    };
    this.devices.set(id, next);
    this.emitChange();
  }
  removeVirtualDevice(id) {
    if (this.devices.delete(id)) {
      this.emitChange();
    }
  }
  setVirtualSource(id, source) {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    this.devices.set(id, { ...device, source });
    this.emitChange();
  }
  setVirtualEnabled(id, enabled) {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    this.devices.set(id, { ...device, enabled });
    this.emitChange();
  }
  getVirtualDevice(id) {
    return this.devices.get(id);
  }
  listVirtualDevices() {
    return Array.from(this.devices.values());
  }
  clear() {
    this.devices.clear();
    this.emitChange();
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emitChange() {
    this.listeners.forEach((listener) => listener());
  }
};

// packages/camera/src/utils/constraints.ts
var DEFAULT_CONSTRAINTS2 = {
  width: 640,
  height: 480,
  frameRate: 30
};
function applyVideoConstraintsOverride(constraints, override) {
  if (!override) {
    return constraints;
  }
  if (!constraints || typeof constraints === "boolean") {
    return { ...override };
  }
  return {
    ...constraints,
    ...override
  };
}
function resolveNumberConstraint(constraint, fallback) {
  if (typeof constraint === "number") {
    return constraint;
  }
  if (!constraint || typeof constraint !== "object") {
    return fallback;
  }
  if (typeof constraint.exact === "number") {
    return constraint.exact;
  }
  if (typeof constraint.ideal === "number") {
    return constraint.ideal;
  }
  let candidate = fallback;
  if (typeof constraint.min === "number") {
    candidate = Math.max(candidate, constraint.min);
  }
  if (typeof constraint.max === "number") {
    candidate = Math.min(candidate, constraint.max);
  }
  return candidate;
}
function resolveVideoConstraints(constraints, defaults = {}) {
  if (constraints === false) {
    return { ...DEFAULT_CONSTRAINTS2, ...defaults };
  }
  if (!constraints || typeof constraints === "boolean") {
    return { ...DEFAULT_CONSTRAINTS2, ...defaults };
  }
  const width = resolveNumberConstraint(
    constraints.width,
    defaults.width ?? DEFAULT_CONSTRAINTS2.width
  );
  const height = resolveNumberConstraint(
    constraints.height,
    defaults.height ?? DEFAULT_CONSTRAINTS2.height
  );
  const frameRate = resolveNumberConstraint(
    constraints.frameRate,
    defaults.frameRate ?? DEFAULT_CONSTRAINTS2.frameRate
  );
  return {
    width,
    height,
    frameRate
  };
}
function extractDeviceId(constraints) {
  if (!constraints || typeof constraints === "boolean") {
    return void 0;
  }
  const deviceId = constraints.deviceId;
  if (!deviceId) {
    return void 0;
  }
  if (typeof deviceId === "string") {
    return deviceId;
  }
  if (Array.isArray(deviceId)) {
    return deviceId[0];
  }
  if (typeof deviceId === "object") {
    if (Array.isArray(deviceId.exact)) {
      return deviceId.exact[0];
    }
    if (typeof deviceId.exact === "string") {
      return deviceId.exact;
    }
    if (Array.isArray(deviceId.ideal)) {
      return deviceId.ideal[0];
    }
    if (typeof deviceId.ideal === "string") {
      return deviceId.ideal;
    }
  }
  return void 0;
}
function toConstraintsObject(constraints) {
  if (!constraints) {
    return { video: true, audio: false };
  }
  return constraints;
}

// packages/camera/src/core/FrameScheduler.ts
var FrameScheduler = class {
  timerId = null;
  frameIndex = 0;
  fps;
  callback = null;
  constructor(fps) {
    this.fps = fps;
  }
  start(callback) {
    this.callback = callback;
    this.stop();
    this.frameIndex = 0;
    const interval = this.toInterval(this.fps);
    this.timerId = window.setInterval(() => {
      this.frameIndex += 1;
      this.callback?.(performance.now(), this.frameIndex);
    }, interval);
  }
  stop() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }
  updateFps(fps) {
    this.fps = fps;
    if (this.callback) {
      this.start(this.callback);
    }
  }
  toInterval(fps) {
    if (!Number.isFinite(fps) || fps <= 0) {
      return 33;
    }
    return Math.max(5, Math.floor(1e3 / fps));
  }
};

// packages/camera/src/core/VirtualStream.ts
var VirtualStream = class {
  canvas;
  ctx;
  scheduler;
  mediaStream;
  track;
  source;
  settings;
  constraintOverride;
  constructor(device, constraints, onFrame, constraintOverride) {
    this.constraintOverride = constraintOverride;
    const resolved = resolveVideoConstraints(
      applyVideoConstraintsOverride(constraints, this.constraintOverride),
      device.defaultConstraints
    );
    this.settings = resolved;
    this.source = device.source;
    this.canvas = document.createElement("canvas");
    this.canvas.width = resolved.width;
    this.canvas.height = resolved.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("RealCamera: Unable to create 2D canvas context.");
    }
    this.ctx = ctx;
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.mediaStream = this.canvas.captureStream(resolved.frameRate);
    const [track] = this.mediaStream.getVideoTracks();
    if (!track) {
      throw new Error("RealCamera: captureStream did not provide a video track.");
    }
    this.track = track;
    this.scheduler = new FrameScheduler(resolved.frameRate);
    this.installTrackHooks();
    this.scheduler.start((timestamp, frameIndex) => {
      const info = {
        width: this.canvas.width,
        height: this.canvas.height,
        timestamp,
        frameIndex
      };
      this.drawFrame(info);
      onFrame?.(info);
    });
  }
  get stream() {
    return this.mediaStream;
  }
  get videoTrack() {
    return this.track;
  }
  updateSource(source) {
    this.source = source;
  }
  setConstraintOverride(constraintOverride) {
    this.constraintOverride = constraintOverride;
    this.updateConstraints();
  }
  updateConstraints(constraints) {
    const resolved = resolveVideoConstraints(
      applyVideoConstraintsOverride(constraints, this.constraintOverride),
      this.settings
    );
    this.settings = resolved;
    this.canvas.width = resolved.width;
    this.canvas.height = resolved.height;
    this.scheduler.updateFps(resolved.frameRate);
  }
  stop() {
    this.scheduler.stop();
    this.mediaStream.getTracks().forEach((track) => track.stop());
  }
  installTrackHooks() {
    const originalApplyConstraints = this.track.applyConstraints.bind(this.track);
    const originalGetSettings = this.track.getSettings.bind(this.track);
    this.track.applyConstraints = async (constraints) => {
      if (constraints) {
        this.updateConstraints(constraints);
      }
      try {
        await originalApplyConstraints(constraints);
      } catch {
      }
    };
    this.track.getSettings = () => {
      const nativeSettings = originalGetSettings();
      return {
        ...nativeSettings,
        width: this.settings.width,
        height: this.settings.height,
        frameRate: this.settings.frameRate
      };
    };
    this.track.addEventListener("ended", () => {
      this.stop();
    });
  }
  drawFrame(info) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const source = this.source;
    if (!source) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    switch (source.type) {
      case "canvas":
      case "video":
      case "image":
        try {
          ctx.drawImage(
            source.element,
            0,
            0,
            this.canvas.width,
            this.canvas.height
          );
        } catch {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        break;
      case "callback":
        Promise.resolve(source.draw(ctx, info)).catch(() => {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        });
        break;
      default:
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        break;
    }
  }
};

// packages/camera/src/utils/errors.ts
function createDOMError(name, message) {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, name);
  }
  const error = new Error(message);
  error.name = name;
  return error;
}
function notAllowedError(message) {
  return createDOMError("NotAllowedError", message);
}
function notFoundError(message) {
  return createDOMError("NotFoundError", message);
}

// packages/camera/src/utils/realtestingTiming.ts
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
      // Camera-like
      "camera.boot": { minMs: 1e3, maxMs: 5e3 },
      "camera.permission.promptOpen": { minMs: 150, maxMs: 900 },
      "camera.permission.userAction": { minMs: 300, maxMs: 4e3 },
      "camera.enumerateDevices": { minMs: 50, maxMs: 400 },
      "camera.getUserMedia.afterPermission": { minMs: 100, maxMs: 800 }
    };
  }
  if (profile === "ciRealistic") {
    return {
      "camera.boot": { minMs: 200, maxMs: 1500 },
      "camera.permission.promptOpen": { minMs: 50, maxMs: 350 },
      "camera.permission.userAction": { minMs: 100, maxMs: 1200 },
      "camera.enumerateDevices": { minMs: 10, maxMs: 120 },
      "camera.getUserMedia.afterPermission": { minMs: 20, maxMs: 200 }
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
  return {
    enabled: config.enabled,
    profile: config.profile,
    sampleMs: (kind, fallback) => {
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
      const scaled = Math.max(0, Math.round(sampled * config.scale));
      return scaled;
    },
    delay: async (kind, fallback) => {
      const ms = config.enabled ? (() => {
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
      })() : 0;
      if (ms > 0) {
        await sleep(ms);
      }
      return ms;
    }
  };
}

// packages/camera/src/core/MediaDevicesProxy.ts
var MediaDevicesProxy = class {
  registry;
  options;
  installed = false;
  mediaDevices;
  originalGetUserMedia;
  originalEnumerateDevices;
  originalGetSupportedConstraints;
  originalNavigatorGetUserMedia;
  originalNavigatorWebkitGetUserMedia;
  originalNavigatorMozGetUserMedia;
  originalNavigatorLegacyCaptured = false;
  activeStreams = /* @__PURE__ */ new Map();
  onVirtualFrame;
  nextGetUserMediaError;
  getUserMediaDelayMs;
  enumerateDevicesOverride;
  supportedConstraintsOverride;
  virtualVideoConstraintsOverride;
  bootedVirtualDevices = /* @__PURE__ */ new Set();
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
  setNextGetUserMediaError(error) {
    this.nextGetUserMediaError = error;
  }
  setGetUserMediaDelay(delayMs) {
    this.getUserMediaDelayMs = delayMs;
  }
  setEnumerateDevicesOverride(override) {
    this.enumerateDevicesOverride = override;
  }
  setSupportedConstraintsOverride(override) {
    this.supportedConstraintsOverride = override;
  }
  setVirtualVideoConstraintsOverride(override) {
    this.virtualVideoConstraintsOverride = override;
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.setConstraintOverride(override));
    });
  }
  captureOriginals() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("RealCamera: navigator.mediaDevices is not available.");
    }
    this.mediaDevices = navigator.mediaDevices;
    if (!this.originalGetUserMedia) {
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      );
    }
    if (!this.originalEnumerateDevices) {
      this.originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    }
    if (!this.originalGetSupportedConstraints) {
      this.originalGetSupportedConstraints = navigator.mediaDevices.getSupportedConstraints.bind(navigator.mediaDevices);
    }
    if (!this.originalNavigatorLegacyCaptured) {
      const nav = navigator;
      this.originalNavigatorGetUserMedia = nav.getUserMedia;
      this.originalNavigatorWebkitGetUserMedia = nav.webkitGetUserMedia;
      this.originalNavigatorMozGetUserMedia = nav.mozGetUserMedia;
      this.originalNavigatorLegacyCaptured = true;
    }
  }
  install() {
    if (this.installed) {
      return;
    }
    this.captureOriginals();
    navigator.mediaDevices.getUserMedia = this.getUserMediaProxy.bind(this);
    navigator.mediaDevices.enumerateDevices = this.enumerateDevicesProxy.bind(this);
    navigator.mediaDevices.getSupportedConstraints = this.getSupportedConstraintsProxy.bind(this);
    this.installLegacyGetUserMedia();
    this.installed = true;
  }
  uninstall() {
    if (!this.installed || !this.mediaDevices) {
      return;
    }
    if (this.originalGetUserMedia) {
      this.mediaDevices.getUserMedia = this.originalGetUserMedia;
    }
    if (this.originalEnumerateDevices) {
      this.mediaDevices.enumerateDevices = this.originalEnumerateDevices;
    }
    if (this.originalGetSupportedConstraints) {
      this.mediaDevices.getSupportedConstraints = this.originalGetSupportedConstraints;
    }
    this.uninstallLegacyGetUserMedia();
    this.installed = false;
  }
  async getUserMedia(constraints) {
    return this.getUserMediaProxy(constraints);
  }
  async enumerateDevices() {
    return this.enumerateDevicesProxy();
  }
  updateVirtualSource(deviceId, source) {
    const streams = this.activeStreams.get(deviceId);
    if (!streams) {
      return;
    }
    streams.forEach((stream) => stream.updateSource(source));
  }
  stopVirtualStreams(deviceId) {
    if (deviceId) {
      const streams = this.activeStreams.get(deviceId);
      if (streams) {
        streams.forEach((stream) => stream.stop());
        this.activeStreams.delete(deviceId);
      }
      return;
    }
    this.activeStreams.forEach((streams) => {
      streams.forEach((stream) => stream.stop());
    });
    this.activeStreams.clear();
  }
  async getUserMediaProxy(constraints) {
    if (!this.originalGetUserMedia) {
      throw new Error("RealCamera: getUserMedia is not available.");
    }
    if (this.getUserMediaDelayMs && this.getUserMediaDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.getUserMediaDelayMs));
    }
    if (this.nextGetUserMediaError) {
      const error = this.nextGetUserMediaError;
      this.nextGetUserMediaError = void 0;
      throw this.buildDomError(error);
    }
    const normalized = toConstraintsObject(constraints);
    const videoConstraints = normalized.video;
    const audioConstraints = normalized.audio;
    const wantsVideo = Boolean(videoConstraints);
    let deviceId = extractDeviceId(
      typeof videoConstraints === "boolean" ? void 0 : videoConstraints
    );
    let virtualDevice = deviceId ? this.registry.getVirtualDevice(deviceId) : void 0;
    if (!virtualDevice && wantsVideo && this.options.blockPhysicalDevices) {
      const firstEnabled = this.registry.listVirtualDevices().find((device) => device.enabled);
      if (firstEnabled) {
        deviceId = firstEnabled.id;
        virtualDevice = firstEnabled;
      }
    }
    if (virtualDevice) {
      const timing = getRealTestingTiming("realcamera");
      if (timing.enabled && !this.bootedVirtualDevices.has(virtualDevice.id)) {
        this.bootedVirtualDevices.add(virtualDevice.id);
        await timing.delay("camera.boot");
      }
      if (!virtualDevice.enabled) {
        throw notFoundError("RealCamera: Virtual device is disabled.");
      }
      if (timing.enabled && this.options.virtualPermission === "prompt") {
        await timing.delay("camera.permission.promptOpen");
      }
      const allowed = await this.resolveVirtualPermission(virtualDevice.id);
      if (!allowed) {
        throw notAllowedError("RealCamera: Virtual device permission denied.");
      }
      if (timing.enabled) {
        await timing.delay("camera.getUserMedia.afterPermission");
      }
      const videoStream = this.createVirtualStream(
        virtualDevice.id,
        typeof videoConstraints === "boolean" ? void 0 : videoConstraints
      );
      if (!audioConstraints) {
        return videoStream;
      }
      const audioStream = await this.originalGetUserMedia({
        audio: audioConstraints,
        video: false
      });
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ]);
      return combined;
    }
    if (this.options.blockPhysicalDevices && wantsVideo) {
      throw notAllowedError("RealCamera: Physical devices are blocked.");
    }
    return this.originalGetUserMedia(normalized);
  }
  installLegacyGetUserMedia() {
    if (typeof navigator === "undefined") {
      return;
    }
    const nav = navigator;
    const proxy = (constraints, onSuccess, onError) => {
      this.getUserMediaProxy(constraints).then(
        (stream) => onSuccess?.(stream),
        (error) => onError?.(error)
      );
    };
    nav.getUserMedia = proxy;
    nav.webkitGetUserMedia = proxy;
    nav.mozGetUserMedia = proxy;
  }
  uninstallLegacyGetUserMedia() {
    if (!this.originalNavigatorLegacyCaptured || typeof navigator === "undefined") {
      return;
    }
    const nav = navigator;
    nav.getUserMedia = this.originalNavigatorGetUserMedia;
    nav.webkitGetUserMedia = this.originalNavigatorWebkitGetUserMedia;
    nav.mozGetUserMedia = this.originalNavigatorMozGetUserMedia;
  }
  createVirtualStream(deviceId, constraints) {
    const device = this.registry.getVirtualDevice(deviceId);
    if (!device) {
      throw notFoundError("RealCamera: Virtual device not found.");
    }
    const effectiveConstraints = applyVideoConstraintsOverride(
      constraints,
      this.virtualVideoConstraintsOverride
    );
    const resolved = resolveVideoConstraints(
      effectiveConstraints,
      device.defaultConstraints
    );
    const virtualStream = new VirtualStream(
      device,
      {
        ...constraints,
        width: resolved.width,
        height: resolved.height,
        frameRate: resolved.frameRate
      },
      (info) => {
        this.onVirtualFrame?.(deviceId, info);
      },
      this.virtualVideoConstraintsOverride
    );
    this.registerVirtualStream(deviceId, virtualStream);
    return virtualStream.stream;
  }
  registerVirtualStream(deviceId, stream) {
    const set = this.activeStreams.get(deviceId) ?? /* @__PURE__ */ new Set();
    set.add(stream);
    this.activeStreams.set(deviceId, set);
    stream.videoTrack.addEventListener("ended", () => {
      const streams = this.activeStreams.get(deviceId);
      if (!streams) {
        return;
      }
      streams.delete(stream);
      if (streams.size === 0) {
        this.activeStreams.delete(deviceId);
      }
    });
  }
  async enumerateDevicesProxy() {
    const timing = getRealTestingTiming("realcamera");
    if (timing.enabled) {
      await timing.delay("camera.enumerateDevices");
    }
    if (!this.originalEnumerateDevices) {
      return [];
    }
    if (this.enumerateDevicesOverride) {
      const override = this.enumerateDevicesOverride;
      if (override.once) {
        this.enumerateDevicesOverride = void 0;
      }
      return override.devices.map(
        (device) => this.toMediaDeviceInfoFromOverride(device)
      );
    }
    const physicalDevices = await this.originalEnumerateDevices();
    const filteredPhysicalDevices = this.options.blockPhysicalDevices ? physicalDevices.filter((device) => device.kind !== "videoinput") : physicalDevices;
    if (!this.options.includeVirtualDevices) {
      return filteredPhysicalDevices;
    }
    const virtualDevices = this.buildVirtualEnumerateDevices(
      this.registry.listVirtualDevices().filter((device) => device.enabled)
    );
    return [...filteredPhysicalDevices, ...virtualDevices];
  }
  buildVirtualEnumerateDevices(devices) {
    const profile = this.options.virtualPermission === "allow" ? "legacy" : this.options.prePermissionEnumerateProfile;
    if (profile === "single-anonymous") {
      const firstDevice = devices[0];
      return firstDevice ? [this.toMediaDeviceInfo(firstDevice)] : [];
    }
    const anonymize = profile === "anonymous-all";
    return devices.map(
      (device) => this.toMediaDeviceInfo(device, { anonymize })
    );
  }
  getSupportedConstraintsProxy() {
    if (this.supportedConstraintsOverride) {
      return this.supportedConstraintsOverride;
    }
    if (!this.originalGetSupportedConstraints) {
      return {};
    }
    return this.originalGetSupportedConstraints();
  }
  toMediaDeviceInfo(device, options) {
    const anonymize = options?.anonymize === true;
    const deviceId = anonymize ? "" : device.id;
    const label = anonymize ? "" : this.options.virtualPermission === "allow" ? device.label : "";
    const groupId = anonymize ? "" : device.groupId;
    const info = {
      deviceId,
      kind: "videoinput",
      label,
      groupId,
      toJSON() {
        return {
          deviceId,
          kind: "videoinput",
          label,
          groupId
        };
      }
    };
    if (typeof MediaDeviceInfo !== "undefined") {
      Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
    }
    return info;
  }
  toMediaDeviceInfoFromOverride(device) {
    const info = {
      deviceId: device.deviceId,
      kind: device.kind,
      label: device.label ?? "",
      groupId: device.groupId ?? "",
      toJSON() {
        return {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label ?? "",
          groupId: device.groupId ?? ""
        };
      }
    };
    if (typeof MediaDeviceInfo !== "undefined") {
      Object.setPrototypeOf(info, MediaDeviceInfo.prototype);
    }
    return info;
  }
  buildDomError(error) {
    const message = error.message ?? error.name;
    const domError = typeof DOMException !== "undefined" ? new DOMException(message, error.name) : Object.assign(new Error(message), { name: error.name });
    if (error.name === "OverconstrainedError" && error.constraint) {
      domError.constraint = error.constraint;
    }
    return domError;
  }
  async resolveVirtualPermission(deviceId) {
    if (this.options.virtualPermission === "allow") {
      return true;
    }
    if (this.options.virtualPermission === "deny") {
      return false;
    }
    const result = await this.options.onVirtualPermissionRequest?.(deviceId);
    return Boolean(result);
  }
};

// packages/camera/src/core/RealCameraCore.ts
var DEFAULT_OPTIONS = {
  mode: "proxy",
  virtualPermission: "allow",
  prePermissionEnumerateProfile: "legacy",
  onVirtualPermissionRequest: () => false,
  includeVirtualDevices: true,
  blockPhysicalDevices: false
};
var DEFAULT_TEST_API_PROPERTY = "__realcameraTestApi";
function getTestWindow() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}
function resolveTestSetup(options) {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALCAMERA_TEST_CONFIG__ ?? null;
  const params = testWindow ? new URLSearchParams(testWindow.location.search) : null;
  const autoEnabled = params?.has("realcameraTest") || params?.has("realcamera-test") || params?.has("realtestingTest") || params?.has("realtesting-test") || testWindow?.__REALCAMERA_TEST__ === true || config?.enabled === true;
  const apiOptions = options.testApi;
  const enableApi = apiOptions?.enabled === true || apiOptions?.autoEnable !== false && autoEnabled;
  return {
    config,
    enableApi,
    windowProperty: apiOptions?.windowProperty ?? DEFAULT_TEST_API_PROPERTY
  };
}
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
    default:
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, info.width, info.height);
  }
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
          ctx.fillText("RealCamera Test Pattern", 24, 48);
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
  return {
    type: "image",
    element: image
  };
}
function applySourceTransform(source, transform) {
  if (transform.type !== "swap") {
    return source;
  }
  const afterSource = buildTestSource(transform.after);
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const afterFrames = transform.afterFrames ?? 10;
  const afterMs = transform.afterMs;
  return {
    type: "callback",
    draw: (ctx, info) => {
      const elapsed = typeof performance !== "undefined" ? performance.now() - start : 0;
      const useAfter = typeof afterMs === "number" && elapsed >= afterMs || info.frameIndex >= afterFrames;
      drawSource(ctx, info, useAfter ? afterSource : source);
    }
  };
}
var RealCameraCore = class {
  registry = new DeviceRegistry();
  options = { ...DEFAULT_OPTIONS };
  proxy = new MediaDevicesProxy(this.registry, this.options);
  installed = false;
  unsubscribe;
  testConfig = null;
  testApi = null;
  testApiProperty = null;
  nextVirtualOverride;
  sourceOverride;
  sourceTransform;
  sourceOverrideSource;
  baseSources = /* @__PURE__ */ new Map();
  frameWaiters = /* @__PURE__ */ new Map();
  permissionRequestSeq = 0;
  pendingPermissionRequests = /* @__PURE__ */ new Map();
  permissionQueue = [];
  permissionQueueWaiters = [];
  hasCustomPermissionRequestHandler = false;
  constructor() {
    this.proxy.setOnVirtualFrame((deviceId, info) => {
      this.handleVirtualFrame(deviceId, info.frameIndex, info.timestamp);
    });
    this.unsubscribe = this.registry.onChange(() => {
      if (!this.installed) {
        return;
      }
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
      }
    });
  }
  install(options = {}) {
    const { testApi: _testApi, ...rest } = options;
    this.options = { ...DEFAULT_OPTIONS, ...rest };
    this.hasCustomPermissionRequestHandler = Object.prototype.hasOwnProperty.call(
      rest,
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
    this.proxy.captureOriginals();
    this.installed = false;
  }
  uninstall() {
    this.proxy.uninstall();
    this.proxy.stopVirtualStreams();
    this.installed = false;
    this.detachTestApi();
  }
  isInstalled() {
    return this.installed;
  }
  createVirtualDevice(config = {}) {
    const override = this.consumeVirtualOverride();
    const resolved = {
      ...config,
      enabled: config.enabled ?? override?.enabled,
      defaultConstraints: config.defaultConstraints ?? override?.defaultConstraints,
      label: config.label ?? override?.label,
      groupId: config.groupId ?? override?.groupId
    };
    const id = this.registry.addVirtualDevice(resolved);
    return id;
  }
  updateVirtualDevice(id, update) {
    this.registry.updateVirtualDevice(id, update);
  }
  removeVirtualDevice(id) {
    this.registry.removeVirtualDevice(id);
    this.proxy.stopVirtualStreams(id);
  }
  setVirtualSource(id, source) {
    this.baseSources.set(id, source);
    const resolvedSource = this.applySourceOverrides(source);
    this.registry.setVirtualSource(id, resolvedSource);
    this.proxy.updateVirtualSource(id, resolvedSource);
  }
  setVirtualEnabled(id, enabled) {
    this.registry.setVirtualEnabled(id, enabled);
    if (!enabled) {
      this.proxy.stopVirtualStreams(id);
    }
  }
  listVirtualDevices() {
    return this.registry.listVirtualDevices();
  }
  setPhysicalDevicesEnabled(enabled) {
    this.options = { ...this.options, blockPhysicalDevices: !enabled };
    this.proxy.updateOptions(this.options);
  }
  async getUserMedia(constraints) {
    return this.proxy.getUserMedia(constraints);
  }
  async enumerateDevices() {
    return this.proxy.enumerateDevices();
  }
  getTestApi() {
    if (this.testApi) {
      return this.testApi;
    }
    this.testApi = {
      configure: (config) => {
        this.applyTestConfig(config);
      },
      reset: () => {
        this.resetTestConfig();
      },
      getState: () => ({ config: this.testConfig }),
      setVirtualPermission: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, virtualPermission: mode });
      },
      setPhysicalDevicesEnabled: (enabled) => {
        this.setPhysicalDevicesEnabled(enabled);
      },
      setVirtualEnabled: (id, enabled) => {
        this.setVirtualEnabled(id, enabled);
      },
      setVirtualSourceOverride: (descriptor) => {
        return this.applySourceOverride(descriptor);
      },
      setSourceTransform: (transform) => {
        this.sourceTransform = transform;
        this.refreshSourcesForAllDevices();
      },
      setNextVirtualDeviceOverride: (override) => {
        this.nextVirtualOverride = override;
      },
      setVirtualSourceForDevice: (id, descriptor) => {
        return this.applySourceForDevice(id, descriptor);
      },
      listVirtualDevices: () => this.listVirtualDevices(),
      waitForFrame: (deviceId) => this.waitForFrame(deviceId),
      waitForFrames: (count, deviceId) => this.waitForFrames(count, deviceId),
      setNextGetUserMediaError: (error) => {
        this.proxy.setNextGetUserMediaError(error);
      },
      setGetUserMediaDelay: (delayMs) => {
        this.proxy.setGetUserMediaDelay(delayMs);
      },
      setEnumerateDevicesOverride: (override) => {
        this.proxy.setEnumerateDevicesOverride(override);
      },
      setSupportedConstraintsOverride: (override) => {
        this.proxy.setSupportedConstraintsOverride(override);
      },
      waitForPermissionRequest: () => this.waitForPermissionRequest(),
      listPendingPermissionRequests: () => this.listPendingPermissionRequests(),
      respondToPermissionRequest: (id, allow, options) => this.respondToPermissionRequest(id, allow, options)
    };
    return this.testApi;
  }
  applyTestConfig(config) {
    this.testConfig = { ...config };
    if (config.virtualPermission) {
      this.options = { ...this.options, virtualPermission: config.virtualPermission };
    }
    if (config.prePermissionEnumerateProfile) {
      this.options = {
        ...this.options,
        prePermissionEnumerateProfile: config.prePermissionEnumerateProfile
      };
    }
    if (typeof config.blockPhysicalDevices === "boolean") {
      this.options = { ...this.options, blockPhysicalDevices: config.blockPhysicalDevices };
    }
    this.nextVirtualOverride = config.nextVirtualDevice;
    this.sourceOverride = config.virtualSourceOverride;
    this.sourceTransform = config.sourceTransform;
    this.sourceOverrideSource = this.sourceOverride ? buildTestSource(this.sourceOverride) : void 0;
    if (config.nextGetUserMediaError) {
      this.proxy.setNextGetUserMediaError(config.nextGetUserMediaError);
    }
    if (typeof config.getUserMediaDelayMs === "number") {
      this.proxy.setGetUserMediaDelay(config.getUserMediaDelayMs);
    }
    this.proxy.setVirtualVideoConstraintsOverride(
      config.virtualVideoConstraintsOverride
    );
    if (config.enumerateDevicesOverride) {
      this.proxy.setEnumerateDevicesOverride(config.enumerateDevicesOverride);
    }
    if (config.supportedConstraintsOverride) {
      this.proxy.setSupportedConstraintsOverride(config.supportedConstraintsOverride);
    }
    this.proxy.updateOptions(this.options);
    this.refreshSourcesForAllDevices();
    this.maybeInstallDefaultPermissionPromptHandler();
  }
  resetTestConfig() {
    this.testConfig = null;
    this.nextVirtualOverride = void 0;
    this.sourceOverride = void 0;
    this.sourceTransform = void 0;
    this.sourceOverrideSource = void 0;
    this.proxy.setVirtualVideoConstraintsOverride(void 0);
    this.refreshSourcesForAllDevices();
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
      onVirtualPermissionRequest: (deviceId) => this.handlePermissionPrompt(deviceId)
    };
    this.proxy.updateOptions(this.options);
  }
  async handlePermissionPrompt(deviceId) {
    const request = {
      id: `realcamera-perm-${++this.permissionRequestSeq}`,
      deviceId,
      requestedAt: Date.now()
    };
    const waiter = this.permissionQueueWaiters.shift();
    if (waiter) {
      waiter(request);
    } else {
      this.permissionQueue.push(request);
    }
    const timeoutMs = typeof this.testConfig?.permissionPromptTimeoutMs === "number" ? this.testConfig.permissionPromptTimeoutMs : 15e3;
    const promise = new Promise((resolve) => {
      const entry = {
        request,
        resolve: (allow2) => resolve(Boolean(allow2)),
        responded: false,
        timeoutId: void 0
      };
      if (timeoutMs > 0) {
        entry.timeoutId = window.setTimeout(() => {
          this.respondToPermissionRequest(request.id, false).catch(() => void 0);
        }, timeoutMs);
      }
      this.pendingPermissionRequests.set(request.id, entry);
    });
    const allow = await promise;
    if (allow) {
      this.options = { ...this.options, virtualPermission: "allow" };
      this.proxy.updateOptions(this.options);
    }
    return allow;
  }
  clearAllPermissionPrompts() {
    for (const [id, entry] of this.pendingPermissionRequests.entries()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      try {
        entry.resolve(false);
      } catch {
      }
      this.pendingPermissionRequests.delete(id);
    }
    this.permissionQueue = [];
    this.permissionQueueWaiters = [];
  }
  waitForPermissionRequest() {
    const next = this.permissionQueue.shift();
    if (next) {
      return Promise.resolve(next);
    }
    return new Promise((resolve) => {
      this.permissionQueueWaiters.push(resolve);
    });
  }
  listPendingPermissionRequests() {
    return Array.from(this.pendingPermissionRequests.values()).map((e) => e.request);
  }
  async respondToPermissionRequest(id, allow, options) {
    const entry = this.pendingPermissionRequests.get(id);
    if (!entry || entry.responded) {
      return;
    }
    entry.responded = true;
    this.pendingPermissionRequests.delete(id);
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    const afterMs = options?.afterMs;
    if (typeof afterMs === "number" && afterMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, afterMs));
    }
    entry.resolve(Boolean(allow));
  }
  consumeVirtualOverride() {
    const override = this.nextVirtualOverride;
    if (override) {
      this.nextVirtualOverride = void 0;
      return override;
    }
    const configOverrides = this.testConfig?.nextVirtualDevice;
    if (configOverrides) {
      this.testConfig = {
        ...this.testConfig ?? {},
        nextVirtualDevice: void 0
      };
      return configOverrides;
    }
    return void 0;
  }
  applySourceOverrides(source) {
    if (this.sourceOverrideSource) {
      return this.sourceOverrideSource;
    }
    if (this.sourceTransform) {
      return applySourceTransform(source, this.sourceTransform);
    }
    return source;
  }
  async applySourceOverride(descriptor) {
    this.sourceOverride = descriptor;
    if (!descriptor) {
      this.sourceOverrideSource = void 0;
      this.refreshSourcesForAllDevices();
      return;
    }
    this.sourceOverrideSource = await prepareTestSource(descriptor);
    this.refreshSourcesForAllDevices();
  }
  async applySourceForDevice(id, descriptor) {
    const source = await prepareTestSource(descriptor);
    this.baseSources.set(id, source);
    const resolved = this.applySourceOverrides(source);
    this.registry.setVirtualSource(id, resolved);
    this.proxy.updateVirtualSource(id, resolved);
  }
  refreshSourcesForAllDevices() {
    const devices = this.registry.listVirtualDevices();
    devices.forEach((device) => {
      const baseSource = this.baseSources.get(device.id) ?? device.source;
      if (!baseSource) {
        return;
      }
      const resolved = this.applySourceOverrides(baseSource);
      this.registry.setVirtualSource(device.id, resolved);
      this.proxy.updateVirtualSource(device.id, resolved);
    });
  }
  handleVirtualFrame(deviceId, frameIndex, timestamp) {
    const info = { deviceId, frameIndex, timestamp };
    this.resolveFrameWaiters(deviceId, info);
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
  waitForFrame(deviceId) {
    const key = deviceId ?? "*";
    return new Promise((resolve) => {
      const waiters = this.frameWaiters.get(key) ?? [];
      waiters.push(resolve);
      this.frameWaiters.set(key, waiters);
    });
  }
  async waitForFrames(count, deviceId) {
    let info = {
      deviceId: deviceId ?? "*",
      frameIndex: 0,
      timestamp: 0
    };
    for (let i = 0; i < count; i += 1) {
      info = await this.waitForFrame(deviceId);
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

// packages/camera/src/index.ts
var RealCamera = new RealCameraCore();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RealCamera
});
