import type {
  ResolvedDisplayConstraints,
  VirtualDisplayConfig,
  VirtualDisplayState,
  VirtualDisplayUpdate,
  VirtualFrameSource,
} from "../types";
import {
  DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS,
  mergeResolvedDisplayConstraints,
} from "../utils/constraints";
import { notFoundError } from "../utils/errors";

export type VirtualDisplayInternal = VirtualDisplayState & {
  source?: VirtualFrameSource;
};

export class VirtualDisplayRegistry {
  private nextId = 1;
  private displays = new Map<string, VirtualDisplayInternal>();
  private listeners = new Set<() => void>();

  onChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  addVirtualDisplay(config: VirtualDisplayConfig = {}): string {
    const id = `realtesting-display-${this.nextId++}`;
    const label = config.label ?? `RealTesting Virtual Display ${id.split("-").pop()}`;
    const defaultConstraints: ResolvedDisplayConstraints =
      mergeResolvedDisplayConstraints(DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS, config.defaultConstraints);
    const display: VirtualDisplayInternal = {
      id,
      label,
      enabled: true,
      defaultConstraints,
    };
    this.displays.set(id, display);
    this.emit();
    return id;
  }

  removeVirtualDisplay(id: string): void {
    this.displays.delete(id);
    this.emit();
  }

  getVirtualDisplay(id: string): VirtualDisplayInternal | undefined {
    return this.displays.get(id);
  }

  listVirtualDisplays(): VirtualDisplayState[] {
    return Array.from(this.displays.values()).map(({ source: _source, ...rest }) => rest);
  }

  listVirtualDisplayInternals(): VirtualDisplayInternal[] {
    return Array.from(this.displays.values());
  }

  getFirstEnabledVirtualDisplay(): VirtualDisplayInternal | undefined {
    for (const display of this.displays.values()) {
      if (display.enabled) {
        return display;
      }
    }
    return undefined;
  }

  updateVirtualDisplay(id: string, update: VirtualDisplayUpdate): void {
    const existing = this.displays.get(id);
    if (!existing) {
      throw notFoundError(`RealTesting: Virtual display not found: ${id}`);
    }
    const nextDefault = update.defaultConstraints
      ? mergeResolvedDisplayConstraints(existing.defaultConstraints, update.defaultConstraints)
      : existing.defaultConstraints;
    const next: VirtualDisplayInternal = {
      ...existing,
      enabled: typeof update.enabled === "boolean" ? update.enabled : existing.enabled,
      label: update.label ?? existing.label,
      defaultConstraints: nextDefault,
    };
    this.displays.set(id, next);
    this.emit();
  }

  setVirtualEnabled(id: string, enabled: boolean): void {
    this.updateVirtualDisplay(id, { enabled });
  }

  setVirtualSource(id: string, source?: VirtualFrameSource): void {
    const existing = this.displays.get(id);
    if (!existing) {
      throw notFoundError(`RealTesting: Virtual display not found: ${id}`);
    }
    this.displays.set(id, { ...existing, source });
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }
}

