import "./../style.css";

import { RealWebRTC, type WebRtcMode } from "@realeye-io/realtesting-webrtc";

const connectButton = document.getElementById("connectPeers") as HTMLButtonElement | null;
const disconnectButton = document.getElementById("disconnectPeers") as HTMLButtonElement | null;
const modeSelect = document.getElementById("rtcMode") as HTMLSelectElement | null;
const blockNativeCheckbox = document.getElementById("blockNative") as HTMLInputElement | null;
const messageInput = document.getElementById("messageInput") as HTMLInputElement | null;
const sendButton = document.getElementById("sendMessage") as HTMLButtonElement | null;
const statusText = document.getElementById("statusText") as HTMLPreElement | null;
const logText = document.getElementById("logText") as HTMLPreElement | null;
const errorBox = document.getElementById("errorBox") as HTMLDivElement | null;

let pcA: RTCPeerConnection | null = null;
let pcB: RTCPeerConnection | null = null;
let channelA: RTCDataChannel | null = null;
let channelB: RTCDataChannel | null = null;
let negotiationInProgress = false;
const logLines: string[] = [];

function appendLog(line: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  logLines.push(`[${timestamp}] ${line}`);
  while (logLines.length > 50) {
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

function peerSnapshot(pc: RTCPeerConnection | null) {
  if (!pc) {
    return null;
  }
  return {
    connectionState: pc.connectionState,
    signalingState: pc.signalingState,
    localDescription: pc.localDescription?.type ?? null,
    remoteDescription: pc.remoteDescription?.type ?? null,
  };
}

function updateStatus(): void {
  if (!statusText) {
    return;
  }

  const state = {
    rtcMode: RealWebRTC.getRtcMode(),
    blockNativePeerConnection: RealWebRTC.getBlockNativePeerConnection(),
    peerA: peerSnapshot(pcA),
    peerB: peerSnapshot(pcB),
    dataChannel: {
      a: channelA ? { readyState: channelA.readyState, bufferedAmount: channelA.bufferedAmount } : null,
      b: channelB ? { readyState: channelB.readyState, bufferedAmount: channelB.bufferedAmount } : null,
    },
  };

  statusText.textContent = JSON.stringify(state, null, 2);

  if (modeSelect) {
    modeSelect.value = state.rtcMode;
  }
  if (blockNativeCheckbox) {
    blockNativeCheckbox.checked = state.blockNativePeerConnection;
  }
  if (disconnectButton) {
    disconnectButton.disabled = !pcA && !pcB;
  }
  if (sendButton) {
    sendButton.disabled = !channelA || channelA.readyState !== "open";
  }
}

function teardownPeers(): void {
  channelA?.close();
  channelB?.close();
  pcA?.close();
  pcB?.close();
  channelA = null;
  channelB = null;
  pcA = null;
  pcB = null;
  negotiationInProgress = false;
  updateStatus();
}

async function connectPeers(): Promise<void> {
  clearError();
  teardownPeers();

  try {
    pcA = new RTCPeerConnection();
    pcB = new RTCPeerConnection();

    pcA.onconnectionstatechange = () => updateStatus();
    pcB.onconnectionstatechange = () => updateStatus();

    // Wire up a minimal offer/answer exchange. In virtual mode this is entirely in-memory.
    pcA.onnegotiationneeded = async () => {
      if (!pcA || !pcB || negotiationInProgress) {
        return;
      }
      negotiationInProgress = true;
      try {
        // @ts-ignore (allowed by spec: setLocalDescription can be called with no args)
        await pcA.setLocalDescription();
        await pcB.setRemoteDescription(pcA.localDescription!);
        // @ts-ignore
        await pcB.setLocalDescription();
        await pcA.setRemoteDescription(pcB.localDescription!);
        appendLog("Negotiation complete");
      } catch (err) {
        setError(err);
        appendLog(`Negotiation failed: ${String(err)}`);
      } finally {
        negotiationInProgress = false;
        updateStatus();
      }
    };

    channelA = pcA.createDataChannel("textMessages", {
      negotiated: true,
      id: 0,
      maxRetransmits: 1,
    });
    channelB = pcB.createDataChannel("textMessages", {
      negotiated: true,
      id: 0,
      maxRetransmits: 1,
    });

    channelA.onopen = () => {
      appendLog("Channel A open");
      updateStatus();
    };
    channelB.onopen = () => {
      appendLog("Channel B open");
      updateStatus();
    };

    channelB.onmessage = (event) => {
      appendLog(`B <= ${String(event.data)}`);
      updateStatus();
    };

    channelA.onmessage = (event) => {
      appendLog(`A <= ${String(event.data)}`);
      updateStatus();
    };

    appendLog("Peers created");
    updateStatus();
  } catch (err) {
    setError(err);
    appendLog(`Failed to create peers: ${String(err)}`);
    teardownPeers();
  }
}

function sendMessage(): void {
  clearError();
  if (!channelA || channelA.readyState !== "open") {
    setError(new Error("Channel A is not open."));
    return;
  }
  const message = messageInput?.value ?? "";
  try {
    channelA.send(message);
    appendLog(`A => ${message}`);
    updateStatus();
  } catch (err) {
    setError(err);
    appendLog(`Send failed: ${String(err)}`);
  }
}

function bindUi(): void {
  connectButton?.addEventListener("click", () => void connectPeers());
  disconnectButton?.addEventListener("click", () => teardownPeers());
  sendButton?.addEventListener("click", () => sendMessage());

  modeSelect?.addEventListener("change", () => {
    const mode = (modeSelect.value || "prefer-native") as WebRtcMode;
    RealWebRTC.setRtcMode(mode);
    updateStatus();
  });

  blockNativeCheckbox?.addEventListener("change", () => {
    RealWebRTC.setBlockNativePeerConnection(Boolean(blockNativeCheckbox.checked));
    updateStatus();
  });
}

function init(): void {
  RealWebRTC.install({
    testApi: { autoEnable: true },
  });
  bindUi();
  updateStatus();
  appendLog("RealWebRTC installed");
}

init();

