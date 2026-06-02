import type {
  VirtualDeviceConfig,
  VirtualDeviceState,
  VirtualDeviceUpdate,
  VirtualFrameSource,
} from "../types";
import { generateDeviceId } from "../utils/id";

const DEFAULT_CONSTRAINTS: MediaTrackConstraints = {
  width: 640,
  height: 480,
  frameRate: 30,
};

export class DeviceRegistry {
  private devices = new Map<string, VirtualDeviceState>();
  private listeners = new Set<() => void>();

  addVirtualDevice(config: VirtualDeviceConfig = {}): string {
    const id = generateDeviceId("realcamera-virtual");
    const device: VirtualDeviceState = {
      id,
      label: config.label ?? "RealCamera Virtual",
      groupId: config.groupId ?? "realcamera",
      enabled: config.enabled ?? true,
      defaultConstraints: config.defaultConstraints ?? DEFAULT_CONSTRAINTS,
      source: undefined,
    };
    this.devices.set(id, device);
    this.emitChange();
    return id;
  }

  updateVirtualDevice(id: string, update: VirtualDeviceUpdate): void {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    const next: VirtualDeviceState = {
      ...device,
      ...update,
      defaultConstraints: update.defaultConstraints ?? device.defaultConstraints,
    };
    this.devices.set(id, next);
    this.emitChange();
  }

  removeVirtualDevice(id: string): void {
    if (this.devices.delete(id)) {
      this.emitChange();
    }
  }

  setVirtualSource(id: string, source: VirtualFrameSource): void {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    this.devices.set(id, { ...device, source });
    this.emitChange();
  }

  setVirtualEnabled(id: string, enabled: boolean): void {
    const device = this.devices.get(id);
    if (!device) {
      return;
    }
    this.devices.set(id, { ...device, enabled });
    this.emitChange();
  }

  getVirtualDevice(id: string): VirtualDeviceState | undefined {
    return this.devices.get(id);
  }

  listVirtualDevices(): VirtualDeviceState[] {
    return Array.from(this.devices.values());
  }

  clear(): void {
    this.devices.clear();
    this.emitChange();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}
