import { test as base, expect } from "@playwright/test";

type TimingProfile = "off" | "ciRealistic" | "realistic";
type RandomMode = "seeded" | "true-random";

type TimingConfig = {
  profile: TimingProfile;
  enabled: boolean;
  randomMode: RandomMode;
  seed: number | string;
  scale?: number;
};

function resolveTimingConfig(): TimingConfig {
  const profile = (process.env.REALTESTING_TIMING_PROFILE as TimingProfile | undefined) ??
    (process.env.CI ? "ciRealistic" : "ciRealistic");

  const randomMode: RandomMode =
    process.env.REALTESTING_TIMING_RANDOM === "1" ||
    process.env.REALTESTING_TIMING_RANDOM === "true"
      ? "true-random"
      : "seeded";

  const seedRaw = process.env.REALTESTING_TIMING_SEED ?? "1";
  const seed = /^\d+$/.test(seedRaw) ? Number(seedRaw) : seedRaw;

  const scaleRaw = process.env.REALTESTING_TIMING_SCALE;
  const scale = scaleRaw && !Number.isNaN(Number(scaleRaw)) ? Number(scaleRaw) : undefined;

  return {
    profile,
    enabled: profile !== "off",
    randomMode,
    seed,
    scale,
  };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const config = resolveTimingConfig();

    // Ensure the timing config is present before any app code runs.
    await page.addInitScript((cfg: TimingConfig) => {
      (window as any).__REALTESTING_TIMING_CONFIG__ = cfg;
    }, config);

    await use(page);
  },
});

export { expect };
