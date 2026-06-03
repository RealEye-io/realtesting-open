# @realeye-io/realtesting-camera

Virtual webcam emulation (`navigator.mediaDevices.getUserMedia`) for automated browser testing.

This package is part of the [RealTesting](https://github.com/RealEye-io/realtesting-open) suite from [RealEye.io](https://www.realeye.io/). It provides a proxy-style wrapper around `getUserMedia` that returns native `MediaStream`/`MediaStreamTrack` objects with frame data drawn to an off-screen canvas.

**RealEye feature**: [Webcam Eye-Tracking](https://www.realeye.io/features/online-webcam-eyetracking)

## Installation

```bash
npm install @realeye-io/realtesting-camera
```

## Quick Start

```js
import { RealCamera } from '@realeye-io/realtesting-camera';

// Install the emulator
RealCamera.install();

// Now use the standard API — no hardware camera needed
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
```

## Modes

| Mode | Behavior |
|------|----------|
| `proxy` | Proxy `getUserMedia` — virtual devices appear alongside real ones (default) |
| `explicit` | Only virtual devices; real devices are hidden |

## Permission Control

| Setting | Behavior |
|---------|----------|
| `allow` | Permission is always granted |
| `prompt` | Block until a test responds via the test API |
| `deny` | Permission is always denied |

## Virtual Frame Sources

Virtual camera streams can render from multiple sources:

```js
// Canvas element
{ type: "canvas", element: myCanvas }

// Video element
{ type: "video", element: myVideo }

// Static image
{ type: "image", element: myImage }

// Custom callback (draw each frame)
{ type: "callback", draw: (ctx, info) => {
  // ctx: CanvasRenderingContext2D
  // info: { width, height, timestamp, frameIndex }
}}
```

## Device Management

```js
// Register a virtual device
RealCamera.addVirtualDevice({
  label: "My Virtual Camera",
  defaultConstraints: { width: 1280, height: 720, frameRate: 30 }
});

// Update device settings
RealCamera.updateVirtualDevice(deviceId, { enabled: false });

// Remove device
RealCamera.removeVirtualDevice(deviceId);
```

## Pre-Permission Enumeration Profiles

Control what virtual device metadata looks like before camera permission is granted:

| Profile | Behavior |
|---------|----------|
| `legacy` | Real `deviceId`/`groupId`, empty label |
| `anonymous-all` | Blank `deviceId`/`groupId`/label, preserve device count |
| `single-anonymous` | One anonymous camera placeholder |

## Demo Apps

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
npm run dev:face    # https://localhost:4173 (MediaPipe face detection)
npm run dev:proxy   # https://localhost:4174 (device list / toggles)
```

## Test API

When test mode is enabled (`?realcameraTest=1` or `?realtestingTest=1`), the test API is available at `window.__realcameraTestApi`:

```js
// Configure virtual permission prompt
await window.__realcameraTestApi.configure({
  virtualPermission: "prompt",
  permissionPromptMode: "manual",
  prePermissionEnumerateProfile: "anonymous-all"
});

// Wait for and respond to permission request
const request = await window.__realcameraTestApi.waitForPermissionRequest();
await window.__realcameraTestApi.respondToPermissionRequest(request.id, true);

// Override video constraints for deterministic testing
await window.__realcameraTestApi.configure({
  virtualVideoConstraintsOverride: { width: 640, height: 480, frameRate: 30 }
});
```

## Realistic Timing

Enable simulated latency for hardware-like async behavior:

```js
window.__REALTESTING_TIMING_CONFIG__ = { profile: "ciRealistic" };
```

## Resources

| Resource | Link |
|----------|------|
| RealTesting monorepo | [GitHub](https://github.com/RealEye-io/realtesting-open) |
| Full documentation | [README.md](https://github.com/RealEye-io/realtesting-open/blob/main/README.md) |
| npm page | [npmjs](https://www.npmjs.com/package/@realeye-io/realtesting-camera) |
| Issues | [GitHub Issues](https://github.com/RealEye-io/realtesting-open/issues) |
| License | MIT |
