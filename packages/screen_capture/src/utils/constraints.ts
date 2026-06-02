import type { ResolvedDisplayConstraints } from "../types";

export const DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS: ResolvedDisplayConstraints = {
  width: 1280,
  height: 720,
  frameRate: 30,
};

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

type ConstrainNumber = number | { exact?: number; ideal?: number } | undefined;

type ConstrainNumberWithBounds =
  | number
  | { exact?: number; ideal?: number; min?: number; max?: number }
  | undefined;

function readConstrainNumber(value: ConstrainNumber, fallback: number): number {
  if (isFinitePositiveNumber(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    if (isFinitePositiveNumber(value.exact)) {
      return value.exact;
    }
    if (isFinitePositiveNumber(value.ideal)) {
      return value.ideal;
    }
  }
  return fallback;
}

function readConstrainNumberWithBounds(
  value: ConstrainNumberWithBounds,
  fallback: number
): number {
  if (isFinitePositiveNumber(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return fallback;
  }

  let candidate = fallback;
  if (isFinitePositiveNumber(value.exact)) {
    candidate = value.exact;
  } else if (isFinitePositiveNumber(value.ideal)) {
    candidate = value.ideal;
  }

  if (isFinitePositiveNumber(value.min) && candidate < value.min) {
    candidate = value.min;
  }
  if (isFinitePositiveNumber(value.max) && candidate > value.max) {
    candidate = value.max;
  }
  return candidate;
}

function clampToInt(value: number, min: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < min) {
    return fallback;
  }
  return rounded;
}

export function mergeResolvedDisplayConstraints(
  current: ResolvedDisplayConstraints,
  update?: Partial<ResolvedDisplayConstraints>
): ResolvedDisplayConstraints {
  const nextWidth = clampToInt(
    update?.width ?? current.width,
    1,
    current.width
  );
  const nextHeight = clampToInt(
    update?.height ?? current.height,
    1,
    current.height
  );
  const nextFrameRate = clampToInt(
    update?.frameRate ?? current.frameRate,
    1,
    current.frameRate
  );

  return { width: nextWidth, height: nextHeight, frameRate: nextFrameRate };
}

export function resolveDisplayConstraints(
  constraints: MediaTrackConstraints | undefined,
  defaults: Partial<ResolvedDisplayConstraints> | undefined
): ResolvedDisplayConstraints {
  const resolvedDefaults: ResolvedDisplayConstraints = mergeResolvedDisplayConstraints(
    DEFAULT_RESOLVED_DISPLAY_CONSTRAINTS,
    defaults
  );

  if (!constraints) {
    return resolvedDefaults;
  }

  const width = clampToInt(
    readConstrainNumberWithBounds(
      constraints.width as ConstrainNumberWithBounds,
      resolvedDefaults.width
    ),
    1,
    resolvedDefaults.width
  );
  const height = clampToInt(
    readConstrainNumberWithBounds(
      constraints.height as ConstrainNumberWithBounds,
      resolvedDefaults.height
    ),
    1,
    resolvedDefaults.height
  );
  const frameRate = clampToInt(
    readConstrainNumberWithBounds(
      constraints.frameRate as ConstrainNumberWithBounds,
      resolvedDefaults.frameRate
    ),
    1,
    resolvedDefaults.frameRate
  );

  return { width, height, frameRate };
}

export function extractVideoTrackConstraints(
  constraints?: DisplayMediaStreamOptions
): MediaTrackConstraints | undefined {
  if (!constraints || !constraints.video) {
    return undefined;
  }
  if (typeof constraints.video === "boolean") {
    return undefined;
  }
  return constraints.video;
}

export function isAudioRequested(
  constraints?: DisplayMediaStreamOptions
): boolean {
  if (!constraints) {
    return false;
  }
  if (!("audio" in constraints)) {
    return false;
  }
  const audio = constraints.audio as unknown;
  if (audio === true) {
    return true;
  }
  if (audio && typeof audio === "object") {
    return true;
  }
  return false;
}
