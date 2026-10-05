import type { SensorReading } from '../types';

/* ── Realistic value ranges for each sensor ───────────────── */

const RANGES = {
  temperature: { min: 20, max: 38 },
  humidity: { min: 35, max: 85 },
  ambientLight: { min: 200, max: 45000 },
  co2: { min: 380, max: 1200 },
  soilMoisture: { min: 150, max: 850 },
  tvoc: { min: 0, max: 500 },
  mq2Gas: { min: 40, max: 420 },
  ds18b20Temperature: { min: 20, max: 38 },
} as const;

/* ── Helpers ──────────────────────────────────────────────── */

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

/* ── Public API ───────────────────────────────────────────── */

/** Generate a single demo reading at the current moment. */
export function generateDemoReading(): SensorReading {
  return {
    timestamp: new Date().toISOString(),
    timeMs: 0,
    temperature: rand(RANGES.temperature.min, RANGES.temperature.max),
    humidity: rand(RANGES.humidity.min, RANGES.humidity.max),
    ambientLight: rand(RANGES.ambientLight.min, RANGES.ambientLight.max),
    co2: rand(RANGES.co2.min, RANGES.co2.max),
    soilMoisture: rand(RANGES.soilMoisture.min, RANGES.soilMoisture.max),
    tvoc: rand(RANGES.tvoc.min, RANGES.tvoc.max),
    mq2Gas: rand(RANGES.mq2Gas.min, RANGES.mq2Gas.max),
    ds18b20Temperature: rand(RANGES.ds18b20Temperature.min, RANGES.ds18b20Temperature.max),
    soilRaw: rand(1500, 4095),
    mq2Voltage: rand(0.1, 1.2),
  };
}

/**
 * Generate `count` historical demo readings spaced 1 minute apart,
 * ending at the current time.
 */
export function generateDemoHistory(count = 50): SensorReading[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    ...generateDemoReading(),
    timestamp: new Date(now - (count - 1 - i) * 60_000).toISOString(),
  }));
}
