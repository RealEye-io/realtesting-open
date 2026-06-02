export type RealTestingTimingProfile = "off" | "ciRealistic" | "realistic";
export type RealTestingTimingRandomMode = "seeded" | "true-random";

export type RealTestingTimingRange = {
  minMs: number;
  maxMs: number;
};

export type RealTestingTimingConfig = {
  profile?: RealTestingTimingProfile;
  enabled?: boolean;
  randomMode?: RealTestingTimingRandomMode;
  seed?: number | string;
  scale?: number;
  ranges?: Record<string, RealTestingTimingRange>;
};

declare global {
  interface Window {
    __REALTESTING_TIMING_CONFIG__?: RealTestingTimingConfig;
  }
}

type ResolvedTimingConfig = Required<
  Pick<RealTestingTimingConfig, "profile" | "enabled" | "randomMode" | "seed" | "scale"> & {
    ranges: Record<string, RealTestingTimingRange>;
  }
>;

const COUNTERS_KEY = "__REALTESTING_TIMING_COUNTERS__";

function clampRange(range: RealTestingTimingRange): RealTestingTimingRange {
  const minMs = Number.isFinite(range.minMs) ? Math.max(0, Math.floor(range.minMs)) : 0;
  const maxMs = Number.isFinite(range.maxMs) ? Math.max(0, Math.floor(range.maxMs)) : 0;
  return {
    minMs: Math.min(minMs, maxMs),
    maxMs: Math.max(minMs, maxMs),
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToUint32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function getGlobalCounters(): Record<string, number> {
  const g = globalThis as any;
  if (!g[COUNTERS_KEY]) {
    g[COUNTERS_KEY] = Object.create(null);
  }
  return g[COUNTERS_KEY] as Record<string, number>;
}

function parseQueryParams(): Partial<RealTestingTimingConfig> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const profileRaw = params.get("realtestingTiming") ?? params.get("realtesting-timing");
    const seedRaw = params.get("realtestingSeed") ?? params.get("realtesting-seed");
    const randomRaw = params.get("realtestingRandom") ?? params.get("realtesting-random");
    const scaleRaw = params.get("realtestingTimingScale") ?? params.get("realtesting-timing-scale");

    const profile =
      profileRaw === "ci" || profileRaw === "ciRealistic"
        ? "ciRealistic"
        : profileRaw === "real" || profileRaw === "realistic"
          ? "realistic"
          : profileRaw === "off"
            ? "off"
            : undefined;

    const seed = seedRaw && /^\d+$/.test(seedRaw) ? Number(seedRaw) : seedRaw ?? undefined;
    const randomMode: RealTestingTimingRandomMode | undefined =
      randomRaw === "true" || randomRaw === "1" || randomRaw === "random" || randomRaw === "true-random"
        ? "true-random"
        : randomRaw === "seeded" || randomRaw === "0" || randomRaw === "false"
          ? "seeded"
          : undefined;
    const scale = scaleRaw && !Number.isNaN(Number(scaleRaw)) ? Number(scaleRaw) : undefined;

    return {
      profile,
      seed,
      randomMode,
      scale,
    };
  } catch {
    return {};
  }
}

function defaultRangesForProfile(profile: RealTestingTimingProfile): Record<string, RealTestingTimingRange> {
  if (profile === "realistic") {
    return {
      "features.userAction": { minMs: 20, maxMs: 600 },
    };
  }
  if (profile === "ciRealistic") {
    return {
      "features.userAction": { minMs: 5, maxMs: 120 },
    };
  }
  return {};
}

function resolveTimingConfig(): ResolvedTimingConfig {
  const fromWindow: RealTestingTimingConfig =
    typeof window !== "undefined" ? window.__REALTESTING_TIMING_CONFIG__ ?? {} : {};
  const fromQuery = parseQueryParams();
  const merged: RealTestingTimingConfig = {
    ...fromWindow,
    ...fromQuery,
    ranges: {
      ...(fromWindow.ranges ?? {}),
      ...(fromQuery.ranges ?? {}),
    },
  };

  const profile: RealTestingTimingProfile = merged.profile ?? "off";
  const enabled = merged.enabled !== false && profile !== "off";
  const randomMode: RealTestingTimingRandomMode = merged.randomMode ?? "seeded";
  const seed = merged.seed ?? 1;
  const scale = typeof merged.scale === "number" && Number.isFinite(merged.scale) ? merged.scale : 1;

  const ranges: Record<string, RealTestingTimingRange> = {
    ...defaultRangesForProfile(profile),
  };
  for (const [kind, range] of Object.entries(merged.ranges ?? {})) {
    ranges[kind] = clampRange(range);
  }
  return { profile, enabled, randomMode, seed, scale, ranges };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RealTestingTiming = {
  enabled: boolean;
  profile: RealTestingTimingProfile;
  sampleMs: (kind: string, fallback?: RealTestingTimingRange) => number;
  delay: (kind: string, fallback?: RealTestingTimingRange) => Promise<number>;
};

export function getRealTestingTiming(_namespace: string): RealTestingTiming {
  const config = resolveTimingConfig();
  const sample = (kind: string, fallback?: RealTestingTimingRange): number => {
    if (!config.enabled) {
      return 0;
    }
    const range = config.ranges[kind] ?? (fallback ? clampRange(fallback) : { minMs: 0, maxMs: 0 });
    const minMs = range.minMs;
    const maxMs = range.maxMs;
    if (maxMs <= 0) {
      return 0;
    }
    const counters = getGlobalCounters();
    const key = kind;
    const nextIndex = (counters[key] = (counters[key] ?? 0) + 1);
    const seedNum = typeof config.seed === "number" ? (config.seed >>> 0) : hashStringToUint32(String(config.seed));
    const salt = hashStringToUint32(key) ^ Math.imul(nextIndex, 0x9e3779b1);
    const t =
      config.randomMode === "true-random" ? Math.random() : mulberry32((seedNum ^ salt) >>> 0)();
    const sampled = minMs + Math.floor(t * (maxMs - minMs + 1));
    return Math.max(0, Math.round(sampled * config.scale));
  };

  return {
    enabled: config.enabled,
    profile: config.profile,
    sampleMs: sample,
    delay: async (kind, fallback) => {
      const ms = sample(kind, fallback);
      if (ms > 0) {
        await sleep(ms);
      }
      return ms;
    },
  };
}
