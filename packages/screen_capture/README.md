# @realeye-io/realtesting-screen-capture

Deterministic screen capture emulation (`navigator.mediaDevices.getDisplayMedia`) for automated browser testing.

This package is part of the [RealTesting](https://github.com/RealEye-io/realtesting-open) suite from [RealEye.io](https://www.realeye.io/). It provides a proxy-style wrapper around `getDisplayMedia` that returns virtual `MediaStream` objects — no interactive browser prompts required.

**RealEye feature**: [Screen Recording](https://www.realeye.io/features/online-webcam-eyetracking)

## Installation

```bash
npm install @realeye-io/realtesting-screen-capture
```

## Quick Start

```js
import { RealScreenCapture } from '@realeye-io/realtesting-screen-capture';

// Install the emulator
RealScreenCapture.install();

// Now use the standard API — it works without browser prompts
const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
```

## Modes

| Mode | Behavior |
|------|----------|
| `virtual` | Always return virtual stream (default) |
| `native` | Always delegate to real `getDisplayMedia` |
| `prefer-virtual` | Try virtual first, fall back to native |
| `prefer-native` | Try native first, fall back to virtual |

## Permission Control

| Setting | Behavior |
|---------|----------|
| `allow` | Permission is always granted |
| `prompt` | Block until a test responds via the test API |
| `deny` | Permission is always denied |

## Virtual Frame Sources

Virtual display streams can render content from multiple sources:

```js
// Blank color frame
{ type: "blank", color: "#1a1a2e", text: "Virtual Display" }

// From an image element
{ type: "image", element: myImage }

// From a video element
{ type: "video", element: myVideo }

// Custom callback (draw each frame)
{ type: "callback", draw: (ctx, info) => { /* draw to canvas 2D context */ } }
```

## Demo App

A fully functional demo is available in this repository:

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
npm run dev:screen  # https://localhost:4175
```

## Test API

When test mode is enabled (`?realtestingTest=1` or via config), the test API is available at `window.__realtestingTestApi`:

```js
// Configure via test API
await window.__realtestingTestApi.configure({
  captureMode: "virtual",
  virtualPermission: "prompt",
  permissionPromptMode: "manual"
});

// Respond to pending permission prompts
const prompt = await window.__realtestingTestApi.waitForPermissionPrompt();
await window.__realtestingTestApi.respondToPermissionPrompt(prompt.id, true);
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
| npm page | [npmjs](https://www.npmjs.com/package/@realeye-io/realtesting-screen-capture) |
| Issues | [GitHub Issues](https://github.com/RealEye-io/realtesting-open/issues) |
| License | MIT |
