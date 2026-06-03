import type {
  ResolvedVideoConstraints,
  VirtualDeviceState,
  VirtualFrameInfo,
  VirtualFrameSource,
} from "../types";
import {
  applyVideoConstraintsOverride,
  resolveVideoConstraints,
} from "../utils/constraints";
import { FrameScheduler } from "./FrameScheduler";

export class VirtualStream {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scheduler: FrameScheduler;
  private mediaStream: MediaStream;
  private track: MediaStreamTrack;
  private source?: VirtualFrameSource;
  private settings: ResolvedVideoConstraints;
  private constraintOverride?: MediaTrackConstraints;

  constructor(
    device: VirtualDeviceState,
    constraints?: MediaTrackConstraints,
    onFrame?: (info: VirtualFrameInfo) => void,
    constraintOverride?: MediaTrackConstraints
  ) {
    this.constraintOverride = constraintOverride;
    const resolved = resolveVideoConstraints(
      applyVideoConstraintsOverride(constraints, this.constraintOverride),
      device.defaultConstraints as Partial<ResolvedVideoConstraints>
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
        frameIndex,
      };
      this.drawFrame(info);
      onFrame?.(info);
    });
  }

  get stream(): MediaStream {
    return this.mediaStream;
  }

  get videoTrack(): MediaStreamTrack {
    return this.track;
  }

  updateSource(source?: VirtualFrameSource): void {
    this.source = source;
  }

  setConstraintOverride(constraintOverride?: MediaTrackConstraints): void {
    this.constraintOverride = constraintOverride;
    this.updateConstraints();
  }

  updateConstraints(constraints?: MediaTrackConstraints): void {
    const resolved = resolveVideoConstraints(
      applyVideoConstraintsOverride(constraints, this.constraintOverride),
      this.settings
    );
    this.settings = resolved;
    this.canvas.width = resolved.width;
    this.canvas.height = resolved.height;
    this.scheduler.updateFps(resolved.frameRate);
  }

  stop(): void {
    this.scheduler.stop();
    this.mediaStream.getTracks().forEach((track) => track.stop());
  }

  private installTrackHooks(): void {
    const originalApplyConstraints = this.track.applyConstraints.bind(this.track);
    const originalGetSettings = this.track.getSettings.bind(this.track);

    this.track.applyConstraints = async (
      constraints?: MediaTrackConstraints
    ): Promise<void> => {
      if (constraints) {
        this.updateConstraints(constraints);
      }
      try {
        await originalApplyConstraints(constraints);
      } catch {
        // Ignore native errors; we control the virtual stream.
      }
    };

    this.track.getSettings = (): MediaTrackSettings => {
      const nativeSettings = originalGetSettings();
      return {
        ...nativeSettings,
        width: this.settings.width,
        height: this.settings.height,
        frameRate: this.settings.frameRate,
      };
    };

    this.track.addEventListener("ended", () => {
      this.stop();
    });
  }

  private drawFrame(info: VirtualFrameInfo): void {
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
}
