import { test, expect } from "./fixtures/test";

test("ET-like getDisplayMedia constraints work in virtual mode (max bounds + extra fields)", async ({ page }) => {
  await page.goto("/?realtestingTest=1");
  await page.waitForFunction(() => (window as any).__realtestingTestApi);

  await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    await api.configure({
      captureMode: "virtual",
      virtualPermission: "allow",
      blockNativeDisplayMedia: true,
      virtualSourceOverride: { type: "pattern", text: "ET Compat" },
    });
  });

  const result = await page.evaluate(async () => {
    const constraints: any = {
      video: {
        frameRate: 15,
        cursor: "always",
        displaySurface: "window",
        systemAudio: true,
        width: { max: 800 },
        height: { max: 600 },
      },
      audio: { channelCount: 2, sampleRate: 44000 },
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

    const preview = document.querySelector<HTMLVideoElement>("#preview");
    if (!preview) {
      throw new Error("Demo preview video element (#preview) not found");
    }
    preview.srcObject = stream;
    await preview.play().catch(() => undefined);

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (preview.videoWidth > 0 && preview.videoHeight > 0 && preview.readyState >= 2) {
        break;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }
    if (preview.videoWidth === 0 || preview.videoHeight === 0) {
      throw new Error("Timed out waiting for preview video dimensions");
    }

    const dims = { width: preview.videoWidth, height: preview.videoHeight };
    const trackCounts = {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length,
    };

    // ET Platform website recording flow mixes microphone + system audio via WebAudio.
    // This verifies the screen audio track is compatible with AudioContext mixing when present.
    let audioMixingOk = true;
    const screenAudioTrack = stream.getAudioTracks()[0];
    if (screenAudioTrack) {
      try {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const systemAudioSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
        systemAudioSource.connect(destination);

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();

        audioMixingOk = destination.stream.getAudioTracks().length > 0;
        oscillator.stop();
        await audioContext.close();
      } catch {
        audioMixingOk = false;
      }
    }

    // Hosted session flow: tracks should be addTrack-able to WebRTC.
    const pc = new RTCPeerConnection();
    const senders: Array<RTCRtpSender | null> = [];
    try {
      senders.push(pc.addTrack(stream.getVideoTracks()[0], stream));
      if (stream.getAudioTracks()[0]) {
        senders.push(pc.addTrack(stream.getAudioTracks()[0], stream));
      }
    } finally {
      pc.close();
    }

    stream.getTracks().forEach((t) => t.stop());
    preview.srcObject = null;
    return { dims, trackCounts, senderCount: senders.filter(Boolean).length, audioMixingOk };
  });

  expect(result.trackCounts.video).toBe(1);
  expect(result.dims).toEqual({ width: 800, height: 600 });
  expect(result.trackCounts.audio === 0 || result.trackCounts.audio === 1).toBe(true);
  expect(result.senderCount).toBeGreaterThanOrEqual(1);
  expect(result.audioMixingOk).toBe(true);
});

test("ET-like MediaRecorder usage can record a non-empty webm from virtual display media", async ({ page }) => {
  await page.goto("/?realtestingTest=1");
  await page.waitForFunction(() => (window as any).__realtestingTestApi);

  await page.evaluate(async () => {
    const api = (window as any).__realtestingTestApi;
    await api.configure({
      captureMode: "virtual",
      virtualPermission: "allow",
      blockNativeDisplayMedia: true,
      virtualSourceOverride: { type: "pattern", text: "ET Recorder" },
    });
  });

  const recording = await page.evaluate(async () => {
    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is not available in this browser environment");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30, cursor: "always", displaySurface: "window" } as any,
      audio: true,
    } as any);

    const options = {
      mimeType: "video/webm; codecs=h264,opus",
      videoBitsPerSecond: 20000000,
      audioBitsPerSecond: 128000,
    };

    let recorder: MediaRecorder;
    let usedFallback = false;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      usedFallback = true;
      recorder = new MediaRecorder(stream);
    }

    const chunks: Blob[] = [];
    let firstChunkResolve: (() => void) | null = null;
    const firstChunk = new Promise<void>((resolve) => {
      firstChunkResolve = resolve;
    });
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
        firstChunkResolve?.();
        firstChunkResolve = null;
      }
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(100);

    // Wait for at least one chunk to avoid racing stop() before any frame is captured.
    await Promise.race([firstChunk, new Promise<void>((resolve) => window.setTimeout(resolve, 3000))]);

    await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    recorder.stop();
    const stoppedOk = await Promise.race([
      stopped.then(() => true),
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 5000)),
    ]);
    if (!stoppedOk) {
      throw new Error("Timed out waiting for MediaRecorder to stop");
    }

    stream.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    return {
      size: blob.size,
      chunks: chunks.length,
      mimeType: recorder.mimeType,
      usedFallback,
    };
  });

  expect(recording.chunks, "expected at least 1 recorded chunk").toBeGreaterThan(0);
  expect(recording.size, "expected non-empty recording").toBeGreaterThan(0);
  expect(typeof recording.mimeType).toBe("string");
  expect(typeof recording.usedFallback).toBe("boolean");
});
