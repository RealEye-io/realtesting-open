export class FrameScheduler {
  private timerId: number | null = null;
  private frameIndex = 0;
  private fps: number;
  private callback: ((timestamp: number, frameIndex: number) => void) | null =
    null;

  constructor(fps: number) {
    this.fps = fps;
  }

  start(callback: (timestamp: number, frameIndex: number) => void): void {
    this.callback = callback;
    this.stop();
    this.frameIndex = 0;
    const interval = this.toInterval(this.fps);
    this.timerId = window.setInterval(() => {
      this.frameIndex += 1;
      this.callback?.(performance.now(), this.frameIndex);
    }, interval);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  updateFps(fps: number): void {
    this.fps = fps;
    if (this.callback) {
      this.start(this.callback);
    }
  }

  private toInterval(fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) {
      return 33;
    }
    return Math.max(5, Math.floor(1000 / fps));
  }
}
