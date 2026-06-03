# @realeye-io/realtesting-websocket

Virtual WebSocket servers for automated browser testing.

This package is part of the [RealTesting](https://github.com/RealEye-io/realtesting-open) suite from [RealEye.io](https://www.realeye.io/). It provides in-memory WebSocket server instances that intercept `new WebSocket()` calls — no actual network server required.

**RealEye feature**: [Hosted Sessions](https://www.realeye.io/features/online-webcam-eyetracking) real-time communication

## Installation

```bash
npm install @realeye-io/realtesting-websocket
```

## Quick Start

```js
import { RealWebSocket } from '@realeye-io/realtesting-websocket';

// Install the emulator
RealWebSocket.install();

// Connect — this will use the virtual server
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send('hello');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

## Virtual WebSocket Servers

Create virtual server instances that respond to matching URLs:

```js
// Create an echo server
const serverId = RealWebSocket.createEchoServer('ws://localhost:8080');

// Create a custom server with handlers
const serverId = RealWebSocket.createServer({
  match: /^ws:\/\/api\./,
  label: "API WebSocket",
  onConnect: (client) => {
    console.log('Client connected');
  },
  onMessage: (client, data) => {
    // Push response back to the client
    client.push(JSON.stringify({ echo: data }));
  },
  onClose: (client, code, reason) => {
    console.log('Client disconnected');
  }
});
```

## Modes

| Mode | Behavior |
|------|----------|
| `virtual` | Use in-memory WebSocket server (default) |
| `native` | Delegate to real `WebSocket` |
| `prefer-virtual` | Try virtual first, fall back to native |
| `prefer-native` | Try native first, fall back to virtual |

## Client API

Virtual servers expose a client handle for server-to-client messaging:

```js
RealWebSocket.createServer({
  match: 'ws://localhost:8080',
  onConnect: (client) => {
    // client.url — connection URL
    // client.protocols — negotiated protocols
    client.push('Welcome!');           // send to client
    client.close(1000, 'Goodbye');     // close connection
  }
});
```

## Demo App

```bash
git clone https://github.com/RealEye-io/realtesting-open.git
cd realtesting-open
npm install
npm run dev:websocket  # https://localhost:4178
```

## Test API

When test mode is enabled (`?realtestingTest=1`), the test API is available at `window.__realtestingWebSocketTestApi`:

```js
// Configure via test API
await window.__realtestingWebSocketTestApi.configure({
  socketMode: "virtual",
  blockNativeWebSocket: true
});

// Create echo server for tests
const serverId = window.__realtestingWebSocketTestApi.createEchoServer('ws://localhost:8080');

// Get state
const state = window.__realtestingWebSocketTestApi.getState();
console.log(state.servers);
```

## Resources

| Resource | Link |
|----------|------|
| RealTesting monorepo | [GitHub](https://github.com/RealEye-io/realtesting-open) |
| Full documentation | [README.md](https://github.com/RealEye-io/realtesting-open/blob/main/README.md) |
| npm page | [npmjs](https://www.npmjs.com/package/@realeye-io/realtesting-websocket) |
| Issues | [GitHub Issues](https://github.com/RealEye-io/realtesting-open/issues) |
| License | MIT |
