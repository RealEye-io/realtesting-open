import type { VirtualWebSocketServerClient, VirtualWebSocketServerConfig, VirtualWebSocketServerState } from "../types";

type Server = {
  id: string;
  label: string;
  match: string | RegExp;
  config: VirtualWebSocketServerConfig;
  clients: Set<VirtualWebSocketServerClient>;
};

function generateServerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ws-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }
}

export class VirtualWebSocketServerRegistry {
  private servers = new Map<string, Server>();

  createServer(config: VirtualWebSocketServerConfig): string {
    const id = generateServerId();
    const label = config.label ?? "Virtual WebSocket Server";
    const server: Server = {
      id,
      label,
      match: config.match,
      config,
      clients: new Set(),
    };
    this.servers.set(id, server);
    return id;
  }

  removeServer(serverId: string): void {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    // Best effort: close any connected clients.
    for (const client of Array.from(server.clients)) {
      try {
        client.close(1001, "Server removed");
      } catch {
        // ignore
      }
    }
    this.servers.delete(serverId);
  }

  clearServers(): void {
    for (const id of Array.from(this.servers.keys())) {
      this.removeServer(id);
    }
  }

  listServers(): VirtualWebSocketServerState[] {
    return Array.from(this.servers.values()).map((server) => ({
      id: server.id,
      label: server.label,
      match:
        typeof server.match === "string" ? server.match : server.match.toString(),
      clientCount: server.clients.size,
    }));
  }

  resolveServer(url: string): { id: string; config: VirtualWebSocketServerConfig } | null {
    const server = this.findServer(url);
    if (!server) {
      return null;
    }
    return { id: server.id, config: server.config };
  }

  private findServer(url: string): Server | null {
    for (const server of this.servers.values()) {
      if (typeof server.match === "string") {
        if (server.match === url) {
          return server;
        }
        continue;
      }
      try {
        if (server.match.test(url)) {
          return server;
        }
      } catch {
        // ignore invalid regex
      }
    }
    return null;
  }

  attachClient(serverId: string, client: VirtualWebSocketServerClient): void {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    server.clients.add(client);
  }

  detachClient(serverId: string, client: VirtualWebSocketServerClient): void {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    server.clients.delete(client);
  }

  closeAllClients(): void {
    for (const server of this.servers.values()) {
      for (const client of Array.from(server.clients)) {
        try {
          client.close(1001, "Closed by RealTesting");
        } catch {
          // ignore
        }
      }
    }
  }
}
