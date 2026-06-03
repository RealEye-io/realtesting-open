import { describe, it, expect } from "vitest";
import { DeviceRegistry } from "../../packages/camera/src/core/DeviceRegistry";

describe("DeviceRegistry", () => {
  it("adds and lists virtual devices", () => {
    const registry = new DeviceRegistry();
    const id = registry.addVirtualDevice({ label: "Demo" });
    const devices = registry.listVirtualDevices();
    expect(devices.length).toBe(1);
    expect(devices[0].id).toBe(id);
    expect(devices[0].label).toBe("Demo");
  });

  it("updates virtual device state", () => {
    const registry = new DeviceRegistry();
    const id = registry.addVirtualDevice({ label: "Demo" });
    registry.updateVirtualDevice(id, { enabled: false, label: "Updated" });
    const device = registry.getVirtualDevice(id);
    expect(device?.enabled).toBe(false);
    expect(device?.label).toBe("Updated");
  });

  it("removes virtual devices", () => {
    const registry = new DeviceRegistry();
    const id = registry.addVirtualDevice();
    registry.removeVirtualDevice(id);
    expect(registry.getVirtualDevice(id)).toBeUndefined();
  });
});
