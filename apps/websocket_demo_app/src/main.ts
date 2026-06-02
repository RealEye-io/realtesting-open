import "./../style.css";

import { RealWebSocket, type WebSocketMode } from "@realeye/realtesting-websocket";

const ECHO_URL = "ws://realtesting.local/echo";

const connectButton = document.getElementById("connectSocket") as HTMLButtonElement | null;
const disconnectButton = document.getElementById("disconnectSocket") as HTMLButtonElement | null;
const modeSelect = document.getElementById("socketMode") as HTMLSelectElement | null;
const blockNativeCheckbox = document.getElementById("blockNative") as HTMLInputElement | null;
const messageInput = document.getElementById("messageInput") as HTMLInputElement | null;
const sendButton = document.getElementById("sendMessage") as HTMLButtonElement | null;
const resetServersButton = document.getElementById("resetServers") as HTMLButtonElement | null;
const statusText = document.getElementById("statusText") as HTMLPreElement | null;
const logText = document.getElementById("logText") as HTMLPreElement | null;
const errorBox = document.getElementById("errorBox") as HTMLDivElement | null;

let socket: WebSocket | null = null;
const logLines: string[] = [];

function appendLog(line: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  logLines.push(`[${timestamp}] ${line}`);
  while (logLines.length > 80) {
    logLines.shift();
  }
  if (logText) {
    logText.textContent = logLines.join("\n");
  }
}

function setError(error: unknown): void {
  if (!errorBox) {
    return;
  }
  const name =
    error && typeof error === "object" && "name" in error ? String((error as any).name) : "Error";
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as any).message)
      : String(error);
  errorBox.hidden = false;
  errorBox.textContent = `${name}: ${message}`;
}

function clearError(): void {
  if (!errorBox) {
    return;
  }
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function updateStatus(): void {
  if (!statusText) {
    return;
  }

  const state = {
    socketMode: RealWebSocket.getSocketMode(),
    blockNativeWebSocket: RealWebSocket.getBlockNativeWebSocket(),
    socket: socket
      ? {
          url: (socket as any).url,
          readyState: socket.readyState,
          protocol: (socket as any).protocol,
        }
      : null,
    servers: RealWebSocket.listVirtualServers(),
  };

  statusText.textContent = JSON.stringify(state, null, 2);

  if (modeSelect) {
    modeSelect.value = state.socketMode;
  }
  if (blockNativeCheckbox) {
    blockNativeCheckbox.checked = state.blockNativeWebSocket;
  }
  if (disconnectButton) {
    disconnectButton.disabled = !socket;
  }
  if (sendButton) {
    sendButton.disabled = !socket || socket.readyState !== WebSocket.OPEN;
  }
}

function ensureEchoServer(): void {
  RealWebSocket.clearVirtualServers();
  RealWebSocket.createEchoServer(ECHO_URL);
  appendLog(`Echo server registered for ${ECHO_URL}`);
  updateStatus();
}

function disconnectSocket(): void {
  try {
    socket?.close(1000, "Closed by user");
  } catch {
    // ignore
  }
  socket = null;
  updateStatus();
}

function connectSocket(): void {
  clearError();
  disconnectSocket();

  try {
    socket = new WebSocket(ECHO_URL);
  } catch (err) {
    setError(err);
    appendLog(`WebSocket constructor threw: ${String(err)}`);
    socket = null;
    updateStatus();
    return;
  }

  socket.onopen = () => {
    appendLog("socket open");
    updateStatus();
  };
  socket.onmessage = (event) => {
    appendLog(`<= ${String(event.data)}`);
    updateStatus();
  };
  socket.onerror = () => {
    appendLog("socket error");
    updateStatus();
  };
  socket.onclose = (event) => {
    appendLog(`socket close (code=${event.code}, reason=${event.reason || ""})`);
    socket = null;
    updateStatus();
  };

  appendLog("connecting...");
  updateStatus();
}

function sendMessage(): void {
  clearError();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setError(new Error("Socket is not open."));
    return;
  }
  const message = messageInput?.value ?? "";
  try {
    socket.send(message);
    appendLog(`=> ${message}`);
    updateStatus();
  } catch (err) {
    setError(err);
    appendLog(`send failed: ${String(err)}`);
  }
}

function bindUi(): void {
  connectButton?.addEventListener("click", () => connectSocket());
  disconnectButton?.addEventListener("click", () => disconnectSocket());
  sendButton?.addEventListener("click", () => sendMessage());
  resetServersButton?.addEventListener("click", () => ensureEchoServer());

  modeSelect?.addEventListener("change", () => {
    const mode = (modeSelect.value || "prefer-native") as WebSocketMode;
    RealWebSocket.setSocketMode(mode);
    updateStatus();
  });

  blockNativeCheckbox?.addEventListener("change", () => {
    RealWebSocket.setBlockNativeWebSocket(Boolean(blockNativeCheckbox.checked));
    updateStatus();
  });
}

function init(): void {
  RealWebSocket.install({ testApi: { autoEnable: true } });
  ensureEchoServer();
  bindUi();
  updateStatus();
  appendLog("RealWebSocket installed");
}

init();

