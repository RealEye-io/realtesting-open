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

// packages/webrtc/src/index.ts
var index_exports = {};
__export(index_exports, {
  RealWebRTC: () => RealWebRTC
});
module.exports = __toCommonJS(index_exports);

// packages/webrtc/src/utils/errors.ts
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

// packages/webrtc/src/utils/realtestingTiming.ts
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
      "webrtc.negotiation": { minMs: 30, maxMs: 1500 },
      "webrtc.datachannel.open": { minMs: 30, maxMs: 1200 },
      "webrtc.datachannel.message": { minMs: 5, maxMs: 120 }
    };
  }
  if (profile === "ciRealistic") {
    return {
      "webrtc.negotiation": { minMs: 10, maxMs: 250 },
      "webrtc.datachannel.open": { minMs: 10, maxMs: 350 },
      "webrtc.datachannel.message": { minMs: 1, maxMs: 30 }
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

// packages/webrtc/src/core/VirtualRTCDataChannel.ts
function safeMessageEvent(data) {
  try {
    return new MessageEvent("message", { data });
  } catch {
    const event = new Event("message");
    event.data = data;
    return event;
  }
}
function payloadSize(data) {
  if (typeof data === "string") {
    return data.length;
  }
  if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
    return data.byteLength;
  }
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data.size;
  }
  return 1;
}
var VirtualRTCDataChannel = class extends EventTarget {
  label;
  id;
  negotiated;
  ordered;
  maxPacketLifeTime;
  maxRetransmits;
  readyState = "connecting";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  binaryType = "blob";
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
  onbufferedamountlow = null;
  peer = null;
  closeReason = null;
  constructor(label, init = {}) {
    super();
    this.label = label;
    this.id = typeof init.id === "number" ? init.id : null;
    this.negotiated = init.negotiated === true;
    this.ordered = init.ordered !== false;
    this.maxPacketLifeTime = typeof init.maxPacketLifeTime === "number" ? init.maxPacketLifeTime : null;
    this.maxRetransmits = typeof init.maxRetransmits === "number" ? init.maxRetransmits : null;
  }
  _linkPeer(peer) {
    this.peer = peer;
  }
  _open() {
    if (this.readyState === "closed") {
      return;
    }
    this.readyState = "open";
    const event = new Event("open");
    this.dispatchEvent(event);
    this.onopen?.(event);
  }
  _receive(data) {
    if (this.readyState !== "open") {
      return;
    }
    const event = safeMessageEvent(data);
    this.dispatchEvent(event);
    this.onmessage?.(event);
  }
  _remoteClose(code, reason) {
    if (this.readyState === "closed") {
      return;
    }
    this.closeReason = { code, reason };
    this.readyState = "closed";
    const event = new Event("close");
    this.dispatchEvent(event);
    this.onclose?.(event);
  }
  send(data) {
    if (this.readyState !== "open") {
      throw new DOMException("DataChannel is not open.", "InvalidStateError");
    }
    const size = payloadSize(data);
    this.bufferedAmount += size;
    const timing = getRealTestingTiming("webrtc");
    const delayMs = timing.enabled ? timing.sampleMs("webrtc.datachannel.message") : 0;
    const schedule = (fn) => {
      if (delayMs <= 0) {
        queueMicrotask(fn);
      } else {
        window.setTimeout(fn, Math.max(0, delayMs));
      }
    };
    schedule(() => {
      this.bufferedAmount = Math.max(0, this.bufferedAmount - size);
      this.peer?._receive(data);
      if (this.bufferedAmount <= this.bufferedAmountLowThreshold) {
        const low = new Event("bufferedamountlow");
        this.dispatchEvent(low);
        this.onbufferedamountlow?.(low);
      }
    });
  }
  close(code, reason) {
    if (this.readyState === "closed") {
      return;
    }
    this.readyState = "closed";
    const event = new Event("close");
    this.dispatchEvent(event);
    this.onclose?.(event);
    this.peer?._remoteClose(code, reason);
  }
};

