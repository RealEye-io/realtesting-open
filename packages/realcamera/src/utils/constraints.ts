import type { ResolvedVideoConstraints } from "../types";

const DEFAULT_CONSTRAINTS: ResolvedVideoConstraints = {
  width: 640,
  height: 480,
  frameRate: 30,
};

export function applyVideoConstraintsOverride(
  constraints: MediaTrackConstraints | boolean | undefined,
  override?: MediaTrackConstraints
): MediaTrackConstraints | boolean | undefined {
  if (!override) {
    return constraints;
  }

  if (!constraints || typeof constraints === "boolean") {
    return { ...override };
  }

  return {
    ...constraints,
    ...override,
  };
}

function resolveNumberConstraint(
  constraint: ConstrainULong | ConstrainDouble | undefined,
  fallback: number
): number {
  if (typeof constraint === "number") {
    return constraint;
  }
  if (!constraint || typeof constraint !== "object") {
    return fallback;
  }
  if (typeof constraint.exact === "number") {
    return constraint.exact;
  }
  if (typeof constraint.ideal === "number") {
    return constraint.ideal;
  }
  let candidate = fallback;
  if (typeof constraint.min === "number") {
    candidate = Math.max(candidate, constraint.min);
  }
  if (typeof constraint.max === "number") {
    candidate = Math.min(candidate, constraint.max);
  }
  return candidate;
}

export function resolveVideoConstraints(
  constraints: MediaTrackConstraints | boolean | undefined,
  defaults: Partial<ResolvedVideoConstraints> = {}
): ResolvedVideoConstraints {
  if (constraints === false) {
    return { ...DEFAULT_CONSTRAINTS, ...defaults };
  }
  if (!constraints || typeof constraints === "boolean") {
    return { ...DEFAULT_CONSTRAINTS, ...defaults };
  }
  const width = resolveNumberConstraint(
    constraints.width as ConstrainULong | undefined,
    defaults.width ?? DEFAULT_CONSTRAINTS.width
  );
  const height = resolveNumberConstraint(
    constraints.height as ConstrainULong | undefined,
    defaults.height ?? DEFAULT_CONSTRAINTS.height
  );
  const frameRate = resolveNumberConstraint(
    constraints.frameRate as ConstrainDouble | undefined,
    defaults.frameRate ?? DEFAULT_CONSTRAINTS.frameRate
  );
  return {
    width,
    height,
    frameRate,
  };
}

export function extractDeviceId(
  constraints: MediaTrackConstraints | boolean | undefined
): string | undefined {
  if (!constraints || typeof constraints === "boolean") {
    return undefined;
  }
  const deviceId = constraints.deviceId as
    | ConstrainDOMString
    | undefined
    | string;
  if (!deviceId) {
    return undefined;
  }
  if (typeof deviceId === "string") {
    return deviceId;
  }
  if (Array.isArray(deviceId)) {
    return deviceId[0];
  }
  if (typeof deviceId === "object") {
    if (Array.isArray(deviceId.exact)) {
      return deviceId.exact[0];
    }
    if (typeof deviceId.exact === "string") {
      return deviceId.exact;
    }
    if (Array.isArray(deviceId.ideal)) {
      return deviceId.ideal[0];
    }
    if (typeof deviceId.ideal === "string") {
      return deviceId.ideal;
    }
  }
  return undefined;
}

export function toConstraintsObject(
  constraints: MediaStreamConstraints | undefined
): MediaStreamConstraints {
  if (!constraints) {
    return { video: true, audio: false };
  }
  return constraints;
}
