import type { VirtualFrameSource } from "../types";

export type VirtualDisplayFrameInfo = {
  width: number;
  height: number;
  frameIndex: number;
  timestamp: number;
};

type SilentAudioResources = {
  audioContext: AudioContext;
  oscillator: OscillatorNode;
  gain: GainNode;
  destination: MediaStreamAudioDestinationNode;
};

function drawSource(
  ctx: CanvasRenderingContext2D,
  info: VirtualDisplayFrameInfo,
  source: VirtualFrameSource
): void {
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
          result.catch(() => undefined);
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

function buildDefaultSource(): VirtualFrameSource {
  return { type: "pattern", text: "RealTesting" };
}

function nowMs(): number {
  // Prefer performance.now for monotonic timestamps in tests.
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function tryCreateSilentAudioTrack(): { track: MediaStreamTrack; resources: SilentAudioResources } | null {
  try {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();

    // Some environments start the context suspended; best-effort resume.
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined);
    }

    const track = destination.stream.getAudioTracks()[0];
    if (!track) {
      oscillator.stop();
      audioContext.close().catch(() => undefined);
      return null;
    }
    return { track, resources: { audioContext, oscillator, gain, destination } };
  } catch {
    return null;
  }
}

export class VirtualDisplayStream {
  readonly stream: MediaStream;
  readonly videoTrack: MediaStreamTrack;
  readonly audioTrack?: MediaStreamTrack;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private source: VirtualFrameSource;
  private timerId: number | null = null;
  private stopped = false;
  private frameIndex = 0;
  private audioResources: SilentAudioResources | null = null;
  private onFrame?: (info: { frameIndex: number; timestamp: number }) => void;

  constructor(options: {
    width: number;
    height: number;
    frameRate: number;
    audioRequested: boolean;
    source?: VirtualFrameSource;
    onFrame?: (info: { frameIndex: number; timestamp: number }) => void;
  }) {
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

    const intervalMs =
      options.frameRate && options.frameRate > 0 ? Math.max(1, Math.round(1000 / options.frameRate)) : 33;
    this.timerId = window.setInterval(() => this.drawTick(), intervalMs);

    this.videoTrack.addEventListener("ended", () => {
      this.stop();
    });
    this.audioTrack?.addEventListener("ended", () => {
      // audio track may be stopped externally; keep stream consistent.
    });
  }

  updateSource(source?: VirtualFrameSource): void {
    this.source = source ?? buildDefaultSource();
  }

  stop(): void {
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
          // ignore
        }
      });
    } catch {
      // ignore
    }

    if (this.audioResources) {
      try {
        this.audioResources.oscillator.stop();
      } catch {
        // ignore
      }
      this.audioResources.audioContext.close().catch(() => undefined);
      this.audioResources = null;
    }
  }

  private drawTick(): void {
    if (this.stopped) {
      return;
    }
    const timestamp = nowMs();
    const info: VirtualDisplayFrameInfo = {
      width: this.canvas.width,
      height: this.canvas.height,
      frameIndex: this.frameIndex,
      timestamp,
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
}