// packages/webrtc/src/core/VirtualPeerRegistry.ts
var peers = /* @__PURE__ */ new Map();
function registerPeer(peer) {
  peers.set(peer.id, peer);
}
function unregisterPeer(peerId) {
  peers.delete(peerId);
}
function getPeer(peerId) {
  return peers.get(peerId);
}
function listPeers() {
  return Array.from(peers.values()).map((peer) => ({
    id: peer.id,
    connectionState: peer.connectionState,
    signalingState: peer.signalingState
  }));
}
function closeAllPeers() {
  const current = Array.from(peers.values());
  for (const peer of current) {
    try {
      peer.close();
    } catch {
    }
  }
}

// packages/webrtc/src/core/VirtualRTCPeerConnection.ts
function generatePeerId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `rt-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}
function safeParseSdp(sdp) {
  if (!sdp) {
    return null;
  }
  try {
    const parsed = JSON.parse(sdp);
    if (parsed && parsed.rt === "realtesting-webrtc" && parsed.v === 1) {
      return parsed;
    }
  } catch {
  }
  return null;
}
function safeEvent(name) {
  try {
    return new Event(name);
  } catch {
    return { type: name };
  }
}
var VirtualRTCPeerConnection = class extends EventTarget {
  id;
  localDescription = null;
  remoteDescription = null;
  signalingState = "stable";
  connectionState = "new";
  iceGatheringState = "new";
  onicecandidate = null;
  onnegotiationneeded = null;
  onconnectionstatechange = null;
  ontrack = null;
  ondatachannel = null;
  closed = false;
  pairedPeerId = null;
  negotiationNeededScheduled = false;
  remoteOfferId = null;
  channels = [];
  tracks = [];
  constructor(_configuration) {
    super();
    this.id = generatePeerId();
    registerPeer(this);
  }
  createDataChannel(label, init) {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const channel = new VirtualRTCDataChannel(label, init);
    this.channels.push(channel);
    this.scheduleNegotiationNeeded();
    const peer = this.pairedPeerId ? getPeer(this.pairedPeerId) : void 0;
    if (peer) {
      this.linkChannels(peer);
    }
    return channel;
  }
  addTrack(track, ...streams) {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const streamList = streams.length > 0 ? streams : [];
    this.tracks.push({ track, streams: streamList });
    this.scheduleNegotiationNeeded();
    const sender = { track };
    const peer = this.pairedPeerId ? getPeer(this.pairedPeerId) : void 0;
    if (peer) {
      peer.dispatchRemoteTrack(track, streamList);
    }
    return sender;
  }
  async createOffer() {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    return { type: "offer", sdp: JSON.stringify({ rt: "realtesting-webrtc", v: 1, type: "offer", offerId: this.id }) };
  }
  async createAnswer() {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const remote = this.remoteDescription;
    if (!remote || remote.type !== "offer") {
      throw new DOMException("No remote offer available.", "InvalidStateError");
    }
    const parsed = safeParseSdp(remote.sdp);
    const offerId = parsed && parsed.type === "offer" ? parsed.offerId : this.remoteOfferId;
    if (!offerId) {
      throw new DOMException("Invalid virtual offer SDP.", "InvalidAccessError");
    }
    return {
      type: "answer",
      sdp: JSON.stringify({
        rt: "realtesting-webrtc",
        v: 1,
        type: "answer",
        offerId,
        answerId: this.id
      })
    };
  }
  async setLocalDescription(description) {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const next = description ?? (this.remoteDescription?.type === "offer" ? await this.createAnswer() : await this.createOffer());
    this.localDescription = next;
    if (next.type === "offer") {
      this.signalingState = "have-local-offer";
    } else {
      this.signalingState = "stable";
    }
    this.iceGatheringState = "complete";
    this.dispatchIceCandidate(null);
  }
  async setRemoteDescription(description) {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    this.remoteDescription = description;
    if (description.type === "offer") {
      this.signalingState = "have-remote-offer";
      const parsed = safeParseSdp(description.sdp);
      if (parsed && parsed.type === "offer") {
        this.remoteOfferId = parsed.offerId;
      }
      return;
    }
    if (description.type === "answer") {
      this.signalingState = "stable";
      const parsed = safeParseSdp(description.sdp);
      if (parsed && parsed.type === "answer") {
        this.pairWith(parsed.answerId, parsed.offerId);
      }
      return;
    }
  }
  async addIceCandidate(_candidate) {
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.signalingState = "closed";
    this.updateConnectionState("closed");
    for (const channel of this.channels) {
      try {
        channel.close(1e3, "PeerConnection closed");
      } catch {
      }
    }
    unregisterPeer(this.id);
  }
  scheduleNegotiationNeeded() {
    if (this.negotiationNeededScheduled || this.closed) {
      return;
    }
    this.negotiationNeededScheduled = true;
    const timing = getRealTestingTiming("webrtc");
    const delayMs = timing.enabled ? timing.sampleMs("webrtc.negotiation") : 0;
    if (delayMs <= 0) {
      queueMicrotask(() => {
        this.negotiationNeededScheduled = false;
        if (this.closed) {
          return;
        }
        const event = safeEvent("negotiationneeded");
        this.dispatchEvent(event);
        this.onnegotiationneeded?.(event);
      });
      return;
    }
    window.setTimeout(() => {
      this.negotiationNeededScheduled = false;
      if (this.closed) {
        return;
      }
      const event = safeEvent("negotiationneeded");
      this.dispatchEvent(event);
      this.onnegotiationneeded?.(event);
    }, Math.max(0, delayMs));
  }
  dispatchIceCandidate(candidate) {
    if (!this.onicecandidate) {
      return;
    }
    try {
      this.onicecandidate({ candidate });
    } catch {
    }
  }
  updateConnectionState(state) {
    this.connectionState = state;
    const event = safeEvent("connectionstatechange");
    this.dispatchEvent(event);
    this.onconnectionstatechange?.(event);
  }
  pairWith(answerPeerId, expectedOfferId) {
    if (this.closed || this.pairedPeerId) {
      return;
    }
    const peer = getPeer(answerPeerId);
    if (!peer || peer.closed) {
      return;
    }
    if (expectedOfferId && expectedOfferId !== this.id) {
      return;
    }
    this.pairedPeerId = peer.id;
    peer.pairedPeerId = this.id;
    this.updateConnectionState("connected");
    peer.updateConnectionState("connected");
    this.linkChannels(peer);
    peer.linkChannels(this);
    for (const { track, streams } of this.tracks) {
      peer.dispatchRemoteTrack(track, streams);
    }
    for (const { track, streams } of peer.tracks) {
      this.dispatchRemoteTrack(track, streams);
    }
  }
  linkChannels(peer) {
    const localByKey = /* @__PURE__ */ new Map();
    for (const channel of this.channels) {
      const key = this.channelKey(channel);
      if (key) {
        localByKey.set(key, channel);
      }
    }
    for (const remote of peer.channels) {
      const key = peer.channelKey(remote);
      if (!key) {
        continue;
      }
      const local = localByKey.get(key);
      if (!local) {
        continue;
      }
      if (local.peer || remote.peer) {
        continue;
      }
      local._linkPeer(remote);
      remote._linkPeer(local);
      const timing = getRealTestingTiming("webrtc");
      const delayMs = timing.enabled ? timing.sampleMs("webrtc.datachannel.open") : 0;
      if (delayMs <= 0) {
        local._open();
        remote._open();
      } else {
        window.setTimeout(() => {
          local._open();
          remote._open();
        }, Math.max(0, delayMs));
      }
    }
  }
  channelKey(channel) {
    const id = channel.id;
    if (typeof id === "number") {
      return `id:${id}`;
    }
    return `label:${channel.label}`;
  }
  dispatchRemoteTrack(track, streams) {
    if (!this.ontrack) {
      return;
    }
    queueMicrotask(() => {
      if (this.closed) {
        return;
      }
      try {
        this.ontrack?.({ track, streams });
      } catch {
      }
    });
  }
};

// packages/webrtc/src/core/RTCPeerConnectionProxy.ts
function shouldUseVirtual(mode, blockNative, hasNative) {
  switch (mode) {
    case "virtual":
      return true;
    case "native":
      return false;
    case "prefer-virtual":
      return true;
    case "prefer-native":
    default:
      if (hasNative && !blockNative) {
        return false;
      }
      return true;
  }
}
function createRTCPeerConnectionProxy(params) {
  const Native = params.nativeCtor;
  const Proxy2 = class RTCPeerConnectionProxy {
    constructor(configuration) {
      const mode = params.getMode();
      const blockNative = params.getBlockNative();
      const hasNative = typeof Native === "function";
      const useVirtual = shouldUseVirtual(mode, blockNative, hasNative);
      if (!useVirtual) {
        if (blockNative) {
          throw notAllowedError("Native RTCPeerConnection is blocked by RealTesting.");
        }
        if (!Native) {
          throw notAllowedError("Native RTCPeerConnection is not available in this environment.");
        }
        return new Native(configuration);
      }
      return new VirtualRTCPeerConnection(configuration);
    }
  };
  if (Native) {
    for (const key of Object.getOwnPropertyNames(Native)) {
      if (key in Proxy2) {
        continue;
      }
      try {
        Proxy2[key] = Native[key];
      } catch {
      }
    }
  }
  return Proxy2;
}

// packages/webrtc/src/core/RealWebRTCCore.ts
var DEFAULT_OPTIONS = {
  rtcMode: "prefer-native",
  blockNativePeerConnection: false
};
var DEFAULT_TEST_API_PROPERTY = "__realtestingWebrtcTestApi";
function getTestWindow() {
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}
function resolveTestSetup(options) {
  const testWindow = getTestWindow();
  const config = testWindow?.__REALTESTING_WEBRTC_TEST_CONFIG__ ?? null;
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
var RealWebRTCCore = class {
  installed = false;
  originalCtor = null;
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
      this.originalCtor = testWindow.RTCPeerConnection ?? null;
    }
    testWindow.RTCPeerConnection = createRTCPeerConnectionProxy({
      nativeCtor: this.originalCtor,
      getMode: () => this.options.rtcMode,
      getBlockNative: () => this.options.blockNativePeerConnection
    });
    this.installed = true;
  }
  uninstall() {
    const testWindow = getTestWindow();
    if (testWindow && this.originalCtor) {
      testWindow.RTCPeerConnection = this.originalCtor;
    }
    this.detachTestApi();
    this.installed = false;
  }
  setRtcMode(mode) {
    this.options = { ...this.options, rtcMode: mode };
  }
  getRtcMode() {
    return this.options.rtcMode;
  }
  setBlockNativePeerConnection(block) {
    this.options = { ...this.options, blockNativePeerConnection: block };
  }
  getBlockNativePeerConnection() {
    return this.options.blockNativePeerConnection;
  }
  closeAllVirtualConnections() {
    closeAllPeers();
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
      setRtcMode: (mode) => {
        this.applyTestConfig({ ...this.testConfig ?? {}, rtcMode: mode });
      },
      setBlockNativePeerConnection: (block) => {
        this.applyTestConfig({
          ...this.testConfig ?? {},
          blockNativePeerConnection: block
        });
      },
      closeAllVirtualConnections: () => {
        this.closeAllVirtualConnections();
      }
    };
    return this.testApi;
  }
  getState() {
    return {
      config: this.testConfig,
      rtcMode: this.options.rtcMode,
      blockNativePeerConnection: this.options.blockNativePeerConnection,
      virtualConnections: listPeers()
    };
  }
  applyTestConfig(config) {
    this.testConfig = { ...config };
    this.options = { ...this.installOptions };
    if (config.rtcMode) {
      this.options = { ...this.options, rtcMode: config.rtcMode };
    }
    if (typeof config.blockNativePeerConnection === "boolean") {
      this.options = { ...this.options, blockNativePeerConnection: config.blockNativePeerConnection };
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

// packages/webrtc/src/index.ts
var RealWebRTC = new RealWebRTCCore();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  RealWebRTC
});
