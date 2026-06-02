import type { VirtualRTCPeerConnection } from "./VirtualRTCPeerConnection";

export type VirtualPeerSnapshot = {
  id: string;
  connectionState: string;
  signalingState: string;
};

const peers = new Map<string, VirtualRTCPeerConnection>();

export function registerPeer(peer: VirtualRTCPeerConnection): void {
  peers.set(peer.id, peer);
}

export function unregisterPeer(peerId: string): void {
  peers.delete(peerId);
}

export function getPeer(peerId: string): VirtualRTCPeerConnection | undefined {
  return peers.get(peerId);
}

export function listPeers(): VirtualPeerSnapshot[] {
  return Array.from(peers.values()).map((peer) => ({
    id: peer.id,
    connectionState: peer.connectionState,
    signalingState: peer.signalingState,
  }));
}

export function closeAllPeers(): void {
  const current = Array.from(peers.values());
  for (const peer of current) {
    try {
      peer.close();
    } catch {
      // Ignore cleanup failures.
    }
  }
}

