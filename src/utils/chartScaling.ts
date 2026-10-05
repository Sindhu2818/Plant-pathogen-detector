import type { SensorKey, SensorReading } from '../types';

export type TimeRangeKey = '1H' | '3H' | '6H' | '12H' | '24H' | '3D' | 'ALL';

export interface TimeRangeConfig {
  key: TimeRangeKey;
  label: string;
  fullLabel: string;
  durationMs: number | null;
}

export const TIME_RANGE_CONFIGS: Record<TimeRangeKey, TimeRangeConfig> = {
  '1H': { key: '1H', label: '1H', fullLabel: 'Last 1 Hour', durationMs: 1 * 60 * 60 * 1000 },
  '3H': { key: '3H', label: '3H', fullLabel: 'Last 3 Hours', durationMs: 3 * 60 * 60 * 1000 },
  '6H': { key: '6H', label: '6H', fullLabel: 'Last 6 Hours', durationMs: 6 * 60 * 60 * 1000 },
  '12H': { key: '12H', label: '12H', fullLabel: 'Last 12 Hours', durationMs: 12 * 60 * 60 * 1000 },
  '24H': { key: '24H', label: '24H', fullLabel: 'Last 24 Hours', durationMs: 24 * 60 * 60 * 1000 },
  '3D': { key: '3D', label: '3D', fullLabel: 'Last 3 Days', durationMs: 3 * 24 * 60 * 60 * 1000 },
  'ALL': { key: 'ALL', label: 'ALL', fullLabel: 'All Data', durationMs: null },
};

export const TIME_RANGE_LIST: TimeRangeConfig[] = Object.values(TIME_RANGE_CONFIGS);

const PERCENTAGE_SENSORS: readonly SensorKey[] = ['humidity', 'soilMoisture'];
const NON_NEGATIVE_SENSORS: readonly SensorKey[] = [
  'ambientLight',
  'co2',
  'tvoc',
  'soilMoisture',
  'soilRaw',
  'mq2Gas',
  'mq2Voltage',
];

/**
 * Format a bound with appropriate precision for the sensor type.
 */
function roundBound(val: number, sensorKey: SensorKey, direction: 'floor' | 'ceil'): number {
  if (sensorKey === 'mq2Voltage') {
    const mult = 1000;
    const rounded = direction === 'floor' ? Math.floor(val * mult) : Math.ceil(val * mult);
    return Number((rounded / mult).toFixed(3));
  }
  if (sensorKey === 'temperature' || sensorKey === 'ds18b20Temperature' || sensorKey === 'humidity') {
    const mult = 10;
    const rounded = direction === 'floor' ? Math.floor(val * mult) : Math.ceil(val * mult);
    return Number((rounded / mult).toFixed(1));
  }
  if (sensorKey === 'soilMoisture') {
    const mult = 10;
    const rounded = direction === 'floor' ? Math.floor(val * mult) : Math.ceil(val * mult);
    return Number((rounded / mult).toFixed(1));
  }
  if (Math.abs(val) >= 100) {
    return direction === 'floor' ? Math.floor(val) : Math.ceil(val);
  }
  const mult = 10;
  const rounded = direction === 'floor' ? Math.floor(val * mult) : Math.ceil(val * mult);
  return Number((rounded / mult).toFixed(1));
}

/**
 * Dynamically calculate the Y-axis domain for an individual sensor based on observed values.
 *
 * 1. Finds min and max from observed dataset.
 * 2. Adds 5–10% (specifically 8%) visual padding above and below.
 * 3. Handles constant-value datasets without collapsing axis to zero height.
 * 4. Preserves decimal precision for small values (e.g. MQ-2 voltage).
 * 5. Clamps percentage sensors (0%–100%) to avoid displaying impossible ranges.
 * 6. Keeps genuine zero or near-zero readings accommodated.
 */
export function calculateSensorDomain(
  sensorKey: SensorKey,
  values: number[],
): [number, number] {
  if (values.length === 0) {
    if (PERCENTAGE_SENSORS.includes(sensorKey)) return [0, 100];
    if (sensorKey === 'mq2Voltage') return [0, 1];
    return [0, 100];
  }

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const isPercentage = PERCENTAGE_SENSORS.includes(sensorKey);
  const isNonNegative = NON_NEGATIVE_SENSORS.includes(sensorKey);

  let yMin: number;
  let yMax: number;
  const range = max - min;

  // Case 1: Constant values (or range is practically 0)
  if (range <= 1e-9) {
    if (Math.abs(min) < 1e-6) {
      // Constant 0
      if (sensorKey === 'mq2Voltage') {
        yMin = 0;
        yMax = 0.1;
      } else if (isPercentage) {
        yMin = 0;
        yMax = 10;
      } else {
        yMin = isNonNegative ? 0 : -1;
        yMax = 1;
      }
    } else if (sensorKey === 'mq2Voltage') {
      const pad = Math.max(Math.abs(min) * 0.08, 0.02);
      yMin = min - pad;
      yMax = max + pad;
    } else if (Math.abs(min) >= 100) {
      const pad = Math.max(Math.abs(min) * 0.08, 5);
      yMin = min - pad;
      yMax = max + pad;
    } else {
      const pad = Math.max(Math.abs(min) * 0.08, 0.5);
      yMin = min - pad;
      yMax = max + pad;
    }
  } else {
    // Case 2: Normal range with 8% visual padding
    const padding = range * 0.08;
    yMin = min - padding;
    yMax = max + padding;
  }

  // Physical constraints
  if (isPercentage) {
    if (min >= 0) yMin = Math.max(0, yMin);
    if (max <= 100) yMax = Math.min(100, yMax);
    if (yMin >= yMax) {
      if (yMax >= 100) yMin = Math.max(0, yMax - 10);
      else yMax = Math.min(100, yMin + 10);
    }
  } else if (isNonNegative && min >= 0) {
    if (yMin < 0) yMin = 0;
  }

  // Apply rounded bounds
  const cleanYMin = roundBound(yMin, sensorKey, 'floor');
  let cleanYMax = roundBound(yMax, sensorKey, 'ceil');

  if (cleanYMax <= cleanYMin) {
    cleanYMax = cleanYMin + (sensorKey === 'mq2Voltage' ? 0.01 : 1);
  }

  return [cleanYMin, cleanYMax];
}

/** Format elapsed time into human-friendly string */
export function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return '';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Formats a single reading's point in time for the "From: ... To: ..." display */
export function formatReadingTimePoint(r: SensorReading): string {
  const d = new Date(r.timestamp);
  const isRealDate = !Number.isNaN(d.getTime()) && d.getFullYear() > 2000;
  if (isRealDate) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return formatElapsed(r.timeMs);
}

/** Formats X-axis label adapting to whether the data uses real timestamps or elapsed time */
export function formatAxisTime(r: SensorReading, timeRange: TimeRangeKey): string {
  const d = new Date(r.timestamp);
  const isRealDate = !Number.isNaN(d.getTime()) && d.getFullYear() > 2000;

  if (isRealDate) {
    if (timeRange === '1H') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (timeRange === '3H' || timeRange === '6H' || timeRange === '12H') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (timeRange === '24H') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Elapsed time (Time_ms)
  const ms = r.timeMs ?? 0;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (timeRange === '1H') {
    if (days) return `${days}d ${hours % 24}h ${minutes}m ${seconds}s`;
    if (hours) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (timeRange === '3H' || timeRange === '6H' || timeRange === '12H') {
    if (days) return `${days}d ${hours % 24}h ${minutes}m`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (days) return `${days}d ${hours % 24}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
