# RealTesting - Browser API Emulation for Automated Testing

[![npm version](https://badge.fury.io/js/@realeye-io/realtesting-screen-capture.svg)](https://badge.fury.io/js/@realeye-io/realtesting-screen-capture)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

RealTesting is a TypeScript library that provides deterministic, automation-friendly emulation for browser JavaScript APIs. It enables fully automated, headless end-to-end tests without interactive prompts or requiring local hardware.

This library is the test infrastructure behind [RealEye.io](https://www.realeye.io/), an online research platform that uses [webcam eye-tracking](https://www.realeye.io/features/online-webcam-eyetracking), [screen recording](https://www.realeye.io/features/online-webcam-eyetracking), [hosted sessions](https://www.realeye.io/features/online-webcam-eyetracking), and more. RealTesting ensures every feature ships with comprehensive, deterministic automated testing — from virtual camera streams to in-memory WebRTC connections.

## 📦 NPM Packages

RealTesting is available as five separate packages on npm:

| Package | Description | Install |
|---------|-------------|---------|
| [@realeye-io/realtesting-screen-capture](https://www.npmjs.com/package/@realeye-io/realtesting-screen-capture) | Screen capture emulation (`getDisplayMedia`) — powers [Screen Recording](https://www.realeye.io/features/online-webcam-eyetracking) | `npm install @realeye-io/realtesting-screen-capture` |
| [@realeye-io/realtesting-browser-features](https://www.npmjs.com/package/@realeye-io/realtesting-browser-features) | Browser features (fullscreen, popups, clipboard) — supports [How RealEye works?](https://www.realeye.io/features/online-webcam-eyetracking) | `npm install @realeye-io/realtesting-browser-features` |
| [@realeye-io/realtesting-camera](https://www.npmjs.com/package/@realeye-io/realtesting-camera) | Virtual webcam emulation (`getUserMedia`) — powers [webcam eye-tracking](https://www.realeye.io/features/online-webcam-eyetracking) | `npm install @realeye-io/realtesting-camera` |
| [@realeye-io/realtesting-webrtc](https://www.npmjs.com/package/@realeye-io/realtesting-webrtc) | In-memory WebRTC (`RTCPeerConnection`) — powers [Hosted Sessions](https://www.realeye.io/features/online-webcam-eyetracking) | `npm install @realeye-io/realtesting-webrtc` |
| [@realeye-io/realtesting-websocket](https://www.npmjs.com/package/@realeye-io/realtesting-websocket) | Virtual WebSocket servers — powers [Hosted Sessions](https://www.realeye.io/features/online-webcam-eyetracking) real-time communication | `npm install @realeye-io/realtesting-websocket` |

## 🚀 Quick Start

### 1. Install the packages you need

```bash
npm install @realeye-io/realtesting-camera @realeye-io/realtesting-screen-capture
```

### 2. Initialize in your HTML/JS

```html
<script type="module">
import { RealCamera } from '@realeye-io/realtesting-camera';
import { RealScreenCapture } from '@realeye-io/realtesting-screen-capture';

// Install the emulators
RealCamera.install();
RealScreenCapture.install();

// Now you can use standard browser APIs
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
// This will use the virtual camera instead of real hardware
</script>
```

### 3. Use in your tests

With RealTesting installed, your existing code that uses browser APIs will work in automated tests:

```typescript
// Your application code (unchanged)
const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
```

## 🎯 Use Cases

- **Automated E2E Testing**: Test screen recording and camera features in CI/CD pipelines
- **Headless Browser Testing**: Use with Playwright, Puppeteer, or other headless browsers
- **CI/CD Integration**: No hardware dependencies for camera/screen capture tests
- **Deterministic Testing**: Consistent virtual device behavior across test runs

## Principles

### Goals
- Proxy-style wrappers that preserve standard API signatures (drop-in for apps).
- Native browser objects where feasible (`MediaStream`, `MediaStreamTrack`, etc.).
- Deterministic behavior in CI/headless contexts.
- Runtime configuration switches (virtual/native/prefer-* modes).
- Test APIs gated behind explicit test enablement.

### Non-goals
- Bypassing the browser security model for real capture/permissions.
- OS-level virtual device drivers.
- Full spec parity for WebRTC/WebSocket (the emulation targets ET Platform usage patterns).

## Test Mode & Window Test APIs

Most emulators expose a window-scoped test API when test mode is enabled.

### Enablement

- Query params: `?realtestingTest=1` / `?realtesting-test=1`
- Or package-specific preload config (see package types)

### Default Window Properties

| Package | Window Property |
|---------|----------------|
| Screen capture | `window.__realtestingTestApi` |
| Browser features | `window.__realtestingBrowserTestApi` |
| WebRTC | `window.__realtestingWebrtcTestApi` |
| WebSocket | `window.__realtestingWebSocketTestApi` |
| RealCamera | `window.__realcameraTestApi` |

RealCamera is also auto-enabled via `?realcameraTest=1` / `?realcamera-test=1` and via `?realtestingTest=1` for unified RealTesting flows.

## Realistic Timing (Hardware / Permission Latency)

RealTesting supports an **optional** latency layer that makes emulated "hardware-ish" browser APIs behave asynchronously and more like real life (boot-up time, permission prompt delays, connect latency). This is primarily intended for E2E tests so app code is forced to handle async flows correctly.

### Enablement

By default, timing is **off**.

Enable via a window global (recommended for Playwright init scripts):

```js
window.__REALTESTING_TIMING_CONFIG__ = { profile, seed, randomMode, scale }
```

Or via query params:

- `?realtestingTiming=ciRealistic|realistic|off`
- `?realtestingSeed=123`
- `?realtestingRandom=seeded|true-random`
- `?realtestingTimingScale=0.5`

### Profiles

- `ciRealistic`: CI-safe delays (hundreds of ms range) that still enforce real async behavior.
- `realistic`: closer-to-life delays (can be seconds, e.g. webcam boot 1–5s).

Default mode is **seeded** (deterministic) so CI is stable. For stress testing, enable `randomMode: "true-random"`.

## Manual Permission Prompts

When `virtualPermission` is set to `"prompt"`, RealTesting can simulate permission prompts that **block** until a test responds via the window test APIs. This lets E2E tests verify that application code awaits permission properly, remains responsive while permission is pending, and handles allow/deny transitions.

### RealCamera Permission Prompt

```js
// Configure
window.__realcameraTestApi.configure({
  virtualPermission: "prompt",
  permissionPromptMode: "manual",
  prePermissionEnumerateProfile: "anonymous-all"
});

// Wait/respond
const request = await window.__realcameraTestApi.waitForPermissionRequest();
await window.__realcameraTestApi.respondToPermissionRequest(request.id, true);
```

Pre-permission enumerate profiles:
- `anonymous-all`: blank labels/device IDs while preserving device count
- `single-anonymous`: mimic browsers that expose only one anonymous camera placeholder

### Screen Capture Permission Prompt

```js
// Configure
window.__realtestingTestApi.configure({
  virtualPermission: "prompt",
  permissionPromptMode: "manual"
});

// Wait/respond
const prompt = await window.__realtestingTestApi.waitForPermissionPrompt();
await window.__realtestingTestApi.respondToPermissionPrompt(prompt.id, true);
```

## User Gesture Simulation

Some browser features require a user gesture in real browsers. In RealTesting, this can be enabled for tests:

```js
window.__realtestingBrowserTestApi.setRequireUserGesture(true);
```

RealTesting will treat events like `pointerdown` / `mousedown` / `keydown` / `touchstart` as gestures and will gate fullscreen/popup/clipboard actions accordingly.

## Demo Apps

Each demo app installs the relevant emulator(s) but calls only the standard browser APIs so it can serve as both documentation and an E2E test target.

| App | Port | Description |
|-----|------|-------------|
| `apps/face_detection_demo_app` | 4173 | RealCamera virtual webcam + MediaPipe face detector |
| `apps/webcam_proxy_demo_app` | 4174 | RealCamera proxy UI (device list, toggles, test API) |
| `apps/screen_capture_demo_app` | 4175 | Screen Capture API wrapper + virtual display stream |
| `apps/browser_features_demo_app` | 4176 | Fullscreen + `window.open` + clipboard patches |
| `apps/webrtc_demo_app` | 4177 | In-memory `RTCPeerConnection` + `RTCDataChannel` |
| `apps/websocket_demo_app` | 4178 | Virtual WebSocket echo server |

## 🛠️ Development

### Setup

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
```

### Build

```bash
# Build all packages
npm run build

# Verify dist artifacts are in sync
npm run verify:dist

# Type check
npm run typecheck
```

### Run Demo Apps

```bash
npm run dev:face         # Port 4173 - RealCamera face detection
npm run dev:proxy        # Port 4174 - RealCamera proxy UI
npm run dev:screen       # Port 4175 - Screen capture
npm run dev:features     # Port 4176 - Browser features
npm run dev:webrtc       # Port 4177 - WebRTC
npm run dev:websocket    # Port 4178 - WebSocket
```

### Run Tests

```bash
# All tests (unit + E2E)
npm test

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e
```

### Committed Package `dist` Artifacts

Library build outputs under `packages/*/dist` are intentionally committed in this repository:
- Each package publishes from `dist` (`main`, `module`, `types`, and `exports` point there).
- Other workspace consumers can use the package entrypoints without requiring a pack/publish step first.
- `npm run verify:dist` rebuilds the packages and fails if committed `dist` artifacts drift from source.

Rules:
- Keep `packages/*/dist` checked in and update it whenever package source changes.
- Keep demo/app build outputs ignored; this committed-artifact policy applies to package libraries only.
- After changing package source, run `npm run build` (or the relevant package build) before committing.

## Code Review Criteria

When reviewing RealTesting changes:

- Read `README.md` and `AGENTS.md` before reviewing implementation details.
- Preserve standard browser API semantics wherever the project intentionally mirrors native behavior; emulation should stay deterministic without inventing CI-only shortcuts that apps cannot realistically handle.
- Review package-library changes and demo-app changes separately. Package changes affect committed `packages/*/dist` artifacts and downstream consumers; demo changes are primarily validation/education surfaces.
- For WebRTC and WebSocket work, keep tests CI-friendly and avoid introducing real network dependencies.

Required validation for review sign-off:
- `npm test`
- Relevant demo-app smoke/E2E validation for touched emulator surfaces
- `npm run build` or package-specific build output verification when package source changed
- `npm run verify:dist` when committed package `dist` artifacts should change

High-risk regressions:
- Interactive permission or browser-prompt dependencies in CI
- Stale committed `packages/*/dist` outputs
- Emulator outputs that are no longer native-browser compatible
- New real network dependencies in WebRTC/WebSocket validation

## 📄 License

MIT License — see [LICENSE](LICENSE) for details. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 🔗 Resources

- [GitHub Repository](https://github.com/RealEye-io/realtesting-open)
- [Issues](https://github.com/RealEye-io/realtesting-open/issues)
