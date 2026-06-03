# @realeye-io/realtesting-browser-features

Emulation for browser features that require user interaction: fullscreen, popups (`window.open`), and clipboard access for automated browser testing.

This package is part of the [RealTesting](https://github.com/RealEye-io/realtesting-open) suite from [RealEye.io](https://www.realeye.io/). It patches standard browser APIs with proxy wrappers that work in headless environments without user gestures.

**RealEye feature**: [How RealEye Works](https://www.realeye.io/features/online-webcam-eyetracking)

## Installation

```bash
npm install @realeye-io/realtesting-browser-features
```

## Quick Start

```js
import { RealBrowserFeatures } from '@realeye-io/realtesting-browser-features';

// Install all feature patches
RealBrowserFeatures.install({
  enableFullscreen: true,
  enablePopups: true,
  enableClipboard: true
});

// Fullscreen
document.documentElement.requestFullscreen();

// Popups — returns a virtual window object
const popup = window.open('https://example.com');

// Clipboard
navigator.clipboard.readText(); // returns configured text
```

## Emulated Features

### Fullscreen
Patches `requestFullscreen()` to work without user gesture requirements.

### Popups
Replaces `window.open()` with a configurable virtual popup system:

| Mode | Behavior |
|------|----------|
| `virtual` | Return virtual popup window (default) |
| `native` | Delegate to real `window.open` |
| `block` | Block and return `null` |
| `prefer-virtual` | Try virtual first, fall back to native |
| `prefer-native` | Try native first, fall back to virtual |

### Clipboard
Patches `navigator.clipboard` read/write operations with configurable test values.

## User Gesture Simulation

Some browser features require a user gesture in real browsers. Enable this mode for tests:

```js
window.__realtestingBrowserTestApi.setRequireUserGesture(true);
```

RealTesting will treat events like `pointerdown`, `mousedown`, `keydown`, and `touchstart` as gestures and gate actions accordingly.

## Demo App

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
npm run dev:features  # https://localhost:4176
```

## Test API

When test mode is enabled, the test API is available at `window.__realtestingBrowserTestApi`:

```js
window.__realtestingBrowserTestApi.configure({
  popupMode: "virtual",
  clipboardText: "Hello from clipboard",
  requireUserGesture: true
});

// Provide synthetic user gestures for tests
window.__realtestingBrowserTestApi.provideUserGesture();
```

## Resources

| Resource | Link |
|----------|------|
| RealTesting monorepo | [GitHub](https://github.com/RealEye-io/realtesting-open) |
| Full documentation | [README.md](https://github.com/RealEye-io/realtesting-open/blob/main/README.md) |
| npm page | [npmjs](https://www.npmjs.com/package/@realeye-io/realtesting-browser-features) |
| Issues | [GitHub Issues](https://github.com/RealEye-io/realtesting-open/issues) |
| License | MIT |
