import { describe, it, expect } from "vitest";
import { VirtualDisplayRegistry } from "../packages/screen_capture/src/core/VirtualDisplayRegistry";

describe("VirtualDisplayRegistry", () => {
  it("adds and lists virtual displays", () => {
    const registry = new VirtualDisplayRegistry();
    const id = registry.addVirtualDisplay({ label: "Demo" });
    const displays = registry.listVirtualDisplays();
    expect(displays.length).toBe(1);
    expect(displays[0].id).toBe(id);
    expect(displays[0].label).toBe("Demo");
    expect(displays[0].enabled).toBe(true);
  });

  it("updates virtual display state", () => {
    const registry = new VirtualDisplayRegistry();
    const id = registry.addVirtualDisplay({ label: "Demo" });
    registry.updateVirtualDisplay(id, { enabled: false, label: "Updated" });
    const display = registry.getVirtualDisplay(id);
    expect(display?.enabled).toBe(false);
    expect(display?.label).toBe("Updated");
  });

  it("removes virtual displays", () => {
    const registry = new VirtualDisplayRegistry();
    const id = registry.addVirtualDisplay();
    registry.removeVirtualDisplay(id);
    expect(registry.getVirtualDisplay(id)).toBeUndefined();
  });
});

