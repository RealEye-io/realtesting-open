import { notAllowedError } from "../utils/errors";
import { VirtualRTCDataChannel } from "./VirtualRTCDataChannel";
import { getPeer, registerPeer, unregisterPeer } from "./VirtualPeerRegistry";
import { getRealTestingTiming } from "../utils/realtestingTiming";

type VirtualSdpOffer = {
  rt: "realtesting-webrtc";
  v: 1;
  type: "offer";
  offerId: string;
};

type VirtualSdpAnswer = {
  rt: "realtesting-webrtc";
  v: 1;
  type: "answer";
  offerId: string;
  answerId: string;
};

type VirtualSdp = VirtualSdpOffer | VirtualSdpAnswer;

function generatePeerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `rt-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}

function safeParseSdp(sdp: string | undefined | null): VirtualSdp | null {
  if (!sdp) {
    return null;
  }
  try {
    const parsed = JSON.parse(sdp) as Partial<VirtualSdp>;
    if (parsed && parsed.rt === "realtesting-webrtc" && parsed.v === 1) {
      return parsed as VirtualSdp;
    }
  } catch {
    // ignore
  }
  return null;
}

function safeEvent(name: string): Event {
  try {
    return new Event(name);
  } catch {
    return { type: name } as unknown as Event;
  }
}

export class VirtualRTCPeerConnection extends EventTarget {
  readonly id: string;

  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  signalingState: RTCSignalingState = "stable";
  connectionState: RTCPeerConnectionState = "new";
  iceGatheringState: RTCIceGatheringState = "new";

  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onnegotiationneeded: ((event: Event) => void) | null = null;
  onconnectionstatechange: ((event: Event) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;

  private closed = false;
  private pairedPeerId: string | null = null;
  private negotiationNeededScheduled = false;
  private remoteOfferId: string | null = null;

  private channels: VirtualRTCDataChannel[] = [];
  private tracks: Array<{ track: MediaStreamTrack; streams: MediaStream[] }> = [];

  constructor(_configuration?: RTCConfiguration) {
    super();
    this.id = generatePeerId();
    registerPeer(this);
  }

  createDataChannel(label: string, init?: RTCDataChannelInit): RTCDataChannel {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const channel = new VirtualRTCDataChannel(label, init);
    this.channels.push(channel);

    // Creating a data channel requires negotiation in typical WebRTC flows.
    this.scheduleNegotiationNeeded();

    // If we're already paired, link and open negotiated channels.
    const peer = this.pairedPeerId ? getPeer(this.pairedPeerId) : undefined;
    if (peer) {
      this.linkChannels(peer);
    }

    return channel as unknown as RTCDataChannel;
  }

  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    const streamList = streams.length > 0 ? streams : [];
    this.tracks.push({ track, streams: streamList });
    this.scheduleNegotiationNeeded();

    const sender = { track } as unknown as RTCRtpSender;

    const peer = this.pairedPeerId ? getPeer(this.pairedPeerId) : undefined;
    if (peer) {
      peer.dispatchRemoteTrack(track, streamList);
    }

    return sender;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }
    return { type: "offer", sdp: JSON.stringify({ rt: "realtesting-webrtc", v: 1, type: "offer", offerId: this.id } satisfies VirtualSdpOffer) };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
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
        answerId: this.id,
      } satisfies VirtualSdpAnswer),
    };
  }

  async setLocalDescription(description?: RTCSessionDescriptionInit): Promise<void> {
    if (this.closed) {
      throw notAllowedError("RTCPeerConnection is closed.");
    }

    const next =
      description ??
      (this.remoteDescription?.type === "offer" ? await this.createAnswer() : await this.createOffer());

    this.localDescription = next;

    if (next.type === "offer") {
      this.signalingState = "have-local-offer";
    } else {
      this.signalingState = "stable";
    }

    this.iceGatheringState = "complete";
    this.dispatchIceCandidate(null);
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
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

  async addIceCandidate(_candidate?: RTCIceCandidateInit | RTCIceCandidate | null): Promise<void> {
    // No-op for in-memory connections.
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.signalingState = "closed";
    this.updateConnectionState("closed");

    for (const channel of this.channels) {
      try {
        channel.close(1000, "PeerConnection closed");
      } catch {
        // ignore
      }
    }
    unregisterPeer(this.id);
  }

  private scheduleNegotiationNeeded(): void {
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

  private dispatchIceCandidate(candidate: RTCIceCandidate | null): void {
    if (!this.onicecandidate) {
      return;
    }
    try {
      this.onicecandidate({ candidate } as RTCPeerConnectionIceEvent);
    } catch {
      // ignore
    }
  }

  private updateConnectionState(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    const event = safeEvent("connectionstatechange");
    this.dispatchEvent(event);
    this.onconnectionstatechange?.(event);
  }

  private pairWith(answerPeerId: string, expectedOfferId?: string): void {
    if (this.closed || this.pairedPeerId) {
      return;
    }

    const peer = getPeer(answerPeerId);
    if (!peer || peer.closed) {
      return;
    }

    // If an offerId was encoded, ensure it matches our own id for sanity.
    if (expectedOfferId && expectedOfferId !== this.id) {
      return;
    }

    this.pairedPeerId = peer.id;
    peer.pairedPeerId = this.id;

    this.updateConnectionState("connected");
    peer.updateConnectionState("connected");

    this.linkChannels(peer);
    peer.linkChannels(this);

    // Push any existing tracks over immediately.
    for (const { track, streams } of this.tracks) {
      peer.dispatchRemoteTrack(track, streams);
    }
    for (const { track, streams } of peer.tracks) {
      this.dispatchRemoteTrack(track, streams);
    }
  }

  private linkChannels(peer: VirtualRTCPeerConnection): void {
    const localByKey = new Map<string, VirtualRTCDataChannel>();
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

      // Already linked.
      if ((local as any).peer || (remote as any).peer) {
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

  private channelKey(channel: VirtualRTCDataChannel): string | null {
    const id = channel.id;
    if (typeof id === "number") {
      return `id:${id}`;
    }
    return `label:${channel.label}`;
  }

  private dispatchRemoteTrack(track: MediaStreamTrack, streams: MediaStream[]): void {
    if (!this.ontrack) {
      return;
    }
    queueMicrotask(() => {
      if (this.closed) {
        return;
      }
      try {
        this.ontrack?.({ track, streams } as unknown as RTCTrackEvent);
      } catch {
        // ignore
      }
    });
  }
}

