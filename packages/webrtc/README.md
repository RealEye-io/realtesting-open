# @realeye-io/realtesting-webrtc

In-memory WebRTC emulation (`RTCPeerConnection`) for automated browser testing.

This package is part of the [RealTesting](https://github.com/RealEye-io/realtesting-open) suite from [RealEye.io](https://www.realeye.io/). It provides a virtual `RTCPeerConnection` that operates entirely in-memory — no STUN/TURN servers, no external network connections required.

**RealEye feature**: [Hosted Sessions](https://www.realeye.io/features/online-webcam-eyetracking)

## Installation

```bash
npm install @realeye-io/realtesting-webrtc
```

## Quick Start

```js
import { RealWebRTC } from '@realeye-io/realtesting-webrtc';

// Install the emulator
RealWebRTC.install();

// Create in-memory peer connections
const pc1 = new RTCPeerConnection();
const pc2 = new RTCPeerConnection();

// Signaling via test API — no network needed
const offer = await pc1.createOffer();
await pc1.setLocalDescription(offer);
await pc2.setRemoteDescription(offer);
const answer = await pc2.createAnswer();
await pc2.setLocalDescription(answer);
await pc1.setRemoteDescription(answer);
```

## Modes

| Mode | Behavior |
|------|----------|
| `virtual` | Use in-memory RTCPeerConnection (default) |
| `native` | Delegate to real `RTCPeerConnection` |
| `prefer-virtual` | Try virtual first, fall back to native |
| `prefer-native` | Try native first, fall back to virtual |

## Emulated API Surface

The virtual `RTCPeerConnection` supports:

- `createOffer()` / `createAnswer()`
- `setLocalDescription()` / `setRemoteDescription()`
- `createDataChannel()` / `ondatachannel`
- `addTrack()` / `ontrack`
- `close()`
- Connection state events (`onconnectionstatechange`, etc.)

All signaling and data exchange happens in-memory between peer connections in the same browser context.

## Demo App

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
npm run dev:webrtc  # https://localhost:4177
```

## Test API

When test mode is enabled (`?realtestingTest=1`), the test API is available at `window.__realtestingWebrtcTestApi`:

```js
// Configure via test API
await window.__realtestingWebrtcTestApi.configure({
  rtcMode: "virtual",
  blockNativePeerConnection: true
});

// Get state
const state = window.__realtestingWebrtcTestApi.getState();
console.log(state.virtualConnections);

// Close all virtual connections
window.__realtestingWebrtcTestApi.closeAllVirtualConnections();
```

## Resources

| Resource | Link |
|----------|------|
| RealTesting monorepo | [GitHub](https://github.com/RealEye-io/realtesting-open) |
| Full documentation | [README.md](https://github.com/RealEye-io/realtesting-open/blob/main/README.md) |
| npm page | [npmjs](https://www.npmjs.com/package/@realeye-io/realtesting-webrtc) |
| Issues | [GitHub Issues](https://github.com/RealEye-io/realtesting-open/issues) |
| License | MIT |
